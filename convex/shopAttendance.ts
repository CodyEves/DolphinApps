import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const attendanceStatusValidator = v.union(
  v.literal("open"),
  v.literal("complete"),
  v.literal("needs_review"),
  v.literal("void"),
);

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function displayNameFor(profile: Doc<"profiles"> | null, user: Doc<"users"> | null) {
  return profile?.displayName ?? user?.name ?? profile?.email ?? user?.email ?? "Team member";
}

async function currentProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

async function requireActiveProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("Sign in before using shop attendance.");
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!profile || profile.status !== "active") {
    throw new Error("Your Dolphin account is not active.");
  }

  return profile;
}

async function requireShopManager(ctx: QueryCtx | MutationCtx) {
  const profile = await requireActiveProfile(ctx);

  if (
    profile.role !== "admin" &&
    profile.role !== "mentor" &&
    profile.role !== "instructor"
  ) {
    throw new Error("Only mentors, instructors, and admins can manage shop attendance.");
  }

  return profile;
}

async function activeShopSession(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("shopSessions")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .first();
}

async function attendanceDetails(ctx: QueryCtx | MutationCtx, item: Doc<"attendanceSessions">) {
  const user = await ctx.db.get(item.userId);
  const profile =
    item.profileId
      ? await ctx.db.get(item.profileId)
      : await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", item.userId))
          .first();
  const reviewedByProfile = item.reviewedBy
    ? await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", item.reviewedBy!))
        .first()
    : null;

  return {
    ...item,
    studentName: displayNameFor(profile, user),
    studentRole: profile?.role ?? "guest",
    studentGroup: profile?.studentGroup,
    primaryProgram: profile?.primaryProgram,
    graduationYear: profile?.graduationYear,
    reviewedByName: reviewedByProfile?.displayName,
  };
}

async function validCodeForActiveSession(
  ctx: QueryCtx | MutationCtx,
  code: string,
) {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    throw new Error("Enter the current shop code.");
  }

  const codeHash = await sha256Hex(normalizedCode);
  const shopCode = await ctx.db
    .query("shopCodes")
    .withIndex("by_code_hash", (q) => q.eq("codeHash", codeHash))
    .first();
  const now = Date.now();

  if (!shopCode || shopCode.expiresAt <= now) {
    throw new Error("That shop code is expired or invalid.");
  }

  const session = await ctx.db.get(shopCode.shopSessionId);

  if (!session || session.status !== "active") {
    throw new Error("There is no active shop session.");
  }

  return { session, codeHash };
}

async function activeProfileForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!profile || profile.status !== "active") {
    throw new Error("This Dolphin account is not active.");
  }

  return profile;
}

async function signInUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    source: "slack" | "manual";
    code: string;
    slackUserId?: string;
  },
) {
  const profile = await activeProfileForUser(ctx, args.userId);
  const { session, codeHash } = await validCodeForActiveSession(ctx, args.code);
  const existing = await ctx.db
    .query("attendanceSessions")
    .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "open"))
    .first();

  if (existing) {
    throw new Error("You are already signed in to the shop.");
  }

  const now = Date.now();
  const attendanceSessionId = await ctx.db.insert("attendanceSessions", {
    shopSessionId: session._id,
    userId: args.userId,
    profileId: profile._id,
    source: args.source,
    status: "open",
    signInAt: now,
    signInCodeHash: codeHash,
    ...(args.slackUserId ? { slackUserId: args.slackUserId } : {}),
    createdAt: now,
    updatedAt: now,
  });

  return { attendanceSessionId, sessionId: session._id, signedInAt: now };
}

