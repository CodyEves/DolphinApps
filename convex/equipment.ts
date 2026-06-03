import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

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

const answerInputValidator = v.object({
  questionId: v.id("questions"),
  answer: v.string(),
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
    throw new Error("Only admins can manage equipment.");
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

async function getEquipmentQuiz(ctx: QueryCtx | MutationCtx, equipmentId: Id<"equipment">) {
  return await ctx.db
    .query("quizzes")
    .withIndex("by_equipment", (q) => q.eq("linkedEquipmentId", equipmentId))
    .first();
}

async function deleteEquipmentQuiz(ctx: MutationCtx, equipmentId: Id<"equipment">) {
  const quiz = await getEquipmentQuiz(ctx, equipmentId);

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

async function collectEquipmentRecord(
  ctx: QueryCtx | MutationCtx,
  equipmentId: Id<"equipment">,
  includeAllSignOffs: boolean,
  currentUserId: Id<"users"> | null,
) {
  const equipment = await ctx.db.get(equipmentId);

  if (!equipment) {
    return null;
  }

  const quiz = await getEquipmentQuiz(ctx, equipment._id);
  const questions = quiz
    ? await ctx.db
        .query("questions")
        .withIndex("by_quiz_order", (q) => q.eq("quizId", quiz._id))
        .collect()
    : [];

  const signOffs = includeAllSignOffs
    ? await ctx.db
        .query("equipmentSignOffs")
        .withIndex("by_equipment", (q) => q.eq("equipmentId", equipment._id))
        .collect()
    : currentUserId
      ? await ctx.db
          .query("equipmentSignOffs")
          .withIndex("by_user_equipment", (q) =>
            q.eq("userId", currentUserId).eq("equipmentId", equipment._id),
          )
          .collect()
      : [];

  const signOffDetails = await Promise.all(
    signOffs.map(async (signOff) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", signOff.userId))
        .unique();

      const approverProfile = signOff.approvedBy
        ? await ctx.db
            .query("profiles")
            .withIndex("by_user", (q) => q.eq("userId", signOff.approvedBy!))
            .unique()
        : null;

      return {
        ...signOff,
        studentName: profile?.displayName ?? profile?.email ?? "Unknown student",
        studentEmail: profile?.email,
        approvedByName:
          approverProfile?.displayName ?? approverProfile?.email ?? undefined,
      };
    }),
  );
  const latestQuizAttempt =
    quiz && currentUserId
      ? await ctx.db
          .query("quizAttempts")
          .withIndex("by_user_quiz", (q) =>
            q.eq("userId", currentUserId).eq("quizId", quiz._id),
          )
          .order("desc")
          .first()
      : null;
  const videoProgress = currentUserId
    ? await ctx.db
        .query("equipmentVideoProgress")
        .withIndex("by_user_equipment", (q) =>
          q.eq("userId", currentUserId).eq("equipmentId", equipment._id),
        )
        .first()
    : null;
  const sopDocuments = await ctx.db
    .query("equipmentSopDocuments")
    .withIndex("by_equipment", (q) => q.eq("equipmentId", equipment._id))
    .collect();
  const sopDocumentsWithUrls = await Promise.all(
    sopDocuments.map(async (document) => ({
      ...document,
      url: await ctx.storage.getUrl(document.storageId),
    })),
  );

  return {
    ...equipment,
    quiz,
    questions,
    latestQuizAttempt,
    videoProgress,
    sopDocuments: sopDocumentsWithUrls,
    signOffs: signOffDetails,
  };
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

function answerMatches(question: { type: string; correctAnswer?: string }, answer: string) {
  if (question.type === "multiple_choice") {
    const expected = parseAnswerList(question.correctAnswer);
    const submitted = parseAnswerList(answer);

    return (
      expected.length === submitted.length &&
      expected.every((expectedAnswer, index) => expectedAnswer === submitted[index])
    );
  }

  return normalizeAnswer(question.correctAnswer) === normalizeAnswer(answer);
}

export const listEquipment = query({
  args: {},
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);
    const currentUserId = await getAuthUserId(ctx);
    const isAdmin = profile?.role === "admin";
    const equipment = await ctx.db.query("equipment").withIndex("by_category").collect();
    const visibleEquipment = isAdmin
      ? equipment
      : equipment.filter((item) => item.isActive);

    return await Promise.all(
      visibleEquipment.map(async (item) => {
        const record = await collectEquipmentRecord(
          ctx,
          item._id,
          isAdmin,
          currentUserId,
        );

        if (!record) {
          throw new Error("Equipment not found.");
        }

        return record;
      }),
    );
  },
});

export const getEquipment = query({
  args: {
    equipmentId: v.id("equipment"),
  },
  handler: async (ctx, args) => {
    const profile = await currentProfile(ctx);
    const currentUserId = await getAuthUserId(ctx);
    const isAdmin = profile?.role === "admin";
    const record = await collectEquipmentRecord(
      ctx,
      args.equipmentId,
      isAdmin,
      currentUserId,
    );

    if (!record) {
      return null;
    }

    if (!record.isActive && !isAdmin) {
      return null;
    }

    return record;
  },
});

export const listStudentsForSignOff = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const students = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "student"))
      .collect();

    return students
      .filter((profile) => profile.status === "active")
      .sort((a, b) =>
        (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? ""),
      )
      .map((profile) => ({
        userId: profile.userId,
        displayName: profile.displayName,
        email: profile.email,
      }));
  },
});

