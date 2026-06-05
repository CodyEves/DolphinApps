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
  v.literal("paragraph"),
  v.literal("fill_blank"),
  v.literal("file_upload"),
  v.literal("number"),
  v.literal("linear_scale"),
  v.literal("matching"),
  v.literal("ordering"),
  v.literal("url"),
);

const questionInputValidator = v.object({
  id: v.optional(v.id("questions")),
  type: questionTypeValidator,
  prompt: v.string(),
  choices: v.optional(v.array(v.string())),
  correctAnswer: v.optional(v.string()),
  allowMultipleCorrect: v.optional(v.boolean()),
  matchingPairs: v.optional(
    v.array(v.object({ prompt: v.string(), answer: v.string() })),
  ),
  scaleMin: v.optional(v.number()),
  scaleMax: v.optional(v.number()),
  scaleMinLabel: v.optional(v.string()),
  scaleMaxLabel: v.optional(v.string()),
  answerPlaceholder: v.optional(v.string()),
  points: v.number(),
});

const lessonResourceInputValidator = v.object({
  id: v.optional(v.id("lessonResources")),
  resourceType: v.union(v.literal("link"), v.literal("file"), v.literal("note")),
  title: v.string(),
  url: v.optional(v.string()),
  notes: v.optional(v.string()),
});

const answerInputValidator = v.object({
  questionId: v.id("questions"),
  answer: v.string(),
});

export const generateLessonUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);

    if (!profile || profile.status !== "active") {
      throw new Error("Your team profile is not active.");
    }

    return await ctx.storage.generateUploadUrl();
  },
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

  if (profile?.role !== "admin" || profile.status !== "active") {
    throw new Error("Only admins can manage learning tracks.");
  }

  return profile;
}

async function requireActiveProfile(ctx: QueryCtx | MutationCtx) {
  const profile = await currentProfile(ctx);

  if (!profile || profile.status !== "active") {
    throw new Error("Your team profile is not active.");
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
  const resources = await ctx.db
    .query("lessonResources")
    .withIndex("by_lesson_order", (q) => q.eq("lessonId", lesson._id))
    .collect();

  return {
    lesson,
    unit,
    track,
    quiz,
    questions,
    resources,
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

  const resources = await ctx.db
    .query("lessonResources")
    .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
    .collect();

  for (const resource of resources) {
    await ctx.db.delete(resource._id);
  }

  const progress = await ctx.db
    .query("lessonProgress")
    .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
    .collect();

  for (const item of progress) {
    await ctx.db.delete(item._id);
  }

  await ctx.db.delete(lessonId);
}

function normalizeAnswer(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function parseAnswerList(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map(normalizeAnswer)
        .sort();
    }
  } catch {
    return [normalizeAnswer(value)];
  }

  return [normalizeAnswer(value)];
}

function parseOrderedAnswerList(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map(normalizeAnswer);
    }
  } catch {
    return [normalizeAnswer(value)];
  }

  return [normalizeAnswer(value)];
}

function needsManualReview(question: { type: string; correctAnswer?: string }) {
  return (
    question.type === "file_upload" ||
    question.type === "paragraph" ||
    (question.type === "short_answer" && !question.correctAnswer) ||
    (question.type === "url" && !question.correctAnswer)
  );
}

function answerMatches(question: { type: string; correctAnswer?: string }, answer: string) {
  if (question.type === "multiple_choice") {
    const expected = parseAnswerList(question.correctAnswer);
    const submitted = parseAnswerList(answer);

    return (
      expected.length === submitted.length &&
      expected.every((expectedAnswer, index) => expectedAnswer === submitted[index])
    );
  }

  if (question.type === "ordering" || question.type === "matching") {
    const expected = parseOrderedAnswerList(question.correctAnswer);
    const submitted = parseOrderedAnswerList(answer);

    return (
      expected.length === submitted.length &&
      expected.every((expectedAnswer, index) => expectedAnswer === submitted[index])
    );
  }

  if (question.type === "number") {
    return Number(question.correctAnswer) === Number(answer);
  }

  return normalizeAnswer(question.correctAnswer) === normalizeAnswer(answer);
}

export const listTrainingTracks = query({
  args: {},
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);
    const isAdmin = profile?.role === "admin" && profile.status === "active";
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

    if (!trackTree.isPublished && (profile?.role !== "admin" || profile.status !== "active")) {
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

    if (!content.track.isPublished && (profile?.role !== "admin" || profile.status !== "active")) {
      return null;
    }

    const userId = await getAuthUserId(ctx);
    const latestQuizAttempt =
      content.quiz && userId
        ? await ctx.db
            .query("quizAttempts")
            .withIndex("by_user_quiz", (q) =>
              q.eq("userId", userId).eq("quizId", content.quiz!._id),
            )
            .order("desc")
            .first()
        : null;

    return {
      ...content,
      latestQuizAttempt,
    };
  },
});

