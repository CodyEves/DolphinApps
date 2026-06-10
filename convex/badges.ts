import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function currentProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

function canManageBadges(role: string | undefined) {
  return role === "admin" || role === "mentor" || role === "instructor";
}

async function requireBadgeManager(ctx: QueryCtx | MutationCtx) {
  const profile = await currentProfile(ctx);

  if (!canManageBadges(profile?.role)) {
    throw new Error("Only admins and mentors can manage badges.");
  }
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const profile = await currentProfile(ctx);

  if (profile?.role !== "admin") {
    throw new Error("Only admins can reset lesson progress.");
  }
}

async function collectTrackLessonIds(ctx: QueryCtx | MutationCtx, trackId: Id<"trainingTracks">) {
  const units = await ctx.db
    .query("units")
    .withIndex("by_track", (q) => q.eq("trackId", trackId))
    .collect();
  const lessons = (
    await Promise.all(
      units.map((unit) =>
        ctx.db
          .query("lessons")
          .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
          .collect(),
      ),
    )
  ).flat();

  return lessons.map((lesson) => lesson._id);
}

async function hasCompletedTrack(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  trackId: Id<"trainingTracks">,
) {
  const lessonIds = await collectTrackLessonIds(ctx, trackId);

  if (lessonIds.length === 0) {
    return false;
  }

  const completed = await ctx.db
    .query("lessonProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "completed"))
    .collect();
  const completedLessonIds = new Set(completed.map((item) => item.lessonId));

  return lessonIds.every((lessonId) => completedLessonIds.has(lessonId));
}

async function hasCompletedEquipment(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  equipmentId: Id<"equipment">,
) {
  const equipment = await ctx.db.get(equipmentId);

  if (!equipment) {
    return false;
  }

  const signOff = await ctx.db
    .query("equipmentSignOffs")
    .withIndex("by_user_equipment", (q) =>
      q.eq("userId", userId).eq("equipmentId", equipmentId),
    )
    .unique();

  return signOff?.status === "approved";
}

async function qualifiesForBadge(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  badge: {
    linkedTrackId?: Id<"trainingTracks">;
    linkedEquipmentId?: Id<"equipment">;
    requiredTrackIds?: Id<"trainingTracks">[];
    requiredEquipmentIds?: Id<"equipment">[];
  },
) {
  const requiredTrackIds = badge.requiredTrackIds ?? (badge.linkedTrackId ? [badge.linkedTrackId] : []);
  const requiredEquipmentIds =
    badge.requiredEquipmentIds ?? (badge.linkedEquipmentId ? [badge.linkedEquipmentId] : []);

  if (requiredTrackIds.length === 0 && requiredEquipmentIds.length === 0) {
    return false;
  }

  for (const trackId of requiredTrackIds) {
    if (!(await hasCompletedTrack(ctx, userId, trackId))) {
      return false;
    }
  }

  for (const equipmentId of requiredEquipmentIds) {
    if (!(await hasCompletedEquipment(ctx, userId, equipmentId))) {
      return false;
    }
  }

  return true;
}

async function collectBadgeDetails(ctx: QueryCtx | MutationCtx, badge: Awaited<ReturnType<typeof ctx.db.get<"badges">>>) {
  if (!badge) {
    return null;
  }

  const requiredTrackIds = badge.requiredTrackIds ?? (badge.linkedTrackId ? [badge.linkedTrackId] : []);
  const requiredEquipmentIds =
    badge.requiredEquipmentIds ?? (badge.linkedEquipmentId ? [badge.linkedEquipmentId] : []);
  const requiredTracks = await Promise.all(requiredTrackIds.map((trackId) => ctx.db.get(trackId)));
  const requiredEquipment = await Promise.all(
    requiredEquipmentIds.map((equipmentId) => ctx.db.get(equipmentId)),
  );

  return {
    ...badge,
    requiredTrackIds,
    requiredEquipmentIds,
    requiredTracks: requiredTracks.filter((track) => track !== null),
    requiredEquipment: requiredEquipment.filter((equipment) => equipment !== null),
  };
}

async function reconcileAutomaticBadgeAwards(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const badges = await ctx.db.query("badges").withIndex("by_active").collect();
  const activeBadges = badges.filter((badge) => badge.isActive);
  const awards = await ctx.db
    .query("userBadges")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const awardedBadgeIds: Id<"badges">[] = [];
  const revokedBadgeIds: Id<"badges">[] = [];

  for (const award of awards) {
    if (award.awardedBy !== undefined) {
      continue;
    }

    const badge = badges.find((item) => item._id === award.badgeId);

    if (!badge || !badge.isActive || !(await qualifiesForBadge(ctx, userId, badge))) {
      await ctx.db.delete(award._id);
      revokedBadgeIds.push(award.badgeId);
    }
  }

  for (const badge of activeBadges) {
    const existingAward = await ctx.db
      .query("userBadges")
      .withIndex("by_user_badge", (q) =>
        q.eq("userId", userId).eq("badgeId", badge._id),
      )
      .unique();

    if (existingAward) {
      continue;
    }

    if (await qualifiesForBadge(ctx, userId, badge)) {
      await ctx.db.insert("userBadges", {
        userId,
        badgeId: badge._id,
        earnedAt: Date.now(),
      });
      awardedBadgeIds.push(badge._id);
    }
  }

  return { awardedBadgeIds, revokedBadgeIds };
}

export const listBadges = query({
  args: {},
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);
    const canManageBadgeRecords = canManageBadges(profile?.role);
    const badges = await ctx.db.query("badges").withIndex("by_active").collect();
    const visibleBadges = canManageBadgeRecords
      ? badges
      : badges.filter((badge) => badge.isActive);

    return await Promise.all(visibleBadges.map((badge) => collectBadgeDetails(ctx, badge)));
  },
});