export const listUsersReadyForEquipmentSignOff = query({
  args: {
    equipmentId: v.id("equipment"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const equipment = await ctx.db.get(args.equipmentId);

    if (!equipment) {
      throw new Error("Equipment not found.");
    }

    const quiz = await getEquipmentQuiz(ctx, args.equipmentId);

    if (!quiz) {
      return [];
    }

    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
      .filter((q) => q.eq(q.field("status"), "passed"))
      .collect();
    const latestPassedAttemptByUser = new Map<Id<"users">, (typeof attempts)[number]>();

    for (const attempt of attempts) {
      const existing = latestPassedAttemptByUser.get(attempt.userId);

      if (!existing || attempt.completedAt! > (existing.completedAt ?? 0)) {
        latestPassedAttemptByUser.set(attempt.userId, attempt);
      }
    }

    const users = await Promise.all(
      [...latestPassedAttemptByUser.entries()].map(async ([userId, attempt]) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();
        const user = await ctx.db.get(userId);

        return {
          userId,
          displayName: profile?.displayName ?? user?.name,
          email: profile?.email ?? user?.email,
          role: profile?.role ?? "student",
          passedAt: attempt.completedAt,
          scorePercent: attempt.scorePercent,
        };
      }),
    );

    return users.sort((a, b) =>
      (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? ""),
    );
  },
});

export const createEquipment = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const now = Date.now();

    return await ctx.db.insert("equipment", {
      name: "New equipment",
      category: "shop",
      description: "",
      instructorApprovalRequired: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const generateSopUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return await ctx.storage.generateUploadUrl();
  },
});

