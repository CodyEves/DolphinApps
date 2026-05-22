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
  v.literal("video_assignment"),
  v.literal("exam"),
  v.literal("reading"),
  v.literal("exercise"),
);

const questionTypeValidator = v.union(
  v.literal("multiple_choice"),
  v.literal("true_false"),
  v.literal("short_answer"),
  v.literal("fill_blank"),
  v.literal("file_upload"),
);

const questionInputValidator = v.object({
  id: v.optional(v.id("questions")),
  type: questionTypeValidator,
  prompt: v.string(),
  choices: v.optional(v.array(v.string())),
  correctAnswer: v.optional(v.string()),
  allowMultipleCorrect: v.optional(v.boolean()),
  points: v.number(),
});

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

async function getLessonQuiz(ctx: QueryCtx | MutationCtx, lessonId: Id<"lessons">) {
  return await ctx.db
    .query("quizzes")
    .withIndex("by_lesson", (q) => q.eq("linkedLessonId", lessonId))
    .first();
}

async function collectLessonContent(ctx: QueryCtx | MutationCtx, lessonId: Id<"lessons">) {
  const lesson = await ctx.db.get(lessonId);

  if (!lesson) {
    return null;
  }

  const unit = await ctx.db.get(lesson.unitId);

  if (!unit) {
    return null;
  }

  const track = await ctx.db.get(unit.trackId);

  if (!track) {
    return null;
  }

  const quiz = await getLessonQuiz(ctx, lesson._id);
  const questions = quiz
    ? await ctx.db
        .query("questions")
        .withIndex("by_quiz_order", (q) => q.eq("quizId", quiz._id))
        .collect()
    : [];

  return {
    lesson,
    unit,
    track,
    quiz,
    questions,
  };
}

async function deleteLessonQuiz(ctx: MutationCtx, lessonId: Id<"lessons">) {
  const quiz = await getLessonQuiz(ctx, lessonId);

  if (!quiz) {
    return;
  }

  const questions = await ctx.db
    .query("questions")
    .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
    .collect();

  for (const question of questions) {
    await ctx.db.delete(question._id);
  }

  await ctx.db.delete(quiz._id);
}

