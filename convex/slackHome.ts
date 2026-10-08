import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import {
  escapeMrkdwn,
  randomToken,
  sha256Hex,
  siteUrl,
  slackApi,
  slackApiGet,
  slackLinkUrl,
} from "./lib/slack";
import { slackLinkForSlackUser } from "./lib/slackIdentity";
import {
  displayNameFor,
  intervalMinutesWithin,
  shopAutoCloseAt,
  shopSeasonStart,
  shopWeekBounds,
} from "./shopAttendance";

// ---------------------------------------------------------------------------
// Constants shared with the interactivity handler (convex/slackEvents.ts)
// ---------------------------------------------------------------------------

export const ACTION_SHOP_SIGN_IN = "shop_sign_in";
export const ACTION_SHOP_SIGN_OUT = "shop_sign_out";
export const ACTION_HOME_REFRESH = "home_refresh";
export const ACTION_OPEN_APPS = "open_apps";
export const ACTION_CONNECT_ACCOUNT = "connect_account";
export const SHOP_CODE_MODAL = "shop_code_modal";
export const SHOP_CODE_BLOCK = "code_block";
export const SHOP_CODE_INPUT = "code_input";

const LEADERBOARD_SIZE = 5;
const LEADERBOARD_ROLES = new Set<Doc<"profiles">["role"]>(["student", "lead"]);
const MAX_LISTED_QUALS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

const PROGRAM_LABELS: Record<NonNullable<Doc<"profiles">["primaryProgram"]>, string> = {
  frc_5199: "5199 Robot Dolphins",
  frc_9271: "9271 Electromechanical Porpoises",
};

