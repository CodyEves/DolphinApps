import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

export const listTrainingTracks = query({
  args: {},
  handler: async (ctx) => {
    const tracks = await ctx.db.query("trainingTracks").withIndex("by_order").collect();

    return await Promise.all(
      tracks.map(async (track) => {
        const units = await ctx.db
          .query("units")
          .withIndex("by_track_order", (q) => q.eq("trackId", track._id))
          .collect();
        const lessons = (
          await Promise.all(
            units.map((unit) =>
              ctx.db
                .query("lessons")
                .withIndex("by_unit_order", (q) => q.eq("unitId", unit._id))
                .collect(),
            ),
          )
        ).flat();

        return { ...track, units, lessons };
      }),
    );
  },
});

export const myLessonProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const markDemoLessonComplete = mutation({
  args: {
    lessonId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Sign in before updating lesson progress.");
    }

    const lessonId = args.lessonId as Id<"lessons">;
    const lesson = await ctx.db.get(lessonId);

    if (!lesson) {
      throw new Error("Lesson not found.");
    }

    if (lesson.lessonType !== "video") {
      throw new Error("Only video lessons can be manually marked complete.");
    }

    const quiz = await ctx.db
      .query("quizzes")
      .withIndex("by_lesson", (q) => q.eq("linkedLessonId", lessonId))
      .first();

    if (quiz) {
      const questions = await ctx.db
        .query("questions")
        .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
        .collect();
      const passedAttempt = await ctx.db
        .query("quizAttempts")
        .withIndex("by_user_quiz", (q) =>
          q.eq("userId", userId).eq("quizId", quiz._id),
        )
        .filter((q) => q.eq(q.field("status"), "passed"))
        .first();

      if (questions.length > 0 && !passedAttempt) {
        throw new Error("Pass the lesson questions before marking this lesson complete.");
      }
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", userId).eq("lessonId", lessonId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("lessonProgress", {
      userId,
      lessonId,
      status: "completed",
      startedAt: now,
      completedAt: now,
      videoSecondsWatched: lesson.estimatedMinutes * 60,
      updatedAt: now,
    });
  },
});

export const resetMyLessonProgress = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Sign in before resetting lesson progress.");
    }

    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const item of progress) {
      await ctx.db.delete(item._id);
    }

    return progress.length;
  },
});