async function deleteLesson(ctx: MutationCtx, lessonId: Id<"lessons">) {
  await deleteLessonQuiz(ctx, lessonId);

  const progress = await ctx.db
    .query("lessonProgress")
    .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
    .collect();

  for (const item of progress) {
    await ctx.db.delete(item._id);
  }

  await ctx.db.delete(lessonId);
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

export const getTrainingTrackForStudent = query({
  args: {
    trackId: v.id("trainingTracks"),
  },
  handler: async (ctx, args) => {
    const trackTree = await collectTrackTree(ctx, args.trackId);

    if (!trackTree) {
      return null;
    }

    const profile = await currentProfile(ctx);

    if (!trackTree.isPublished && profile?.role !== "admin") {
      return null;
    }

    return trackTree;
  },
});

export const getLessonForEdit = query({
  args: {
    lessonId: v.id("lessons"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    return await collectLessonContent(ctx, args.lessonId);
  },
});

export const getLessonForStudent = query({
  args: {
    lessonId: v.id("lessons"),
  },
  handler: async (ctx, args) => {
    const content = await collectLessonContent(ctx, args.lessonId);

    if (!content) {
      return null;
    }

    const profile = await currentProfile(ctx);

    if (!content.track.isPublished && profile?.role !== "admin") {
      return null;
    }

    return content;
  },
});

export const saveTrackDetails = mutation({
  args: {
    trackId: v.optional(v.id("trainingTracks")),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    level: levelValidator,
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

    if (existingTrack && args.trackId) {
      await ctx.db.patch(args.trackId, {
        title,
        description,
        category,
        level: args.level,
        updatedAt: now,
      });

      return args.trackId;
    }

    const lastTrack = await ctx.db
      .query("trainingTracks")
      .withIndex("by_order")
      .order("desc")
      .first();

    return await ctx.db.insert("trainingTracks", {
      title,
      description,
      category,
      level: args.level,
      order: (lastTrack?.order ?? 0) + 10,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createUnit = mutation({
  args: {
    trackId: v.id("trainingTracks"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const track = await ctx.db.get(args.trackId);

    if (!track) {
      throw new Error("Learning track not found.");
    }

    const lastUnit = await ctx.db
      .query("units")
      .withIndex("by_track_order", (q) => q.eq("trackId", args.trackId))
      .order("desc")
      .first();
    const now = Date.now();

    return await ctx.db.insert("units", {
      trackId: args.trackId,
      title: "New unit",
      description: "",
      order: (lastUnit?.order ?? 0) + 10,
      isRequired: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateUnit = mutation({
  args: {
    unitId: v.id("units"),
    title: v.string(),
    description: v.string(),
    isRequired: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const unit = await ctx.db.get(args.unitId);

    if (!unit) {
      throw new Error("Unit not found.");
    }

    const title = args.title.trim();

    if (!title) {
      throw new Error("Unit title is required.");
    }

    await ctx.db.patch(args.unitId, {
      title,
      description: args.description.trim(),
      isRequired: args.isRequired,
      updatedAt: Date.now(),
    });

    return args.unitId;
  },
});

export const reorderUnits = mutation({
  args: {
    trackId: v.id("trainingTracks"),
    unitIds: v.array(v.id("units")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const track = await ctx.db.get(args.trackId);

    if (!track) {
      throw new Error("Learning track not found.");
    }

    const existingUnits = await ctx.db
      .query("units")
      .withIndex("by_track_order", (q) => q.eq("trackId", args.trackId))
      .collect();
    const existingUnitIds = new Set(existingUnits.map((unit) => unit._id));

    if (args.unitIds.length !== existingUnits.length) {
      throw new Error("Unit reorder list does not match this track.");
    }

    for (const unitId of args.unitIds) {
      if (!existingUnitIds.has(unitId)) {
        throw new Error("Unit reorder list contains a unit from another track.");
      }
    }

    const now = Date.now();

    for (const [index, unitId] of args.unitIds.entries()) {
      await ctx.db.patch(unitId, {
        order: (index + 1) * 10,
        updatedAt: now,
      });
    }

    return args.trackId;
  },
});

export const deleteUnit = mutation({
  args: {
    unitId: v.id("units"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const unit = await ctx.db.get(args.unitId);

    if (!unit) {
      return args.unitId;
    }

    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_unit", (q) => q.eq("unitId", args.unitId))
      .collect();

    for (const lesson of lessons) {
      await deleteLesson(ctx, lesson._id);
    }

    await ctx.db.delete(args.unitId);
    return args.unitId;
  },
});

export const createLesson = mutation({
  args: {
    unitId: v.id("units"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const unit = await ctx.db.get(args.unitId);

    if (!unit) {
      throw new Error("Unit not found.");
    }

    const lastLesson = await ctx.db
      .query("lessons")
      .withIndex("by_unit_order", (q) => q.eq("unitId", args.unitId))
      .order("desc")
      .first();
    const now = Date.now();

    return await ctx.db.insert("lessons", {
      unitId: args.unitId,
      title: "New lesson",
      description: "",
      lessonType: "video",
      estimatedMinutes: 15,
      required: true,
      order: (lastLesson?.order ?? 0) + 10,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const saveLesson = mutation({
  args: {
    lessonId: v.id("lessons"),
    title: v.string(),
    description: v.string(),
    lessonType: lessonTypeValidator,
    youtubeUrl: v.optional(v.string()),
    estimatedMinutes: v.number(),
    required: v.boolean(),
    passingScorePercent: v.number(),
    questions: v.array(questionInputValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lesson = await ctx.db.get(args.lessonId);

    if (!lesson) {
      throw new Error("Lesson not found.");
    }

    const title = args.title.trim();
    const description = args.description.trim();
    const youtubeUrl = args.youtubeUrl?.trim();

    if (!title) {
      throw new Error("Lesson title is required.");
    }

    if (args.estimatedMinutes < 1) {
      throw new Error("Lesson estimated minutes must be at least 1.");
    }

    await ctx.db.patch(args.lessonId, {
      title,
      description,
      lessonType: args.lessonType,
      youtubeUrl: youtubeUrl || undefined,
      estimatedMinutes: args.estimatedMinutes,
      required: args.required,
      updatedAt: Date.now(),
    });

    if (args.questions.length === 0) {
      await deleteLessonQuiz(ctx, args.lessonId);
      return args.lessonId;
    }

    if (args.passingScorePercent < 0 || args.passingScorePercent > 100) {
      throw new Error("Passing score must be between 0 and 100.");
    }

    const existingQuiz = await getLessonQuiz(ctx, args.lessonId);
    const now = Date.now();
    const quizId =
      existingQuiz?._id ??
      (await ctx.db.insert("quizzes", {
        title: `${title} assignment`,
        description: "Questions attached to this lesson.",
        linkedLessonId: args.lessonId,
        passingScorePercent: args.passingScorePercent,
        isPublished: false,
        createdAt: now,
        updatedAt: now,
      }));

    await ctx.db.patch(quizId, {
      title: `${title} assignment`,
      description: "Questions attached to this lesson.",
      passingScorePercent: args.passingScorePercent,
      updatedAt: now,
    });

    const existingQuestions = await ctx.db
      .query("questions")
      .withIndex("by_quiz_order", (q) => q.eq("quizId", quizId))
      .collect();
    const seenQuestionIds = new Set<Id<"questions">>();

    for (const [questionIndex, question] of args.questions.entries()) {
      const prompt = question.prompt.trim();
      const correctAnswer = question.correctAnswer?.trim();
      const choices = question.choices
        ?.map((choice) => choice.trim())
        .filter((choice) => choice.length > 0);

      if (!prompt) {
        throw new Error("Every question needs a prompt.");
      }

      if (question.points < 1) {
        throw new Error("Question points must be at least 1.");
      }

      if (question.type === "multiple_choice" && (!choices || choices.length < 2)) {
        throw new Error("Multiple choice questions need at least two choices.");
      }

      if (question.type === "multiple_choice") {
        const selectedAnswers = (() => {
          try {
            const parsedAnswers = correctAnswer ? JSON.parse(correctAnswer) : [];
            return Array.isArray(parsedAnswers)
              ? parsedAnswers.filter((answer): answer is string => typeof answer === "string")
              : [];
          } catch {
            return correctAnswer ? [correctAnswer] : [];
          }
        })();

        if (selectedAnswers.length === 0) {
          throw new Error("Multiple choice questions need a selected correct answer.");
        }

        if (!question.allowMultipleCorrect && selectedAnswers.length > 1) {
          throw new Error("Enable multiple correct answers before selecting more than one answer.");
        }
      }

      const existingQuestion =
        question.id && existingQuestions.some((candidate) => candidate._id === question.id)
          ? await ctx.db.get(question.id)
          : null;
      const questionId =
        existingQuestion && question.id
          ? question.id
          : await ctx.db.insert("questions", {
              quizId,
              type: question.type,
              prompt,
              choices: choices && choices.length > 0 ? choices : undefined,
              correctAnswer: correctAnswer || undefined,
              allowMultipleCorrect: question.allowMultipleCorrect,
              order: (questionIndex + 1) * 10,
              points: question.points,
            });

      seenQuestionIds.add(questionId);

      if (existingQuestion) {
        await ctx.db.patch(questionId, {
          type: question.type,
          prompt,
          choices: choices && choices.length > 0 ? choices : undefined,
          correctAnswer: correctAnswer || undefined,
          allowMultipleCorrect: question.allowMultipleCorrect,
          order: (questionIndex + 1) * 10,
          points: question.points,
        });
      }
    }

    for (const question of existingQuestions) {
      if (!seenQuestionIds.has(question._id)) {
        await ctx.db.delete(question._id);
      }
    }

    return args.lessonId;
  },
});

export const deleteLessonFromUnit = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lesson = await ctx.db.get(args.lessonId);

    if (!lesson) {
      return args.lessonId;
    }

    await deleteLesson(ctx, args.lessonId);
    return args.lessonId;
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
          await deleteLesson(ctx, lesson._id);
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
          await deleteLesson(ctx, lesson._id);
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
