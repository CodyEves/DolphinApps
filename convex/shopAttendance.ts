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

const SHOP_TIME_ZONE = "America/Los_Angeles";

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

function zonedParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function timeZoneOffsetMs(timestamp: number) {
  const parts = zonedParts(timestamp);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return zonedAsUtc - timestamp;
}

function zonedDateTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstPass = utcGuess - timeZoneOffsetMs(utcGuess);

  return utcGuess - timeZoneOffsetMs(firstPass);
}

function addLocalDays(
  date: { year: number; month: number; day: number },
  days: number,
) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function shopDayBounds(timestamp = Date.now()) {
  const parts = zonedParts(timestamp);
  const start = zonedDateTimeToUtcMs(parts.year, parts.month, parts.day);
  const tomorrow = addLocalDays(parts, 1);

  return {
    start,
    end: zonedDateTimeToUtcMs(tomorrow.year, tomorrow.month, tomorrow.day),
  };
}

function shopWeekBounds(timestamp = Date.now()) {
  const parts = zonedParts(timestamp);
  const weekdayText = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIME_ZONE,
    weekday: "short",
  }).format(new Date(timestamp));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayText);
  const weekStart = addLocalDays(parts, -(weekday < 0 ? 0 : weekday));
  const weekEnd = addLocalDays(weekStart, 7);

  return {
    start: zonedDateTimeToUtcMs(weekStart.year, weekStart.month, weekStart.day),
    end: zonedDateTimeToUtcMs(weekEnd.year, weekEnd.month, weekEnd.day),
  };
}