export const listMyBadgeAwards = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return [];
    }

    const awards = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return await Promise.all(
      awards.map(async (award) => ({
        ...award,
        badge: await ctx.db.get(award.badgeId),
      })),
    );
  },
});

export const listBadgeAwardsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireBadgeManager(ctx);

    const badges = await ctx.db.query("badges").withIndex("by_active").collect();

    return await Promise.all(
      badges.map(async (badge) => {
        const awards = await ctx.db
          .query("userBadges")
          .withIndex("by_badge", (q) => q.eq("badgeId", badge._id))
          .collect();
        const awardDetails = await Promise.all(
          awards.map(async (award) => {
            const profile = await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", award.userId))
              .unique();
            const user = await ctx.db.get(award.userId);

            return {
              ...award,
              displayName: profile?.displayName ?? user?.name,
              email: profile?.email ?? user?.email,
              role: profile?.role ?? "student",
              studentGroup: profile?.studentGroup,
            };
          }),
        );

        return {
          badge,
          awards: awardDetails.sort((a, b) =>
            (a.displayName ?? a.email ?? "").localeCompare(
              b.displayName ?? b.email ?? "",
            ),
          ),
        };
      }),
    );
  },
});

export const listAwardableUsersForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireBadgeManager(ctx);

    const profiles = await ctx.db.query("profiles").collect();
    const users = await Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);

        return {
          userId: profile.userId,
          displayName: profile.displayName ?? user?.name,
          email: profile.email ?? user?.email,
          role: profile.role,
          studentGroup: profile.studentGroup,
          status: profile.status,
        };
      }),
    );

    return users
      .filter((user) => user.status === "active")
      .sort((a, b) =>
        (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? ""),
      );
  },
});

export const getBadgeForEdit = query({
  args: {
    badgeId: v.id("badges"),
  },
  handler: async (ctx, args) => {
    await requireBadgeManager(ctx);

    const badge = await ctx.db.get(args.badgeId);
    return await collectBadgeDetails(ctx, badge);
  },
});

export const listRequirementOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireBadgeManager(ctx);

    const tracks = await ctx.db.query("trainingTracks").withIndex("by_order").collect();
    const equipment = await ctx.db.query("equipment").withIndex("by_category").collect();

    return { tracks, equipment };
  },
});

export const saveBadge = mutation({
  args: {
    badgeId: v.optional(v.id("badges")),
    title: v.string(),
    description: v.string(),
    criteriaSummary: v.string(),
    requiredTrackIds: v.array(v.id("trainingTracks")),
    requiredEquipmentIds: v.array(v.id("equipment")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireBadgeManager(ctx);

    const title = args.title.trim();
    const description = args.description.trim();
    const criteriaSummary = args.criteriaSummary.trim();

    if (!title) {
      throw new Error("Badge name is required.");
    }

    if (!description) {
      throw new Error("Badge description is required.");
    }

    if (args.requiredTrackIds.length === 0 && args.requiredEquipmentIds.length === 0) {
      throw new Error("Select at least one badge requirement.");
    }

    const now = Date.now();

    if (args.badgeId) {
      const existing = await ctx.db.get(args.badgeId);

      if (!existing) {
        throw new Error("Badge not found.");
      }

      await ctx.db.patch(args.badgeId, {
        title,
        description,
        criteriaSummary,
        requiredTrackIds: args.requiredTrackIds,
        requiredEquipmentIds: args.requiredEquipmentIds,
        linkedTrackId: args.requiredTrackIds[0],
        linkedEquipmentId: args.requiredEquipmentIds[0],
        isActive: args.isActive,
        updatedAt: now,
      });

      return args.badgeId;
    }

    return await ctx.db.insert("badges", {
      title,
      description,
      criteriaSummary,
      requiredTrackIds: args.requiredTrackIds,
      requiredEquipmentIds: args.requiredEquipmentIds,
      linkedTrackId: args.requiredTrackIds[0],
      linkedEquipmentId: args.requiredEquipmentIds[0],
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const forceAwardBadge = mutation({
  args: {
    badgeId: v.id("badges"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireBadgeManager(ctx);

    const badge = await ctx.db.get(args.badgeId);
    const user = await ctx.db.get(args.userId);

    if (!badge) {
      throw new Error("Badge not found.");
    }

    if (!user) {
      throw new Error("User not found.");
    }

    const existingAward = await ctx.db
      .query("userBadges")
      .withIndex("by_user_badge", (q) =>
        q.eq("userId", args.userId).eq("badgeId", args.badgeId),
      )
      .unique();

    if (existingAward) {
      return existingAward._id;
    }

    const actingUserId = await getAuthUserId(ctx);

    return await ctx.db.insert("userBadges", {
      userId: args.userId,
      badgeId: args.badgeId,
      earnedAt: Date.now(),
      awardedBy: actingUserId ?? undefined,
    });
  },
});

export const removeBadgeAward = mutation({
  args: {
    awardId: v.id("userBadges"),
  },
  handler: async (ctx, args) => {
    await requireBadgeManager(ctx);

    const award = await ctx.db.get(args.awardId);

    if (!award) {
      return args.awardId;
    }

    await ctx.db.delete(args.awardId);
    return args.awardId;
  },
});

export const resetUserLessonProgress = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error("User not found.");
    }

    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const item of progress) {
      await ctx.db.delete(item._id);
    }

    await reconcileAutomaticBadgeAwards(ctx, args.userId);

    return progress.length;
  },
});

export const syncMyBadges = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Sign in before syncing badges.");
    }

    const { awardedBadgeIds } = await reconcileAutomaticBadgeAwards(ctx, userId);

    return awardedBadgeIds;
  },
});