const ROLE_LABELS: Record<Doc<"profiles">["role"], string> = {
  student: "Student",
  lead: "Student lead",
  mentor: "Mentor",
  instructor: "Instructor",
  admin: "Admin",
  guest: "Guest",
  kiosk: "Kiosk",
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export type HomeData =
  | { linked: false }
  | {
      linked: true;
      name: string;
      roleLabel: string;
      programLabel?: string;
      shop: { isOpen: boolean; openedAt?: number; autoClosesAt?: number };
      me: {
        signedInAt?: number;
        weekMinutes: number;
        seasonVerifiedMinutes: number;
        seasonNeedsReviewMinutes: number;
        needsReviewCount: number;
        seasonShopDays: number;
        seasonEvents: number;
      };
      leaderboard: { name: string; minutes: number; isMe: boolean }[];
      myRank?: number;
      rankedCount: number;
      quals: { tools: string[]; badges: string[]; lessonsCompleted: number };
      generatedAt: number;
    };

async function profileForUser(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export const homeData = internalQuery({
  args: { slackUserId: v.string() },
  handler: async (ctx, args): Promise<HomeData> => {
    const link = await slackLinkForSlackUser(ctx, args.slackUserId);
    const profile = link ? await ctx.db.get(link.profileId) : null;

    if (!link || !profile || profile.status !== "active") {
      return { linked: false };
    }

    const now = Date.now();
    const userId = profile.userId;
    const user = await ctx.db.get(userId);
    const week = shopWeekBounds(now);
    const seasonStart = shopSeasonStart(now);

    // Shop status
    const activeShop = await ctx.db
      .query("shopSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();

    // My attendance this season
    const mySessions = (
      await ctx.db
        .query("attendanceSessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).filter((item) => item.status !== "void");
    const openSession = mySessions.find((item) => item.status === "open");
    let seasonVerifiedMinutes = 0;
    let seasonNeedsReviewMinutes = 0;
    let needsReviewCount = 0;
    const shopDays = new Set<Id<"shopSessions">>();

    for (const item of mySessions) {
      if (item.signInAt < seasonStart) {
        continue;
      }

      shopDays.add(item.shopSessionId);
      const minutes = item.signOutAt
        ? Math.max(0, Math.round((item.signOutAt - item.signInAt) / 60000))
        : 0;

      if (item.status === "complete") {
        seasonVerifiedMinutes += minutes;
      } else if (item.status === "needs_review") {
        seasonNeedsReviewMinutes += minutes;
        needsReviewCount += 1;
      }
    }

    const seasonEvents = (
      await ctx.db
        .query("eventAttendanceRecords")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).filter((item) => item.checkedInAt >= seasonStart).length;

    // Weekly leaderboard (same math as the shop display, students + leads only).
    // Sessions never run past the 5 AM auto-close, so looking back one day
    // before the week starts catches every session that overlaps the week.
    const weekSessions = (
      await ctx.db
        .query("attendanceSessions")
        .withIndex("by_sign_in_at", (q) => q.gte("signInAt", week.start - DAY_MS))
        .collect()
    ).filter((item) => item.status !== "void");
    const weekTotals = new Map<Id<"users">, number>();

    for (const item of weekSessions) {
      const minutes = intervalMinutesWithin(item, week.start, week.end, now);

      if (minutes > 0) {
        weekTotals.set(item.userId, (weekTotals.get(item.userId) ?? 0) + minutes);
      }
    }

    const ranked: { userId: Id<"users">; minutes: number }[] = [];

    for (const [rankedUserId, minutes] of weekTotals) {
      const rankedProfile = await profileForUser(ctx, rankedUserId);

      if (rankedProfile && LEADERBOARD_ROLES.has(rankedProfile.role)) {
        ranked.push({ userId: rankedUserId, minutes });
      }
    }

    ranked.sort((a, b) => b.minutes - a.minutes);
    const myRankIndex = ranked.findIndex((item) => item.userId === userId);
    const leaderboard = await Promise.all(
      ranked.slice(0, LEADERBOARD_SIZE).map(async (item) => {
        const rankedUser = await ctx.db.get(item.userId);
        const rankedProfile = await profileForUser(ctx, item.userId);

        return {
          name: displayNameFor(rankedProfile, rankedUser),
          minutes: item.minutes,
          isMe: item.userId === userId,
        };
      }),
    );

    // Qualifications
    const signOffs = await ctx.db
      .query("equipmentSignOffs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const tools: string[] = [];

    for (const signOff of signOffs) {
      if (signOff.status !== "approved" || (signOff.expiresAt && signOff.expiresAt <= now)) {
        continue;
      }

      const equipment = await ctx.db.get(signOff.equipmentId);

      if (equipment?.isActive) {
        tools.push(equipment.name);
      }
    }

    const userBadges = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const badges: string[] = [];

    for (const userBadge of userBadges) {
      const badge = await ctx.db.get(userBadge.badgeId);

      if (badge?.isActive) {
        badges.push(badge.title);
      }
    }

    const lessonsCompleted = (
      await ctx.db
        .query("lessonProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).filter((item) => item.status === "completed").length;

    return {
      linked: true,
      name: displayNameFor(profile, user),
      roleLabel: ROLE_LABELS[profile.role],
      programLabel: profile.primaryProgram ? PROGRAM_LABELS[profile.primaryProgram] : undefined,
      shop: activeShop
        ? {
            isOpen: true,
            openedAt: activeShop.openedAt,
            autoClosesAt: shopAutoCloseAt(activeShop.openedAt),
          }
        : { isOpen: false },
      me: {
        signedInAt: openSession?.signInAt,
        weekMinutes: weekTotals.get(userId) ?? 0,
        seasonVerifiedMinutes,
        seasonNeedsReviewMinutes,
        needsReviewCount,
        seasonShopDays: shopDays.size,
        seasonEvents,
      },
      leaderboard,
      myRank: myRankIndex >= 0 ? myRankIndex + 1 : undefined,
      rankedCount: ranked.length,
      quals: {
        tools: tools.sort((a, b) => a.localeCompare(b)),
        badges: badges.sort((a, b) => a.localeCompare(b)),
        lessonsCompleted,
      },
      generatedAt: now,
    };
  },
});

// ---------------------------------------------------------------------------
// Block Kit
// ---------------------------------------------------------------------------

type Block = Record<string, unknown>;

function mrkdwn(text: string) {
  return { type: "mrkdwn", text };
}

function plain(text: string) {
  return { type: "plain_text", text, emoji: true };
}

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(1)} h`;
}

function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Slack renders this in the viewer's own time zone. */
function slackTime(timestamp: number) {
  const fallback = new Date(timestamp).toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  });

  return `<!date^${Math.floor(timestamp / 1000)}^{time}|${fallback}>`;
}

function listOrNone(items: string[], none: string) {
  if (items.length === 0) {
    return `_${none}_`;
  }

  const shown = items.slice(0, MAX_LISTED_QUALS).map(escapeMrkdwn).join(", ");
  const extra = items.length - MAX_LISTED_QUALS;

  return extra > 0 ? `${shown} _and ${extra} more_` : shown;
}

function appsUrl(path = "/") {
  try {
    return `${siteUrl()}${path}`;
  } catch {
    return undefined;
  }
}

export function buildUnlinkedHomeView(connectUrl: string | undefined) {
  const blocks: Block[] = [
    { type: "header", text: plain("Dolphin Apps") },
    {
      type: "section",
      text: mrkdwn(
        "*Connect your Dolphin Apps account to get started.*\n" +
          "Once connected you can sign in to the shop from here, see your hours, " +
          "the weekly leaderboard, and your tool sign-offs.",
      ),
    },
  ];

  if (connectUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: ACTION_CONNECT_ACCOUNT,
          style: "primary",
          text: plain("Connect my account"),
          url: connectUrl,
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [
      mrkdwn(
        "You'll sign in to Dolphin Apps with your username and password once. " +
          "The link expires in 2 hours, so reopen this tab for a fresh one. " +
          "No account yet? Ask a mentor.",
      ),
    ],
  });

  return { type: "home", blocks };
}

export function buildHomeView(data: Extract<HomeData, { linked: true }>) {
  const blocks: Block[] = [];
  const subtitle = [data.programLabel, data.roleLabel].filter(Boolean).join(" · ");

  blocks.push(
    { type: "header", text: plain(`Hi, ${data.name}`) },
    { type: "context", elements: [mrkdwn(escapeMrkdwn(subtitle))] },
    { type: "divider" },
  );

  // --- Shop status + sign in/out ---------------------------------------
  if (data.shop.isOpen) {
    const lines = [`:large_green_circle: *Shop is open* (since ${slackTime(data.shop.openedAt!)})`];

    if (data.me.signedInAt) {
      const elapsed = Math.max(0, Math.round((data.generatedAt - data.me.signedInAt) / 60000));
      lines.push(`You're signed in since ${slackTime(data.me.signedInAt)} · ${duration(elapsed)} so far`);
    } else {
      lines.push("You're not signed in. Grab the code from a shop screen.");
    }

    blocks.push(
      { type: "section", text: mrkdwn(lines.join("\n")) },
      {
        type: "actions",
        elements: [
          data.me.signedInAt
            ? {
                type: "button",
                action_id: ACTION_SHOP_SIGN_OUT,
                text: plain("Sign out of shop"),
                value: "out",
              }
            : {
                type: "button",
                action_id: ACTION_SHOP_SIGN_IN,
                style: "primary",
                text: plain("Sign in to shop"),
                value: "in",
              },
        ],
      },
    );
  } else {
    blocks.push({
      type: "section",
      text: mrkdwn(
        data.me.signedInAt
          ? `:white_circle: *Shop is closed*, but you still have an open sign-in from ${slackTime(data.me.signedInAt)}.`
          : ":white_circle: *Shop is closed.*",
      ),
    });
  }

  blocks.push({ type: "divider" });

  // --- My hours ------------------------------------------------------------
  blocks.push({
    type: "section",
    text: mrkdwn("*Your hours*"),
    fields: [
      mrkdwn(`*This week*\n${hours(data.me.weekMinutes)}`),
      mrkdwn(`*This season (verified)*\n${hours(data.me.seasonVerifiedMinutes)}`),
      mrkdwn(`*Shop days this season*\n${data.me.seasonShopDays}`),
      mrkdwn(`*Events this season*\n${data.me.seasonEvents}`),
    ],
  });

  if (data.me.needsReviewCount > 0) {
    blocks.push({
      type: "context",
      elements: [
        mrkdwn(
          `:warning: ${data.me.needsReviewCount} session${data.me.needsReviewCount === 1 ? "" : "s"} ` +
            `(${hours(data.me.seasonNeedsReviewMinutes)}) were auto-closed because you didn't sign out. ` +
            "They don't count as verified until a mentor reviews them.",
        ),
      ],
    });
  }

  blocks.push({ type: "divider" });

  // --- Leaderboard -------------------------------------------------------
  const leaderboardLines =
    data.leaderboard.length > 0
      ? data.leaderboard.map((row, index) => {
          const line = `${index + 1}. ${escapeMrkdwn(row.name)} · ${hours(row.minutes)}`;
          return row.isMe ? `*${line}  (you)*` : line;
        })
      : ["_No shop hours logged yet this week._"];

  blocks.push({
    type: "section",
    text: mrkdwn(`*This week's leaderboard*\n${leaderboardLines.join("\n")}`),
  });

  if (data.myRank && data.myRank > LEADERBOARD_SIZE) {
    blocks.push({
      type: "context",
      elements: [mrkdwn(`You're #${data.myRank} of ${data.rankedCount} this week.`)],
    });
  }

  blocks.push({ type: "divider" });

  // --- Qualifications --------------------------------------------------
  blocks.push({
    type: "section",
    text: mrkdwn(
      [
        "*Qualifications*",
        `*Tools:* ${listOrNone(data.quals.tools, "No tool sign-offs yet")}`,
        `*Badges:* ${listOrNone(data.quals.badges, "No badges yet")}`,
        `*Lessons completed:* ${data.quals.lessonsCompleted}`,
      ].join("\n"),
    ),
  });

  // --- Footer --------------------------------------------------------------
  const footerButtons: Block[] = [
    { type: "button", action_id: ACTION_HOME_REFRESH, text: plain("Refresh") },
  ];
  const dashboardUrl = appsUrl("/dashboard");

  if (dashboardUrl) {
    footerButtons.unshift({
      type: "button",
      action_id: ACTION_OPEN_APPS,
      text: plain("Open Dolphin Apps"),
      url: dashboardUrl,
    });
  }

  blocks.push(
    { type: "divider" },
    { type: "actions", elements: footerButtons },
    {
      type: "context",
      elements: [mrkdwn(`Updated ${slackTime(data.generatedAt)}`)],
    },
  );

  return { type: "home", blocks };
}

export function buildShopCodeModal(action: "in" | "out") {
  return {
    type: "modal",
    callback_id: SHOP_CODE_MODAL,
    private_metadata: JSON.stringify({ action }),
    title: plain(action === "in" ? "Sign in to shop" : "Sign out of shop"),
    submit: plain(action === "in" ? "Sign in" : "Sign out"),
    close: plain("Cancel"),
    blocks: [
      {
        type: "input",
        block_id: SHOP_CODE_BLOCK,
        label: plain("Shop code"),
        hint: plain("It changes about every minute, so enter it right away."),
        element: {
          type: "plain_text_input",
          action_id: SHOP_CODE_INPUT,
          placeholder: plain("Code from the shop screen"),
          max_length: 32,
        },
      },
    ],
  };
}

export function buildMessageModal(title: string, text: string) {
  return {
    type: "modal",
    title: plain(title),
    close: plain("Done"),
    blocks: [{ type: "section", text: mrkdwn(text) }],
  };
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/** Rebuilds and publishes one person's Home tab. Safe to call often. */
export const publishHome = internalAction({
  args: { slackUserId: v.string() },
  handler: async (ctx, args) => {
    if (!process.env.SLACK_BOT_TOKEN) {
      return { published: false, reason: "SLACK_BOT_TOKEN not set" };
    }

    const data: HomeData = await ctx.runQuery(internal.slackHome.homeData, {
      slackUserId: args.slackUserId,
    });
    let view;

    if (data.linked) {
      view = buildHomeView(data);
    } else {
      let connectUrl: string | undefined;

      try {
        // Put the person's real Slack name on the token so the link page shows
        // whose Slack account is being connected.
        const info = await slackApiGet("users.info", { user: args.slackUserId });
        const slackUser = info.ok
          ? (info.user as { team_id?: string; real_name?: string; profile?: { real_name?: string } })
          : undefined;
        const token = randomToken();
        await ctx.runMutation(internal.shopAttendance.createSlackLinkToken, {
          tokenHash: await sha256Hex(token),
          slackUserId: args.slackUserId,
          slackTeamId: slackUser?.team_id,
          slackUserName: slackUser?.profile?.real_name || slackUser?.real_name || undefined,
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        });
        connectUrl = slackLinkUrl(token);
      } catch (error) {
        console.error("Could not create Slack link token", error);
      }

      view = buildUnlinkedHomeView(connectUrl);
    }

    const result = await slackApi("views.publish", { user_id: args.slackUserId, view });

    if (!result.ok) {
      console.error("views.publish failed", args.slackUserId, result.error, result);
    }

    return { published: result.ok, reason: result.error };
  },
});