function intervalMinutesWithin(
  item: Pick<Doc<"attendanceSessions">, "signInAt" | "signOutAt" | "status">,
  from: number,
  to: number,
  now: number,
) {
  const start = Math.max(item.signInAt, from);
  const end = Math.min(item.signOutAt ?? now, to);

  return end > start ? Math.round((end - start) / 60000) : 0;
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

function canManageShop(profile: Doc<"profiles"> | null) {
  return (
    profile?.status === "active" &&
    (profile.role === "admin" ||
      profile.role === "mentor" ||
      profile.role === "instructor")
  );
}

function canDisplayShopCode(profile: Doc<"profiles"> | null) {
  return canManageShop(profile) || (profile?.status === "active" && profile.role === "kiosk");
}

async function requireShopCodeDisplay(ctx: QueryCtx | MutationCtx) {
  const profile = await requireActiveProfile(ctx);

  if (!canDisplayShopCode(profile)) {
    throw new Error("Only shop display and mentor accounts can show attendance codes.");
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
  const shopSession = await ctx.db.get(item.shopSessionId);
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
    shopTitle: shopSession?.title,
    shopOpenedAt: shopSession?.openedAt,
    shopClosedAt: shopSession?.closedAt,
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

async function validCodeGeneratedAfter(
  ctx: QueryCtx | MutationCtx,
  codeHash: string,
  timestamp: number,
) {
  const code = await ctx.db
    .query("shopCodes")
    .withIndex("by_code_hash", (q) => q.eq("codeHash", codeHash))
    .first();

  return !!code && code.createdAt > timestamp;
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
    source: "slack" | "web" | "manual";
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

  if (!(await validCodeGeneratedAfter(ctx, codeHash, existing.signInAt))) {
    throw new Error("Use a fresh shop code to sign out.");
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
        canManage: canManageShop(profile),
        canDisplay: canDisplayShopCode(profile),
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
      canManage: canManageShop(profile),
      canDisplay: canDisplayShopCode(profile),
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
    const displayAccount = await requireShopCodeDisplay(ctx);
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
        createdBy: displayAccount.userId,
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
      source: "web",
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

export const myCurrentAttendance = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireActiveProfile(ctx);
    const open = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", profile.userId).eq("status", "open"),
      )
      .first();

    if (!open) {
      return null;
    }

    return await attendanceDetails(ctx, open);
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

export const shopDisplayStats = query({
  args: {},
  handler: async (ctx) => {
    await requireShopCodeDisplay(ctx);
    const now = Date.now();
    const day = shopDayBounds(now);
    const week = shopWeekBounds(now);
    const items = (await ctx.db.query("attendanceSessions").collect()).filter(
      (item) => item.status !== "void",
    );
    const currentCount = items.filter((item) => item.status === "open").length;
    const todayEvents = items
      .filter((item) => item.signInAt < day.end && (item.signOutAt ?? now) > day.start)
      .flatMap((item) => {
        const start = Math.max(item.signInAt, day.start);
        const end = Math.min(item.signOutAt ?? now, day.end);

        return end > start
          ? [
              { at: start, delta: 1 },
              { at: end, delta: -1 },
            ]
          : [];
      })
      .sort((a, b) => a.at - b.at || b.delta - a.delta);
    let active = 0;
    let peakToday = 0;

    for (const event of todayEvents) {
      active += event.delta;
      peakToday = Math.max(peakToday, active);
    }

    const totalsByUser = new Map<Id<"users">, number>();

    for (const item of items) {
      const minutes = intervalMinutesWithin(item, week.start, week.end, now);

      if (minutes > 0) {
        totalsByUser.set(item.userId, (totalsByUser.get(item.userId) ?? 0) + minutes);
      }
    }

    const leaderboard = await Promise.all(
      [...totalsByUser.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(async ([userId, minutes]) => {
          const user = await ctx.db.get(userId);
          const profile = await ctx.db
            .query("profiles")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .first();

          return {
            userId,
            studentName: displayNameFor(profile, user),
            minutes,
          };
        }),
    );

    return {
      currentCount,
      peakToday,
      leaderboard,
      dayStartsAt: day.start,
      weekStartsAt: week.start,
      weekEndsAt: week.end,
    };
  },
});

export const listAttendanceRecordPeople = query({
  args: {},
  handler: async (ctx) => {
    await requireShopManager(ctx);
    const profiles = (await ctx.db.query("profiles").collect()).filter(
      (profile) => profile.status === "active" && profile.role === "student",
    );

    return await Promise.all(
      profiles
        .sort((a, b) =>
          (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? ""),
        )
        .map(async (profile) => {
          const user = await ctx.db.get(profile.userId);

          return {
            userId: profile.userId,
            profileId: profile._id,
            name: displayNameFor(profile, user),
            role: profile.role,
            status: profile.status,
            studentGroup: profile.studentGroup,
            primaryProgram: profile.primaryProgram,
            graduationYear: profile.graduationYear,
          };
        }),
    );
  },
});

export const listAttendanceRecords = query({
  args: {
    userId: v.optional(v.id("users")),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireShopManager(ctx);
    const from = args.from ?? 0;
    const to = args.to ?? Number.MAX_SAFE_INTEGER;
    const items = args.userId
      ? await ctx.db
          .query("attendanceSessions")
          .withIndex("by_user", (q) => q.eq("userId", args.userId!))
          .collect()
      : await ctx.db.query("attendanceSessions").collect();

    return await Promise.all(
      items
        .filter((item) => item.signInAt >= from && item.signInAt <= to)
        .sort((a, b) => b.signInAt - a.signInAt)
        .map((item) => attendanceDetails(ctx, item)),
    );
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

export const deleteAttendanceSession = mutation({
  args: {
    attendanceSessionId: v.id("attendanceSessions"),
  },
  handler: async (ctx, args) => {
    await requireShopManager(ctx);
    const item = await ctx.db.get(args.attendanceSessionId);

    if (!item) {
      throw new Error("Attendance record not found.");
    }

    const shopSession = await ctx.db.get(item.shopSessionId);
    const sessionItems = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_session", (q) => q.eq("shopSessionId", item.shopSessionId))
      .collect();

    await ctx.db.delete(args.attendanceSessionId);

    if (
      shopSession?.title === "Manual correction" &&
      shopSession.status === "closed" &&
      sessionItems.length <= 1
    ) {
      await ctx.db.delete(shopSession._id);
    }

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
