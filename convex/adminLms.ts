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

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const profile = await currentProfile(ctx);

  if (profile?.role !== "admin") {
    throw new Error("Only admins can manage LMS progress.");
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

  return !equipment.instructorApprovalRequired || signOff?.status === "approved";
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

async function revokeUnqualifiedAutomaticBadges(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const awards = await ctx.db
    .query("userBadges")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let revokedCount = 0;

  for (const award of awards) {
    if (award.awardedBy !== undefined) {
      continue;
    }

    const badge = await ctx.db.get(award.badgeId);

    if (!badge || !badge.isActive || !(await qualifiesForBadge(ctx, userId, badge))) {
      await ctx.db.delete(award._id);
      revokedCount += 1;
    }
  }

  return revokedCount;
}

async function collectQuizIdsForTrack(ctx: QueryCtx | MutationCtx, trackId: Id<"trainingTracks">) {
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
  const lessonQuizzes = (
    await Promise.all(
      lessons.map((lesson) =>
        ctx.db
          .query("quizzes")
          .withIndex("by_lesson", (q) => q.eq("linkedLessonId", lesson._id))
          .collect(),
      ),
    )
  ).flat();
  const allQuizzes = await ctx.db.query("quizzes").collect();
  const unitIds = new Set(units.map((unit) => unit._id));
  const unitQuizzes = allQuizzes.filter(
    (quiz) => quiz.linkedUnitId && unitIds.has(quiz.linkedUnitId),
  );

  return [...lessonQuizzes, ...unitQuizzes].map((quiz) => quiz._id);
}

async function deleteQuizAttemptsForUserQuiz(
  ctx: MutationCtx,
  userId: Id<"users">,
  quizId: Id<"quizzes">,
) {
  const attempts = await ctx.db
    .query("quizAttempts")
    .withIndex("by_user_quiz", (q) => q.eq("userId", userId).eq("quizId", quizId))
    .collect();

  for (const attempt of attempts) {
    await ctx.db.delete(attempt._id);
  }

  return attempts.length;
}

export const getUserProgressForAdmin = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) {
      throw new Error("User not found.");
    }

    const lessonProgress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const lessonDetails = (
      await Promise.all(
        lessonProgress.map(async (progress) => {
          const lesson = await ctx.db.get(progress.lessonId);
          const unit = lesson ? await ctx.db.get(lesson.unitId) : null;
          const track = unit ? await ctx.db.get(unit.trackId) : null;

          if (!lesson || !unit || !track) {
            return null;
          }

          return {
            ...progress,
            lessonTitle: lesson.title,
            unitTitle: unit.title,
            trackId: track._id,
            trackTitle: track.title,
          };
        }),
      )
    )
      .filter((item) => item !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const tracks = await ctx.db.query("trainingTracks").withIndex("by_order").collect();
    const trackProgress = (
      await Promise.all(
        tracks.map(async (track) => {
          const lessonIds = await collectTrackLessonIds(ctx, track._id);
          const trackLessonIdSet = new Set(lessonIds);
          const progressItems = lessonProgress.filter((progress) =>
            trackLessonIdSet.has(progress.lessonId),
          );

          if (progressItems.length === 0) {
            return null;
          }

          const completedLessonCount = progressItems.filter(
            (progress) => progress.status === "completed",
          ).length;

          return {
            trackId: track._id,
            title: track.title,
            category: track.category,
            lessonCount: lessonIds.length,
            startedLessonCount: progressItems.length,
            completedLessonCount,
            isComplete: lessonIds.length > 0 && completedLessonCount === lessonIds.length,
          };
        }),
      )
    ).filter((item) => item !== null);

    const quizAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const quizAttemptDetails = (
      await Promise.all(
        quizAttempts.map(async (attempt) => {
          const quiz = await ctx.db.get(attempt.quizId);

          if (!quiz) {
            return null;
          }

          const lesson = quiz.linkedLessonId ? await ctx.db.get(quiz.linkedLessonId) : null;
          const lessonUnit = lesson ? await ctx.db.get(lesson.unitId) : null;
          const unit = quiz.linkedUnitId ? await ctx.db.get(quiz.linkedUnitId) : lessonUnit;
          const track = unit ? await ctx.db.get(unit.trackId) : null;
          const equipment = quiz.linkedEquipmentId
            ? await ctx.db.get(quiz.linkedEquipmentId)
            : null;

          return {
            ...attempt,
            quizTitle: quiz.title,
            contextTitle: equipment?.name ?? lesson?.title ?? unit?.title ?? track?.title,
            contextType: equipment
              ? "Equipment safety test"
              : lesson
                ? "Lesson test"
                : unit
                  ? "Unit test"
                  : "Test",
          };
        }),
      )
    )
      .filter((item) => item !== null)
      .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));

    const signOffs = await ctx.db
      .query("equipmentSignOffs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const signOffDetails = (
      await Promise.all(
        signOffs.map(async (signOff) => {
          const equipment = await ctx.db.get(signOff.equipmentId);

          if (!equipment) {
            return null;
          }

          return {
            ...signOff,
            equipmentName: equipment.name,
          };
        }),
      )
    )
      .filter((item) => item !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    return {
      user: {
        userId: args.userId,
        displayName: profile?.displayName ?? user.name,
        email: profile?.email ?? user.email,
        role: profile?.role ?? "student",
        studentGroup: profile?.studentGroup,
      },
      lessonProgress: lessonDetails,
      trackProgress,
      quizAttempts: quizAttemptDetails,
      equipmentSignOffs: signOffDetails,
    };
  },
});

export const removeLessonProgressForAdmin = mutation({
  args: {
    progressId: v.id("lessonProgress"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const progress = await ctx.db.get(args.progressId);

    if (!progress) {
      return args.progressId;
    }

    await ctx.db.delete(args.progressId);
    await revokeUnqualifiedAutomaticBadges(ctx, progress.userId);

    return args.progressId;
  },
});

export const resetTrackProgressForAdmin = mutation({
  args: {
    userId: v.id("users"),
    trackId: v.id("trainingTracks"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lessonIds = await collectTrackLessonIds(ctx, args.trackId);
    const quizIds = await collectQuizIdsForTrack(ctx, args.trackId);
    let removedCount = 0;

    for (const lessonId of lessonIds) {
      const progress = await ctx.db
        .query("lessonProgress")
        .withIndex("by_user_lesson", (q) =>
          q.eq("userId", args.userId).eq("lessonId", lessonId),
        )
        .unique();

      if (progress) {
        await ctx.db.delete(progress._id);
        removedCount += 1;
      }
    }

    for (const quizId of quizIds) {
      removedCount += await deleteQuizAttemptsForUserQuiz(ctx, args.userId, quizId);
    }

    await revokeUnqualifiedAutomaticBadges(ctx, args.userId);

    return removedCount;
  },
});

export const removeQuizAttemptForAdmin = mutation({
  args: {
    attemptId: v.id("quizAttempts"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const attempt = await ctx.db.get(args.attemptId);

    if (!attempt) {
      return args.attemptId;
    }

    await ctx.db.delete(args.attemptId);
    await revokeUnqualifiedAutomaticBadges(ctx, attempt.userId);

    return args.attemptId;
  },
});

export const removeEquipmentSignOffForAdmin = mutation({
  args: {
    signOffId: v.id("equipmentSignOffs"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const signOff = await ctx.db.get(args.signOffId);

    if (!signOff) {
      return args.signOffId;
    }

    await ctx.db.delete(args.signOffId);
    await revokeUnqualifiedAutomaticBadges(ctx, signOff.userId);

    return args.signOffId;
  },
});
