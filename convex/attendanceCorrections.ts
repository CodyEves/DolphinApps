// Student-requested time sheet fixes ("I forgot to sign out" / "I forgot to
// sign in"), approved or denied by staff with one click in Slack.
//
// Flow:
//   Home tab button → modal (slackEvents.ts) → requestFix / requestMissed
//   → postForApproval posts to SLACK_APPROVALS_CHANNEL_ID with Approve/Deny
//   → decide() applies the change → notifyDecision updates the message + DMs
//     the student → their Home tab refreshes.

import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { slackApi } from "./lib/slack";
import { STAFF_ROLES, slackLinkForSlackUser } from "./lib/slackIdentity";
import { displayNameFor } from "./shopAttendance";

export const CORRECTION_WINDOW_DAYS = 14;
export const MAX_PENDING_CORRECTIONS = 5;
const MAX_SESSION_HOURS = 12;
/** How far outside the shop session's open/close times a missed-session request may reach. */
const SHOP_SLACK_MS = 15 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function linkedStudent(ctx: QueryCtx | MutationCtx, slackUserId: string) {
  const link = await slackLinkForSlackUser(ctx, slackUserId);
  const profile = link ? await ctx.db.get(link.profileId) : null;

  if (!link || !profile || profile.status !== "active") {
    throw new Error("Connect your Dolphin Apps account first (Home tab → Connect my account).");
  }

  return profile;
}

function validateTimes(signInAt: number, signOutAt: number, now: number) {
  if (signOutAt <= signInAt) {
    throw new Error("Sign-out time must be after the sign-in time.");
  }

  if (signOutAt - signInAt > MAX_SESSION_HOURS * HOUR_MS) {
    throw new Error(`A single session can't be longer than ${MAX_SESSION_HOURS} hours.`);
  }

  if (signOutAt > now) {
    throw new Error("Sign-out time can't be in the future.");
  }

  if (signInAt < now - CORRECTION_WINDOW_DAYS * DAY_MS) {
    throw new Error(
      `Only sessions from the last ${CORRECTION_WINDOW_DAYS} days can be fixed here. Ask a mentor for older ones.`,
    );
  }
}

function cleanReason(reason: string) {
  const trimmed = reason.trim();

  if (trimmed.length < 3) {
    throw new Error("Add a short reason (for example: \"forgot to sign out, left at 6\").");
  }

  return trimmed.slice(0, 500);
}

async function assertPendingLimit(ctx: MutationCtx, userId: Id<"users">) {
  const pending = await ctx.db
    .query("attendanceCorrections")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "pending"))
    .collect();

  if (pending.length >= MAX_PENDING_CORRECTIONS) {
    throw new Error(
      `You already have ${pending.length} requests waiting for a mentor. Wait for those first.`,
    );
  }
}

async function overlapsExistingSession(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  signInAt: number,
  signOutAt: number,
  ignoreId?: Id<"attendanceSessions">,
) {
  const sessions = await ctx.db
    .query("attendanceSessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return sessions.some((item) => {
    if (item._id === ignoreId || item.status === "void") {
      return false;
    }

    const end = item.signOutAt ?? Date.now();
    return item.signInAt < signOutAt && end > signInAt;
  });
}

