import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const levelValidator = v.union(
  v.literal("intro"),
  v.literal("intermediate"),
  v.literal("advanced"),
);

const lessonTypeValidator = v.union(
  v.literal("video"),
  v.literal("reading"),
  v.literal("exercise"),
);

const lessonInputValidator = v.object({
  id: v.optional(v.id("lessons")),
  title: v.string(),
  description: v.string(),
  lessonType: lessonTypeValidator,
  youtubeUrl: v.optional(v.string()),
  estimatedMinutes: v.number(),
  required: v.boolean(),
});

const unitInputValidator = v.object({
  id: v.optional(v.id("units")),
  title: v.string(),
  description: v.string(),
  isRequired: v.boolean(),
  lessons: v.array(lessonInputValidator),
});

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
    throw new Error("Only admins can manage learning tracks.");
  }

  return profile;
}

async function collectTrackTree(ctx: QueryCtx | MutationCtx, trackId: Id<"trainingTracks">) {
  const track = await ctx.db.get(trackId);

  if (!track) {
    return null;
  }

  const units = await ctx.db
    .query("units")
    .withIndex("by_track_order", (q) => q.eq("trackId", track._id))
    .collect();

  const unitsWithLessons = await Promise.all(
    units.map(async (unit) => {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_unit_order", (q) => q.eq("unitId", unit._id))
        .collect();

      return { ...unit, lessons };
    }),
  );

  return {
    ...track,
    units: unitsWithLessons,
    lessons: unitsWithLessons.flatMap((unit) => unit.lessons),
  };
}

export const listTrainingTracks = query({
  args: {},
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);
    const isAdmin = profile?.role === "admin";
    const tracks = await ctx.db.query("trainingTracks").withIndex("by_order").collect();
    const visibleTracks = isAdmin ? tracks : tracks.filter((track) => track.isPublished);

    return await Promise.all(
      visibleTracks.map(async (track) => {
        const trackTree = await collectTrackTree(ctx, track._id);

        if (!trackTree) {
          throw new Error("Learning track not found.");
        }

        return trackTree;
      }),
    );
  },
});

export const getTrainingTrackForEdit = query({
  args: {
    trackId: v.id("trainingTracks"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    return await collectTrackTree(ctx, args.trackId);
  },
});

export const saveLearningTrackDraft = mutation({
  args: {
    trackId: v.optional(v.id("trainingTracks")),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    level: levelValidator,
    units: v.array(unitInputValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const title = args.title.trim();
    const description = args.description.trim();
    const category = args.category.trim();

    if (!title) {
      throw new Error("Learning track title is required.");
    }

    if (!description) {
      throw new Error("Learning track description is required.");
    }

    if (!category) {
      throw new Error("Learning track category is required.");
    }

    const now = Date.now();
    const existingTrack = args.trackId ? await ctx.db.get(args.trackId) : null;

    if (args.trackId && !existingTrack) {
      throw new Error("Learning track not found.");
    }

    const lastTrack = await ctx.db.query("trainingTracks").withIndex("by_order").order("desc").first();
    const trackId =
      existingTrack && args.trackId
        ? args.trackId
        : await ctx.db.insert("trainingTracks", {
            title,
            description,
            category,
            level: args.level,
            order: (lastTrack?.order ?? 0) + 10,
            isPublished: false,
            createdAt: now,
            updatedAt: now,
          });

    if (existingTrack) {
      await ctx.db.patch(trackId, {
        title,
        description,
        category,
        level: args.level,
        updatedAt: now,
      });
    }

    const existingUnits = await ctx.db
      .query("units")
      .withIndex("by_track_order", (q) => q.eq("trackId", trackId))
      .collect();
    const seenUnitIds = new Set<Id<"units">>();

    for (const [unitIndex, unit] of args.units.entries()) {
      const unitTitle = unit.title.trim();
      const unitDescription = unit.description.trim();

      if (!unitTitle) {
        throw new Error("Every unit needs a title.");
      }

      const existingUnit =
        unit.id && existingUnits.some((candidate) => candidate._id === unit.id)
          ? await ctx.db.get(unit.id)
          : null;
      const unitId =
        existingUnit && unit.id
          ? unit.id
          : await ctx.db.insert("units", {
              trackId,
              title: unitTitle,
              description: unitDescription,
              order: (unitIndex + 1) * 10,
              isRequired: unit.isRequired,
              createdAt: now,
              updatedAt: now,
            });

      seenUnitIds.add(unitId);

      if (existingUnit) {
        await ctx.db.patch(unitId, {
          title: unitTitle,
          description: unitDescription,
          order: (unitIndex + 1) * 10,
          isRequired: unit.isRequired,
          updatedAt: now,
        });
      }

      const existingLessons = await ctx.db
        .query("lessons")
        .withIndex("by_unit_order", (q) => q.eq("unitId", unitId))
        .collect();
      const seenLessonIds = new Set<Id<"lessons">>();

      for (const [lessonIndex, lesson] of unit.lessons.entries()) {
        const lessonTitle = lesson.title.trim();
        const lessonDescription = lesson.description.trim();
        const youtubeUrl = lesson.youtubeUrl?.trim();

        if (!lessonTitle) {
          throw new Error("Every lesson needs a title.");
        }

        if (lesson.estimatedMinutes < 1) {
          throw new Error("Lesson estimated minutes must be at least 1.");
        }

        const existingLesson =
          lesson.id && existingLessons.some((candidate) => candidate._id === lesson.id)
            ? await ctx.db.get(lesson.id)
            : null;
        const lessonId =
          existingLesson && lesson.id
            ? lesson.id
            : await ctx.db.insert("lessons", {
                unitId,
                title: lessonTitle,
                description: lessonDescription,
                lessonType: lesson.lessonType,
                youtubeUrl: youtubeUrl || undefined,
                estimatedMinutes: lesson.estimatedMinutes,
                required: lesson.required,
                order: (lessonIndex + 1) * 10,
                createdAt: now,
                updatedAt: now,
              });

        seenLessonIds.add(lessonId);

        if (existingLesson) {
          await ctx.db.patch(lessonId, {
            title: lessonTitle,
            description: lessonDescription,
            lessonType: lesson.lessonType,
            youtubeUrl: youtubeUrl || undefined,
            estimatedMinutes: lesson.estimatedMinutes,
            required: lesson.required,
            order: (lessonIndex + 1) * 10,
            updatedAt: now,
          });
        }
      }

      for (const lesson of existingLessons) {
        if (!seenLessonIds.has(lesson._id)) {
          await ctx.db.delete(lesson._id);
        }
      }
    }

    for (const unit of existingUnits) {
      if (!seenUnitIds.has(unit._id)) {
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
          .collect();

        for (const lesson of lessons) {
          await ctx.db.delete(lesson._id);
        }

        await ctx.db.delete(unit._id);
      }
    }

    return trackId;
  },
});

export const publishLearningTrack = mutation({
  args: {
    trackId: v.id("trainingTracks"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const trackTree = await collectTrackTree(ctx, args.trackId);

    if (!trackTree) {
      throw new Error("Learning track not found.");
    }

    if (trackTree.units.length === 0) {
      throw new Error("Add at least one unit before publishing.");
    }

    if (trackTree.lessons.length === 0) {
      throw new Error("Add at least one lesson before publishing.");
    }

    await ctx.db.patch(args.trackId, {
      isPublished: true,
      updatedAt: Date.now(),
    });

    return args.trackId;
  },
});