export const addSopDocument = mutation({
  args: {
    equipmentId: v.id("equipment"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await requireAdmin(ctx);
    const equipment = await ctx.db.get(args.equipmentId);

    if (!equipment) {
      throw new Error("Equipment not found.");
    }

    const fileName = args.fileName.trim();

    if (!fileName) {
      throw new Error("SOP document name is required.");
    }

    return await ctx.db.insert("equipmentSopDocuments", {
      equipmentId: args.equipmentId,
      storageId: args.storageId,
      fileName,
      contentType: args.contentType,
      size: args.size,
      uploadedBy: profile.userId,
      createdAt: Date.now(),
    });
  },
});

export const deleteSopDocument = mutation({
  args: {
    documentId: v.id("equipmentSopDocuments"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const document = await ctx.db.get(args.documentId);

    if (!document) {
      return args.documentId;
    }

    await ctx.storage.delete(document.storageId);
    await ctx.db.delete(args.documentId);

    return args.documentId;
  },
});

export const saveEquipment = mutation({
  args: {
    equipmentId: v.id("equipment"),
    name: v.string(),
    category: v.string(),
    description: v.string(),
    videoUrl: v.optional(v.string()),
    instructorApprovalRequired: v.boolean(),
    isActive: v.boolean(),
    passingScorePercent: v.number(),
    questions: v.array(questionInputValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const equipment = await ctx.db.get(args.equipmentId);

    if (!equipment) {
      throw new Error("Equipment not found.");
    }

    const name = args.name.trim();
    const category = args.category.trim();
    const description = args.description.trim();
    const videoUrl = args.videoUrl?.trim();

    if (!name) {
      throw new Error("Equipment name is required.");
    }

    if (!category) {
      throw new Error("Equipment category is required.");
    }

    await ctx.db.patch(args.equipmentId, {
      name,
      category,
      description,
      videoUrl: videoUrl || undefined,
      instructorApprovalRequired: args.instructorApprovalRequired,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    if (args.questions.length === 0) {
      await deleteEquipmentQuiz(ctx, args.equipmentId);
      return args.equipmentId;
    }

    if (args.passingScorePercent < 0 || args.passingScorePercent > 100) {
      throw new Error("Passing score must be between 0 and 100.");
    }

    const existingQuiz = await getEquipmentQuiz(ctx, args.equipmentId);
    const now = Date.now();
    const quizId =
      existingQuiz?._id ??
      (await ctx.db.insert("quizzes", {
        title: `${name} safety test`,
        description: `Safety test for ${name}.`,
        linkedEquipmentId: args.equipmentId,
        passingScorePercent: args.passingScorePercent,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      }));

    await ctx.db.patch(quizId, {
      title: `${name} safety test`,
      description: `Safety test for ${name}.`,
      linkedEquipmentId: args.equipmentId,
      passingScorePercent: args.passingScorePercent,
      isPublished: true,
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
        throw new Error("Every safety test question needs a prompt.");
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

    return args.equipmentId;
  },
});

export const setHandsOnDemonstration = mutation({
  args: {
    equipmentId: v.id("equipment"),
    userId: v.id("users"),
    completed: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminProfile = await requireAdmin(ctx);

    const equipment = await ctx.db.get(args.equipmentId);

    if (!equipment) {
      throw new Error("Equipment not found.");
    }

    const studentProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!studentProfile) {
      throw new Error("Student profile not found.");
    }

    const existing = await ctx.db
      .query("equipmentSignOffs")
      .withIndex("by_user_equipment", (q) =>
        q.eq("userId", args.userId).eq("equipmentId", args.equipmentId),
      )
      .unique();
    const now = Date.now();
    const notes = args.notes?.trim();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.completed ? "approved" : "not_started",
        approvedAt: args.completed ? now : undefined,
        approvedBy: args.completed ? adminProfile.userId : undefined,
        notes: notes || undefined,
        updatedAt: now,
      });

      await ctx.db.insert("approvalEvents", {
        signOffId: existing._id,
        actorUserId: adminProfile.userId,
        action: args.completed ? "approved" : "commented",
        note: args.completed ? notes || "Hands-on demonstration complete." : "Hands-on demonstration reset.",
        createdAt: now,
      });

      return existing._id;
    }

    const signOffId = await ctx.db.insert("equipmentSignOffs", {
      equipmentId: args.equipmentId,
      userId: args.userId,
      status: args.completed ? "approved" : "not_started",
      approvedAt: args.completed ? now : undefined,
      approvedBy: args.completed ? adminProfile.userId : undefined,
      notes: notes || undefined,
      updatedAt: now,
    });

    await ctx.db.insert("approvalEvents", {
      signOffId,
      actorUserId: adminProfile.userId,
      action: args.completed ? "approved" : "commented",
      note: args.completed ? notes || "Hands-on demonstration complete." : "Hands-on demonstration reset.",
      createdAt: now,
    });

    return signOffId;
  },
});

export const submitEquipmentSafetyTest = mutation({
  args: {
    equipmentId: v.id("equipment"),
    answers: v.array(answerInputValidator),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    const userId = profile.userId;

    const equipment = await ctx.db.get(args.equipmentId);

    if (!equipment || !equipment.isActive) {
      throw new Error("Equipment not found.");
    }

    const quiz = await getEquipmentQuiz(ctx, args.equipmentId);

    if (!quiz || !quiz.isPublished) {
      throw new Error("No safety test is available for this equipment.");
    }

    const existingPassedAttempt = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user_quiz", (q) =>
        q.eq("userId", userId).eq("quizId", quiz._id),
      )
      .filter((q) => q.eq(q.field("status"), "passed"))
      .first();

    if (existingPassedAttempt) {
      throw new Error("You have already passed this safety test.");
    }

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz_order", (q) => q.eq("quizId", quiz._id))
      .collect();

    if (questions.length === 0) {
      throw new Error("No safety test questions are available for this equipment.");
    }

    const answersByQuestionId = new Map(
      args.answers.map((answer) => [answer.questionId, answer.answer]),
    );
    const totalPoints = questions.reduce((total, question) => total + question.points, 0);
    let earnedPoints = 0;

    for (const question of questions) {
      const answer = answersByQuestionId.get(question._id);

      if (question.type === "file_upload") {
        throw new Error("File upload questions cannot be graded automatically yet.");
      }

      if (!answer) {
        continue;
      }

      if (answerMatches(question, answer)) {
        earnedPoints += question.points;
      }
    }

    const scorePercent =
      totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const status = scorePercent >= quiz.passingScorePercent ? "passed" : "failed";
    const now = Date.now();

    const attemptId = await ctx.db.insert("quizAttempts", {
      quizId: quiz._id,
      userId,
      status,
      scorePercent,
      answers: args.answers,
      startedAt: now,
      completedAt: now,
    });

    return {
      attemptId,
      status,
      scorePercent,
    };
  },
});
export const markEquipmentVideoComplete = mutation({
  args: {
    equipmentId: v.id("equipment"),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    const userId = profile.userId;

    const equipment = await ctx.db.get(args.equipmentId);

    if (!equipment) {
      throw new Error("Equipment not found.");
    }

    if (!equipment.videoUrl) {
      throw new Error("No training video is available for this equipment.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("equipmentVideoProgress")
      .withIndex("by_user_equipment", (q) =>
        q.eq("userId", userId).eq("equipmentId", args.equipmentId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("equipmentVideoProgress", {
      equipmentId: args.equipmentId,
      userId,
      status: "completed",
      startedAt: now,
      completedAt: now,
      updatedAt: now,
    });
  },
});