export const submitLessonQuiz = mutation({
  args: {
    lessonId: v.id("lessons"),
    answers: v.array(answerInputValidator),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    const userId = profile.userId;

    const content = await collectLessonContent(ctx, args.lessonId);

    if (!content) {
      throw new Error("Lesson not found.");
    }

    if (!content.track.isPublished) {
      if (profile?.role !== "admin") {
        throw new Error("This lesson is not available yet.");
      }
    }

    if (!content.quiz) {
      throw new Error("No questions are available for this lesson.");
    }

    const existingPassedAttempt = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user_quiz", (q) =>
        q.eq("userId", userId).eq("quizId", content.quiz!._id),
      )
      .filter((q) => q.eq(q.field("status"), "passed"))
      .first();

    if (existingPassedAttempt) {
      throw new Error("You have already passed these questions.");
    }

    if (content.questions.length === 0) {
      throw new Error("No questions are available for this lesson.");
    }

    const answersByQuestionId = new Map(
      args.answers.map((answer) => [answer.questionId, answer.answer]),
    );
    const reviewQuestions = content.questions.filter(needsManualReview);
    const hasReviewQuestions = reviewQuestions.length > 0;
    const totalPoints = content.questions.reduce(
      (total, question) => total + question.points,
      0,
    );
    let earnedPoints = 0;

    for (const question of content.questions) {
      const answer = answersByQuestionId.get(question._id);

      if (!answer) {
        continue;
      }

      if (needsManualReview(question)) {
        earnedPoints += question.points;
        continue;
      }

      if (answerMatches(question, answer)) {
        earnedPoints += question.points;
      }
    }

    if (hasReviewQuestions) {
      const now = Date.now();
      const attemptId = await ctx.db.insert("quizAttempts", {
        quizId: content.quiz._id,
        userId,
        status: "in_progress",
        answers: args.answers,
        startedAt: now,
      });

      for (const question of reviewQuestions) {
        const answer = answersByQuestionId.get(question._id);

        if (!answer) {
          continue;
        }

        await ctx.db.insert("exerciseSubmissions", {
          userId,
          lessonId: args.lessonId,
          prompt: question.prompt,
          response: answer,
          status: "submitted",
          createdAt: now,
          updatedAt: now,
        });
      }

      return {
        attemptId,
        status: "submitted",
        scorePercent: undefined,
      };
    }

    const scorePercent =
      totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const status = scorePercent >= content.quiz.passingScorePercent ? "passed" : "failed";
    const now = Date.now();
    const attemptId = await ctx.db.insert("quizAttempts", {
      quizId: content.quiz._id,
      userId,
      status,
      scorePercent,
      answers: args.answers,
      startedAt: now,
      completedAt: now,
    });

    if (status === "passed") {
      const existingProgress = await ctx.db
        .query("lessonProgress")
        .withIndex("by_user_lesson", (q) =>
          q.eq("userId", userId).eq("lessonId", args.lessonId),
        )
        .unique();

      if (existingProgress) {
        await ctx.db.patch(existingProgress._id, {
          status: "completed",
          completedAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("lessonProgress", {
          userId,
          lessonId: args.lessonId,
          status: "completed",
          startedAt: now,
          completedAt: now,
          videoSecondsWatched: content.lesson.estimatedMinutes * 60,
          updatedAt: now,
        });
      }
    }

    return {
      attemptId,
      status,
      scorePercent,
    };
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
    resources: v.array(lessonResourceInputValidator),
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

    const existingResources = await ctx.db
      .query("lessonResources")
      .withIndex("by_lesson_order", (q) => q.eq("lessonId", args.lessonId))
      .collect();
    const seenResourceIds = new Set<Id<"lessonResources">>();
    const now = Date.now();

    for (const [resourceIndex, resource] of args.resources.entries()) {
      const resourceTitle = resource.title.trim();
      const resourceUrl = resource.url?.trim();
      const resourceNotes = resource.notes?.trim();

      if (!resourceTitle) {
        throw new Error("Every material needs a title.");
      }

      if (
        (resource.resourceType === "link" || resource.resourceType === "file") &&
        !resourceUrl
      ) {
        throw new Error("Links and file resources need a URL.");
      }

      const existingResource =
        resource.id &&
        existingResources.some((candidate) => candidate._id === resource.id)
          ? await ctx.db.get(resource.id)
          : null;
      const resourceId =
        existingResource && resource.id
          ? resource.id
          : await ctx.db.insert("lessonResources", {
              lessonId: args.lessonId,
              resourceType: resource.resourceType,
              title: resourceTitle,
              url: resourceUrl || undefined,
              notes: resourceNotes || undefined,
              order: (resourceIndex + 1) * 10,
              createdAt: now,
              updatedAt: now,
            });

      seenResourceIds.add(resourceId);

      if (existingResource) {
        await ctx.db.patch(resourceId, {
          resourceType: resource.resourceType,
          title: resourceTitle,
          url: resourceUrl || undefined,
          notes: resourceNotes || undefined,
          order: (resourceIndex + 1) * 10,
          updatedAt: now,
        });
      }
    }

    for (const resource of existingResources) {
      if (!seenResourceIds.has(resource._id)) {
        await ctx.db.delete(resource._id);
      }
    }

    if (args.questions.length === 0) {
      await deleteLessonQuiz(ctx, args.lessonId);
      return args.lessonId;
    }

    if (args.passingScorePercent < 0 || args.passingScorePercent > 100) {
      throw new Error("Passing score must be between 0 and 100.");
    }

    const existingQuiz = await getLessonQuiz(ctx, args.lessonId);
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
      const matchingPairs = question.matchingPairs
        ?.map((pair) => ({
          prompt: pair.prompt.trim(),
          answer: pair.answer.trim(),
        }))
        .filter((pair) => pair.prompt.length > 0 && pair.answer.length > 0);
      const answerPlaceholder = question.answerPlaceholder?.trim();

      if (!prompt) {
        throw new Error("Every question needs a prompt.");
      }

      if (question.points < 1) {
        throw new Error("Question points must be at least 1.");
      }

      if (question.type === "multiple_choice" && (!choices || choices.length < 2)) {
        throw new Error("Multiple choice questions need at least two choices.");
      }

      if (question.type === "ordering" && (!choices || choices.length < 2)) {
        throw new Error("Ordering questions need at least two items.");
      }

      if (question.type === "matching" && (!matchingPairs || matchingPairs.length < 2)) {
        throw new Error("Matching questions need at least two pairs.");
      }

      if (
        question.type === "linear_scale" &&
        (question.scaleMin === undefined ||
          question.scaleMax === undefined ||
          question.scaleMax <= question.scaleMin)
      ) {
        throw new Error("Linear scale questions need a valid range.");
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

      if (
        ["true_false", "fill_blank", "number", "linear_scale", "matching", "ordering"].includes(
          question.type,
        ) &&
        !correctAnswer
      ) {
        throw new Error("Auto-graded questions need a correct answer.");
      }

      const questionPatch = {
        type: question.type,
        prompt,
        choices: choices && choices.length > 0 ? choices : undefined,
        correctAnswer: correctAnswer || undefined,
        allowMultipleCorrect: question.allowMultipleCorrect,
        matchingPairs:
          matchingPairs && matchingPairs.length > 0 ? matchingPairs : undefined,
        scaleMin: question.scaleMin,
        scaleMax: question.scaleMax,
        scaleMinLabel: question.scaleMinLabel?.trim() || undefined,
        scaleMaxLabel: question.scaleMaxLabel?.trim() || undefined,
        answerPlaceholder: answerPlaceholder || undefined,
        order: (questionIndex + 1) * 10,
        points: question.points,
      };

      const existingQuestion =
        question.id && existingQuestions.some((candidate) => candidate._id === question.id)
          ? await ctx.db.get(question.id)
          : null;
      const questionId =
        existingQuestion && question.id
          ? question.id
          : await ctx.db.insert("questions", {
              quizId,
              ...questionPatch,
            });

      seenQuestionIds.add(questionId);

      if (existingQuestion) {
        await ctx.db.patch(questionId, questionPatch);
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

async function deleteAllTrainingContentRecords(ctx: MutationCtx) {
  const tracks = await ctx.db.query("trainingTracks").collect();
  let deletedLessons = 0;
  let deletedUnits = 0;

  for (const track of tracks) {
    const units = await ctx.db
      .query("units")
      .withIndex("by_track", (q) => q.eq("trackId", track._id))
      .collect();

    for (const unit of units) {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
        .collect();

      for (const lesson of lessons) {
        await deleteLesson(ctx, lesson._id);
        deletedLessons += 1;
      }

      await ctx.db.delete(unit._id);
      deletedUnits += 1;
    }

    await ctx.db.delete(track._id);
  }

  return {
    deletedTracks: tracks.length,
    deletedUnits,
    deletedLessons,
  };
}

export const deleteAllTrainingContent = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return await deleteAllTrainingContentRecords(ctx);
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