async function signOutUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    code: string;
  },
) {
  const { session, codeHash } = await validCodeForActiveSession(ctx, args.code);
  await activeProfileForUser(ctx, args.userId);

  const existing = await ctx.db
    .query("attendanceSessions")
    .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "open"))
    .first();

  if (!existing || existing.shopSessionId !== session._id) {
    throw new Error("You do not have an open shop sign-in.");
  }

  const now = Date.now();

  await ctx.db.patch(existing._id, {
    status: "complete",
    signOutAt: now,
    signOutCodeHash: codeHash,
    updatedAt: now,
  });

  return {
    attendanceSessionId: existing._id,
    sessionId: session._id,
    signedInAt: existing.signInAt,
    signedOutAt: now,
    minutes: Math.max(0, Math.round((now - existing.signInAt) / 60000)),
  };
}

export const currentShopSession = query({
  args: {},
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);
    const session = await activeShopSession(ctx);

    if (!session) {
      return {
        session: null,
        openCount: 0,
        needsReviewCount: 0,
        canManage: profile
          ? ["admin", "mentor", "instructor"].includes(profile.role) &&
            profile.status === "active"
          : false,
      };
    }

    const open = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_session_status", (q) =>
        q.eq("shopSessionId", session._id).eq("status", "open"),
      )
      .collect();
    const needsReview = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_session_status", (q) =>
        q.eq("shopSessionId", session._id).eq("status", "needs_review"),
      )
      .collect();

    return {
      session,
      openCount: open.length,
      needsReviewCount: needsReview.length,
      canManage: profile
        ? ["admin", "mentor", "instructor"].includes(profile.role) &&
          profile.status === "active"
        : false,
    };
  },
});

export const startShopSession = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const manager = await requireShopManager(ctx);
    const existing = await activeShopSession(ctx);

    if (existing) {
      throw new Error("A shop session is already active.");
    }

    const now = Date.now();
    const title = args.title?.trim();

    return await ctx.db.insert("shopSessions", {
      ...(title ? { title } : {}),
      status: "active",
      openedBy: manager.userId,
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const endShopSession = mutation({
  args: {
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const manager = await requireShopManager(ctx);
    const session = await activeShopSession(ctx);

    if (!session) {
      throw new Error("There is no active shop session.");
    }

    const now = Date.now();
    const openAttendance = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_session_status", (q) =>
        q.eq("shopSessionId", session._id).eq("status", "open"),
      )
      .collect();

    for (const item of openAttendance) {
      await ctx.db.patch(item._id, {
        status: "needs_review",
        signOutAt: now,
        reviewedBy: manager.userId,
        reviewedAt: now,
        reviewNote: "Auto-closed when the shop session ended.",
        updatedAt: now,
      });
    }

    await ctx.db.patch(session._id, {
      status: "closed",
      closedBy: manager.userId,
      closedAt: now,
      closingNote: args.note?.trim() || undefined,
      updatedAt: now,
    });

    const completed = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_session_status", (q) =>
        q.eq("shopSessionId", session._id).eq("status", "complete"),
      )
      .collect();

    return {
      shopSessionId: session._id,
      closedAt: now,
      completedCount: completed.length,
      flaggedCount: openAttendance.length,
    };
  },
});

export const generateOrReadCurrentCode = mutation({
  args: {
    codeHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const manager = await requireShopManager(ctx);
    const session = await activeShopSession(ctx);
    const now = Date.now();

    if (!session) {
      throw new Error("Start a shop session before generating a code.");
    }

    if (args.expiresAt <= now || args.expiresAt > now + 2 * 60 * 1000) {
      throw new Error("Shop codes must expire within the next two minutes.");
    }

    const existing = await ctx.db
      .query("shopCodes")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", args.codeHash))
      .first();

    if (!existing) {
      await ctx.db.insert("shopCodes", {
        shopSessionId: session._id,
        codeHash: args.codeHash,
        expiresAt: args.expiresAt,
        createdBy: manager.userId,
        createdAt: now,
      });
    }

    return {
      shopSessionId: session._id,
      expiresAt: args.expiresAt,
    };
  },
});

export const signInWithCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);

    return await signInUser(ctx, {
      userId: profile.userId,
      source: "manual",
      code: args.code,
    });
  },
});

export const signOutWithCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);

    return await signOutUser(ctx, {
      userId: profile.userId,
      code: args.code,
    });
  },
});

