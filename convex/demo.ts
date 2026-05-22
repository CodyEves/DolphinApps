import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const demoTracks = [
  {
    title: "Shop Safety",
    description: "Core safety habits for working in the robotics shop.",
    category: "safety",
    level: "intro" as const,
    order: 10,
    units: [
      {
        title: "Hand Tool Safety",
        description: "Safe tool handling, PPE, cleanup, and mentor expectations.",
        order: 10,
        lessons: [
          {
            title: "Shop orientation",
            description: "Learn where tools, PPE, first aid, and exits are located.",
            estimatedMinutes: 12,
            required: true,
            order: 10,
          },
          {
            title: "Hand tool basics",
            description: "Use common hand tools safely before moving to machines.",
            estimatedMinutes: 18,
            required: true,
            order: 20,
          },
        ],
      },
    ],
  },
  {
    title: "Electrical",
    description: "Battery safety, wiring basics, and FRC control system vocabulary.",
    category: "electrical",
    level: "intro" as const,
    order: 20,
    units: [
      {
        title: "Basic Wiring",
        description: "Start with safe batteries, tidy wiring, and labeled circuits.",
        order: 10,
        lessons: [
          {
            title: "Battery safety",
            description: "Handle, charge, transport, and inspect FRC batteries safely.",
            estimatedMinutes: 15,
            required: true,
            order: 10,
          },
        ],
      },
    ],
  },
  {
    title: "Programming",
    description: "Introductory programming path for controls and robot code.",
    category: "programming",
    level: "intro" as const,
    order: 30,
    units: [
      {
        title: "Control System Intro",
        description: "Understand the roboRIO, motor controllers, radios, and code deploys.",
        order: 10,
        lessons: [
          {
            title: "FRC control system map",
            description: "Trace the basic signal flow from driver input to robot action.",
            estimatedMinutes: 20,
            required: true,
            order: 10,
          },
        ],
      },
    ],
  },
];

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

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Sign in before seeding demo training data.");
    }

    const existing = await ctx.db.query("trainingTracks").take(1);
    if (existing.length > 0) {
      return { seeded: false };
    }

    const now = Date.now();

    for (const track of demoTracks) {
      const trackId = await ctx.db.insert("trainingTracks", {
        title: track.title,
        description: track.description,
        category: track.category,
        level: track.level,
        order: track.order,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      });

      for (const unit of track.units) {
        const unitId = await ctx.db.insert("units", {
          trackId,
          title: unit.title,
          description: unit.description,
          order: unit.order,
          isRequired: true,
          createdAt: now,
          updatedAt: now,
        });

        for (const lesson of unit.lessons) {
          await ctx.db.insert("lessons", {
            unitId,
            title: lesson.title,
            description: lesson.description,
            lessonType: "video",
            youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            estimatedMinutes: lesson.estimatedMinutes,
            required: lesson.required,
            order: lesson.order,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return { seeded: true };
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