async function slackIdsForUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return (
    await ctx.db
      .query("slackAccountLinks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  ).map((link) => link.slackUserId);
}

// ---------------------------------------------------------------------------
// Student side
// ---------------------------------------------------------------------------

/** Data for the "Fix time" modal; also checks the session is fixable. */
export const fixModalContext = internalQuery({
  args: { slackUserId: v.string(), attendanceSessionId: v.string() },
  handler: async (ctx, args) => {
    const profile = await linkedStudent(ctx, args.slackUserId);
    const sessionId = ctx.db.normalizeId("attendanceSessions", args.attendanceSessionId);
    const session = sessionId ? await ctx.db.get(sessionId) : null;

    if (!session || session.userId !== profile.userId) {
      throw new Error("That session wasn't found.");
    }

    if (session.status !== "needs_review") {
      throw new Error("That session doesn't need fixing anymore.");
    }

    return {
      attendanceSessionId: session._id as string,
      signInAt: session.signInAt,
      autoClosedAt: session.signOutAt,
    };
  },
});

export const requestFix = internalMutation({
  args: {
    slackUserId: v.string(),
    attendanceSessionId: v.string(),
    signOutAt: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await linkedStudent(ctx, args.slackUserId);
    const sessionId = ctx.db.normalizeId("attendanceSessions", args.attendanceSessionId);
    const session = sessionId ? await ctx.db.get(sessionId) : null;
    const now = Date.now();

    if (!session || session.userId !== profile.userId) {
      throw new Error("That session wasn't found.");
    }

    if (session.status !== "needs_review") {
      throw new Error("That session doesn't need fixing anymore.");
    }

    validateTimes(session.signInAt, args.signOutAt, now);

    if (session.signOutAt && args.signOutAt > session.signOutAt) {
      throw new Error("You can't sign out later than when the shop closed.");
    }

    const existing = await ctx.db
      .query("attendanceCorrections")
      .withIndex("by_attendance_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect();

    if (existing.some((item) => item.status === "pending")) {
      throw new Error("You already asked to fix this session. A mentor will review it.");
    }

    await assertPendingLimit(ctx, profile.userId);

    const correctionId = await ctx.db.insert("attendanceCorrections", {
      userId: profile.userId,
      profileId: profile._id,
      kind: "fix_sign_out",
      attendanceSessionId: session._id,
      shopSessionId: session.shopSessionId,
      requestedSignInAt: session.signInAt,
      requestedSignOutAt: args.signOutAt,
      originalSignOutAt: session.signOutAt,
      reason: cleanReason(args.reason),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.attendanceCorrections.postForApproval, { correctionId });

    for (const slackUserId of await slackIdsForUser(ctx, profile.userId)) {
      await ctx.scheduler.runAfter(0, internal.slackHome.publishHome, { slackUserId });
    }

    return correctionId;
  },
});

export const requestMissed = internalMutation({
  args: {
    slackUserId: v.string(),
    signInAt: v.number(),
    signOutAt: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await linkedStudent(ctx, args.slackUserId);
    const now = Date.now();

    validateTimes(args.signInAt, args.signOutAt, now);

    // The shop has to have actually been open then.
    const shopSessions = await ctx.db
      .query("shopSessions")
      .withIndex("by_opened_at", (q) =>
        q.gte("openedAt", args.signInAt - DAY_MS).lte("openedAt", args.signInAt + SHOP_SLACK_MS),
      )
      .collect();
    const shopSession = shopSessions.find((item) => {
      const closesAt = item.closedAt ?? now;
      return (
        item.openedAt - SHOP_SLACK_MS <= args.signInAt &&
        args.signOutAt <= closesAt + SHOP_SLACK_MS
      );
    });

    if (!shopSession) {
      throw new Error(
        "The shop wasn't open for that whole time. Check the times, or ask a mentor if this was an event.",
      );
    }

    if (await overlapsExistingSession(ctx, profile.userId, args.signInAt, args.signOutAt)) {
      throw new Error(
        "That overlaps a session you already have. If it was auto-closed, use \"Fix time\" on it instead.",
      );
    }

    await assertPendingLimit(ctx, profile.userId);

    const correctionId = await ctx.db.insert("attendanceCorrections", {
      userId: profile.userId,
      profileId: profile._id,
      kind: "missed_session",
      shopSessionId: shopSession._id,
      requestedSignInAt: args.signInAt,
      requestedSignOutAt: args.signOutAt,
      reason: cleanReason(args.reason),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.attendanceCorrections.postForApproval, { correctionId });

    for (const slackUserId of await slackIdsForUser(ctx, profile.userId)) {
      await ctx.scheduler.runAfter(0, internal.slackHome.publishHome, { slackUserId });
    }

    return correctionId;
  },
});

// ---------------------------------------------------------------------------
// Staff side
// ---------------------------------------------------------------------------

export type CorrectionDetails = {
  correctionId: Id<"attendanceCorrections">;
  kind: Doc<"attendanceCorrections">["kind"];
  status: Doc<"attendanceCorrections">["status"];
  studentName: string;
  requestedSignInAt: number;
  requestedSignOutAt: number;
  originalSignOutAt?: number;
  reason: string;
  reviewerName?: string;
  reviewedAt?: number;
  slackChannelId?: string;
  slackMessageTs?: string;
  studentSlackUserIds: string[];
};

export const correctionDetails = internalQuery({
  args: { correctionId: v.id("attendanceCorrections") },
  handler: async (ctx, args): Promise<CorrectionDetails | null> => {
    const correction = await ctx.db.get(args.correctionId);

    if (!correction) {
      return null;
    }

    const student = await ctx.db.get(correction.profileId);
    const reviewerProfile = correction.reviewedBy
      ? await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", correction.reviewedBy!))
          .first()
      : null;

    return {
      correctionId: correction._id,
      kind: correction.kind,
      status: correction.status,
      studentName: displayNameFor(student, await ctx.db.get(correction.userId)),
      requestedSignInAt: correction.requestedSignInAt,
      requestedSignOutAt: correction.requestedSignOutAt,
      originalSignOutAt: correction.originalSignOutAt,
      reason: correction.reason,
      reviewerName: correction.reviewedBy
        ? displayNameFor(reviewerProfile, await ctx.db.get(correction.reviewedBy))
        : undefined,
      reviewedAt: correction.reviewedAt,
      slackChannelId: correction.slackChannelId,
      slackMessageTs: correction.slackMessageTs,
      studentSlackUserIds: await slackIdsForUser(ctx, correction.userId),
    };
  },
});

export const saveSlackMessage = internalMutation({
  args: {
    correctionId: v.id("attendanceCorrections"),
    channel: v.string(),
    ts: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.correctionId, {
      slackChannelId: args.channel,
      slackMessageTs: args.ts,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Applies a staff decision. Only active admins/mentors/instructors whose Slack
 * link has been trusted (slackAdmin:trustStaffLink) can decide, and never on
 * their own requests.
 */
export const decide = internalMutation({
  args: {
    correctionId: v.string(),
    reviewerSlackUserId: v.string(),
    approve: v.boolean(),
  },
  handler: async (ctx, args) => {
    const correctionId = ctx.db.normalizeId("attendanceCorrections", args.correctionId);
    const correction = correctionId ? await ctx.db.get(correctionId) : null;

    if (!correction) {
      throw new Error("That request no longer exists.");
    }

    const reviewerLink = await slackLinkForSlackUser(ctx, args.reviewerSlackUserId);
    const reviewer = reviewerLink ? await ctx.db.get(reviewerLink.profileId) : null;

    if (
      !reviewerLink ||
      !reviewer ||
      reviewer.status !== "active" ||
      !STAFF_ROLES.has(reviewer.role) ||
      !reviewerLink.trustedForStaffSignIn
    ) {
      throw new Error(
        "Only mentors with a trusted Slack link can approve hours. (Admins: run slackAdmin:trustStaffLink.)",
      );
    }

    if (reviewer.userId === correction.userId) {
      throw new Error("You can't approve your own request.");
    }

    if (correction.status !== "pending") {
      return { status: correction.status, alreadyDecided: true };
    }

    const now = Date.now();
    let attendanceSessionId = correction.attendanceSessionId;

    if (args.approve) {
      const note = `Student correction approved in Slack. Reason: ${correction.reason}`;

      if (correction.kind === "fix_sign_out") {
        const session = attendanceSessionId ? await ctx.db.get(attendanceSessionId) : null;

        if (!session || session.status === "void") {
          throw new Error("That attendance record was deleted. Deny this request instead.");
        }

        if (session.status !== "needs_review") {
          throw new Error(
            "That session was already fixed on the website, so this request wasn't applied. Deny it to clear it.",
          );
        }

        await ctx.db.patch(session._id, {
          status: "complete",
          signOutAt: correction.requestedSignOutAt,
          reviewedBy: reviewer.userId,
          reviewedAt: now,
          reviewNote: note,
          updatedAt: now,
        });
      } else {
        if (
          await overlapsExistingSession(
            ctx,
            correction.userId,
            correction.requestedSignInAt,
            correction.requestedSignOutAt,
          )
        ) {
          throw new Error("This now overlaps another session for that student. Fix it on the website.");
        }

        if (!correction.shopSessionId) {
          throw new Error("No shop session is attached to this request.");
        }

        attendanceSessionId = await ctx.db.insert("attendanceSessions", {
          shopSessionId: correction.shopSessionId,
          userId: correction.userId,
          profileId: correction.profileId,
          source: "manual",
          status: "complete",
          signInAt: correction.requestedSignInAt,
          signOutAt: correction.requestedSignOutAt,
          reviewedBy: reviewer.userId,
          reviewedAt: now,
          reviewNote: note,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(correction._id, {
      status: args.approve ? "approved" : "denied",
      attendanceSessionId,
      reviewedBy: reviewer.userId,
      reviewedAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.attendanceCorrections.notifyDecision, {
      correctionId: correction._id,
    });

    for (const slackUserId of await slackIdsForUser(ctx, correction.userId)) {
      await ctx.scheduler.runAfter(0, internal.slackHome.publishHome, { slackUserId });
    }

    return { status: args.approve ? "approved" : "denied", alreadyDecided: false };
  },
});

// ---------------------------------------------------------------------------
// Slack messages
// ---------------------------------------------------------------------------

export const ACTION_CORRECTION_APPROVE = "correction_approve";
export const ACTION_CORRECTION_DENY = "correction_deny";

function slackDateTime(timestamp: number) {
  const fallback = new Date(timestamp).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `<!date^${Math.floor(timestamp / 1000)}^{date_short_pretty} {time}|${fallback}>`;
}

function duration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function escape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function correctionSummary(details: CorrectionDetails) {
  const lines =
    details.kind === "fix_sign_out"
      ? [
          `*${escape(details.studentName)}* forgot to sign out and asks to fix a shop session.`,
          `*Signed in:* ${slackDateTime(details.requestedSignInAt)}`,
          details.originalSignOutAt
            ? `*Auto-closed:* ${slackDateTime(details.originalSignOutAt)}`
            : undefined,
          `*Says they left:* ${slackDateTime(details.requestedSignOutAt)} (${duration(
            details.requestedSignOutAt - details.requestedSignInAt,
          )})`,
        ]
      : [
          `*${escape(details.studentName)}* forgot to sign in and asks to add a shop session.`,
          `*Arrived:* ${slackDateTime(details.requestedSignInAt)}`,
          `*Left:* ${slackDateTime(details.requestedSignOutAt)} (${duration(
            details.requestedSignOutAt - details.requestedSignInAt,
          )})`,
        ];

  lines.push(`*Reason:* ${escape(details.reason)}`);

  return lines.filter(Boolean).join("\n");
}

function approvalBlocks(details: CorrectionDetails) {
  const blocks: Record<string, unknown>[] = [
    { type: "section", text: { type: "mrkdwn", text: correctionSummary(details) } },
  ];

  if (details.status === "pending") {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: ACTION_CORRECTION_APPROVE,
          style: "primary",
          text: { type: "plain_text", text: "Approve" },
          value: details.correctionId,
        },
        {
          type: "button",
          action_id: ACTION_CORRECTION_DENY,
          style: "danger",
          text: { type: "plain_text", text: "Deny" },
          value: details.correctionId,
        },
      ],
    });
  } else {
    const verb = details.status === "approved" ? ":white_check_mark: Approved" : ":x: Denied";
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${verb} by ${escape(details.reviewerName ?? "a mentor")}${
            details.reviewedAt ? ` · ${slackDateTime(details.reviewedAt)}` : ""
          }`,
        },
      ],
    });
  }

  return blocks;
}

export const postForApproval = internalAction({
  args: { correctionId: v.id("attendanceCorrections") },
  handler: async (ctx, args) => {
    const channel =
      process.env.SLACK_APPROVALS_CHANNEL_ID ?? process.env.SLACK_ATTENDANCE_CHANNEL_ID;

    if (!channel || !process.env.SLACK_BOT_TOKEN) {
      console.error("No SLACK_APPROVALS_CHANNEL_ID / SLACK_ATTENDANCE_CHANNEL_ID set; correction not posted.");
      return;
    }

    const details: CorrectionDetails | null = await ctx.runQuery(
      internal.attendanceCorrections.correctionDetails,
      { correctionId: args.correctionId },
    );

    if (!details) {
      return;
    }

    const result = await slackApi("chat.postMessage", {
      channel,
      text: `Time sheet request from ${details.studentName}`,
      blocks: approvalBlocks(details),
      unfurl_links: false,
    });

    if (!result.ok) {
      console.error("chat.postMessage (correction) failed", result.error);
      return;
    }

    await ctx.runMutation(internal.attendanceCorrections.saveSlackMessage, {
      correctionId: args.correctionId,
      channel: String(result.channel),
      ts: String(result.ts),
    });
  },
});

export const notifyDecision = internalAction({
  args: { correctionId: v.id("attendanceCorrections") },
  handler: async (ctx, args) => {
    if (!process.env.SLACK_BOT_TOKEN) {
      return;
    }

    const details: CorrectionDetails | null = await ctx.runQuery(
      internal.attendanceCorrections.correctionDetails,
      { correctionId: args.correctionId },
    );

    if (!details) {
      return;
    }

    if (details.slackChannelId && details.slackMessageTs) {
      const updated = await slackApi("chat.update", {
        channel: details.slackChannelId,
        ts: details.slackMessageTs,
        text: `Time sheet request from ${details.studentName}: ${details.status}`,
        blocks: approvalBlocks(details),
      });

      if (!updated.ok) {
        console.error("chat.update (correction) failed", updated.error);
      }
    }

    const what =
      details.kind === "fix_sign_out"
        ? `your sign-out time (${slackDateTime(details.requestedSignOutAt)})`
        : `your missed session (${slackDateTime(details.requestedSignInAt)} to ${slackDateTime(
            details.requestedSignOutAt,
          )})`;
    const text =
      details.status === "approved"
        ? `:white_check_mark: ${details.reviewerName ?? "A mentor"} approved ${what}. Those hours now count.`
        : `:x: ${details.reviewerName ?? "A mentor"} didn't approve ${what}. Talk to them if you think that's a mistake.`;

    for (const slackUserId of details.studentSlackUserIds) {
      const dm = await slackApi("chat.postMessage", { channel: slackUserId, text });

      if (!dm.ok) {
        console.error("DM (correction) failed", dm.error);
      }
    }
  },
});