export const listCurrentAttendance = query({
  args: {},
  handler: async (ctx) => {
    await requireShopManager(ctx);
    const session = await activeShopSession(ctx);

    if (!session) {
      return [];
    }

    const items = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_session", (q) => q.eq("shopSessionId", session._id))
      .collect();
    const activeItems = items
      .filter((item) => item.status === "open" || item.status === "needs_review")
      .sort((a, b) => a.signInAt - b.signInAt);

    return await Promise.all(activeItems.map((item) => attendanceDetails(ctx, item)));
  },
});

export const listReviewQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireShopManager(ctx);
    const items = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_status", (q) => q.eq("status", "needs_review"))
      .collect();

    return await Promise.all(
      items
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((item) => attendanceDetails(ctx, item)),
    );
  },
});

export const listHoursReport = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireShopManager(ctx);
    const from = args.from ?? 0;
    const to = args.to ?? Number.MAX_SAFE_INTEGER;
    const items = (await ctx.db.query("attendanceSessions").collect())
      .filter((item) => item.signInAt >= from && item.signInAt <= to)
      .filter((item) => item.status !== "open" && item.status !== "void")
      .sort((a, b) => b.signInAt - a.signInAt);
    const rows = await Promise.all(items.map((item) => attendanceDetails(ctx, item)));
    const totalsByUser = new Map<
      string,
      {
        userId: Id<"users">;
        studentName: string;
        minutes: number;
        completeMinutes: number;
        needsReviewMinutes: number;
        sessionCount: number;
      }
    >();

    for (const row of rows) {
      const minutes = row.signOutAt
        ? Math.max(0, Math.round((row.signOutAt - row.signInAt) / 60000))
        : 0;
      const existing =
        totalsByUser.get(row.userId) ??
        {
          userId: row.userId,
          studentName: row.studentName,
          minutes: 0,
          completeMinutes: 0,
          needsReviewMinutes: 0,
          sessionCount: 0,
        };

      existing.minutes += minutes;
      existing.sessionCount += 1;

      if (row.status === "needs_review") {
        existing.needsReviewMinutes += minutes;
      } else {
        existing.completeMinutes += minutes;
      }

      totalsByUser.set(row.userId, existing);
    }

    return {
      rows,
      totals: [...totalsByUser.values()].sort((a, b) =>
        a.studentName.localeCompare(b.studentName),
      ),
    };
  },
});

export const listPeopleForManualAttendance = query({
  args: {},
  handler: async (ctx) => {
    await requireShopManager(ctx);
    const profiles = (await ctx.db.query("profiles").collect())
      .filter((profile) => profile.status === "active")
      .sort((a, b) =>
        (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? ""),
      );

    return await Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);

        return {
          userId: profile.userId,
          profileId: profile._id,
          name: displayNameFor(profile, user),
          role: profile.role,
          studentGroup: profile.studentGroup,
          graduationYear: profile.graduationYear,
        };
      }),
    );
  },
});

export const createManualAttendanceSession = mutation({
  args: {
    userId: v.id("users"),
    signInAt: v.number(),
    signOutAt: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const manager = await requireShopManager(ctx);
    const profile = await activeProfileForUser(ctx, args.userId);

    if (args.signOutAt <= args.signInAt) {
      throw new Error("Sign-out time must be after sign-in time.");
    }

    const now = Date.now();
    const session = await ctx.db.insert("shopSessions", {
      title: "Manual correction",
      status: "closed",
      openedBy: manager.userId,
      openedAt: args.signInAt,
      closedBy: manager.userId,
      closedAt: args.signOutAt,
      closingNote: args.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.insert("attendanceSessions", {
      shopSessionId: session,
      userId: args.userId,
      profileId: profile._id,
      source: "manual",
      status: "complete",
      signInAt: args.signInAt,
      signOutAt: args.signOutAt,
      reviewedBy: manager.userId,
      reviewedAt: now,
      reviewNote: args.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const reviewAttendanceSession = mutation({
  args: {
    attendanceSessionId: v.id("attendanceSessions"),
    status: attendanceStatusValidator,
    signInAt: v.optional(v.number()),
    signOutAt: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const manager = await requireShopManager(ctx);
    const item = await ctx.db.get(args.attendanceSessionId);

    if (!item) {
      throw new Error("Attendance record not found.");
    }

    const signInAt = args.signInAt ?? item.signInAt;
    const signOutAt = args.signOutAt ?? item.signOutAt;

    if (
      (args.status === "complete" || args.status === "needs_review") &&
      (!signOutAt || signOutAt <= signInAt)
    ) {
      throw new Error("A reviewed attendance record needs a valid sign-out time.");
    }

    await ctx.db.patch(args.attendanceSessionId, {
      status: args.status,
      signInAt,
      signOutAt: args.status === "open" ? undefined : signOutAt,
      reviewedBy: manager.userId,
      reviewedAt: Date.now(),
      reviewNote: args.note?.trim() || undefined,
      updatedAt: Date.now(),
    });

    return args.attendanceSessionId;
  },
});

export const getSlackLinkPreview = query({
  args: {
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("slackLinkTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!token || token.consumedAt || token.expiresAt <= Date.now()) {
      return null;
    }

    return {
      slackUserName: token.slackUserName,
      slackUserId: token.slackUserId,
      expiresAt: token.expiresAt,
    };
  },
});

export const mySlackLink = query({
  args: {},
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);

    if (!profile) {
      return null;
    }

    return await ctx.db
      .query("slackAccountLinks")
      .withIndex("by_user", (q) => q.eq("userId", profile.userId))
      .first();
  },
});

export const linkMySlackAccount = mutation({
  args: {
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    const token = await ctx.db
      .query("slackLinkTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!token || token.consumedAt || token.expiresAt <= Date.now()) {
      throw new Error("This Slack link is expired or invalid.");
    }

    const now = Date.now();
    const existingBySlack = await ctx.db
      .query("slackAccountLinks")
      .withIndex("by_slack_user", (q) => q.eq("slackUserId", token.slackUserId))
      .first();

    if (existingBySlack) {
      await ctx.db.patch(existingBySlack._id, {
        slackTeamId: token.slackTeamId,
        slackUserName: token.slackUserName,
        userId: profile.userId,
        profileId: profile._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("slackAccountLinks", {
        slackUserId: token.slackUserId,
        slackTeamId: token.slackTeamId,
        slackUserName: token.slackUserName,
        userId: profile.userId,
        profileId: profile._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(token._id, {
      consumedAt: now,
    });

    return token.slackUserId;
  },
});

export const createSlackLinkToken = internalMutation({
  args: {
    tokenHash: v.string(),
    slackUserId: v.string(),
    slackTeamId: v.optional(v.string()),
    slackUserName: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("slackLinkTokens", {
      tokenHash: args.tokenHash,
      slackUserId: args.slackUserId,
      slackTeamId: args.slackTeamId,
      slackUserName: args.slackUserName,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const slackSignInWithCode = internalMutation({
  args: {
    slackUserId: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("slackAccountLinks")
      .withIndex("by_slack_user", (q) => q.eq("slackUserId", args.slackUserId))
      .first();

    if (!link) {
      throw new Error("SLACK_LINK_REQUIRED");
    }

    return await signInUser(ctx, {
      userId: link.userId,
      source: "slack",
      code: args.code,
      slackUserId: args.slackUserId,
    });
  },
});

export const slackSignOutWithCode = internalMutation({
  args: {
    slackUserId: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("slackAccountLinks")
      .withIndex("by_slack_user", (q) => q.eq("slackUserId", args.slackUserId))
      .first();

    if (!link) {
      throw new Error("SLACK_LINK_REQUIRED");
    }

    return await signOutUser(ctx, {
      userId: link.userId,
      code: args.code,
    });
  },
});
