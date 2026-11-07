import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  DEFAULT_QUIZ_PASS_PERCENT,
  canEditLearningRole,
  canReviewLearningRole,
  learningCheckTypeValidator,
  learningPathColorValidator,
  learningQuizQuestionValidator,
  learningResourceValidator,
} from "./lib/learningDomain";
import type { LearningQuizQuestion, LearningResource } from "./lib/learningDomain";
import { learningSeedPaths } from "./lib/learningSeed";
import { programForProfile } from "./lib/programs";

type Ctx = QueryCtx | MutationCtx;

// ---- Access helpers ------------------------------------------------------

async function viewerProfile(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  return { userId, profile };
}

async function requireLearner(ctx: MutationCtx) {
  const viewer = await viewerProfile(ctx);

  if (!viewer) {
    throw new Error("Sign in to track your learning.");
  }

  if (!viewer.profile || viewer.profile.status !== "active") {
    throw new Error("Your team profile is view-only, so progress can't be saved.");
  }

  return { userId: viewer.userId, profile: viewer.profile };
}

async function requireReviewer(ctx: Ctx) {
  const viewer = await viewerProfile(ctx);

  if (!viewer?.profile || viewer.profile.status !== "active" || !canReviewLearningRole(viewer.profile.role)) {
    throw new Error("Only mentors, instructors, and admins can sign students off.");
  }

  return { userId: viewer.userId, profile: viewer.profile };
}

async function requireEditor(ctx: Ctx) {
  const viewer = await viewerProfile(ctx);

  if (!viewer?.profile || viewer.profile.status !== "active" || !canEditLearningRole(viewer.profile.role)) {
    throw new Error("Only mentors, instructors, leads, and admins can edit learning content.");
  }

  return { userId: viewer.userId, profile: viewer.profile };
}

function nameFor(profile: Doc<"profiles"> | null, user: Doc<"users"> | null) {
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

  return profile?.displayName || fullName || user?.name || profile?.email || user?.email || "Team member";
}

async function nameForUser(ctx: Ctx, userId: Id<"users">) {
  const [user, profile] = await Promise.all([
    ctx.db.get(userId),
    ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
  ]);

  return nameFor(profile, user);
}

async function progressFor(ctx: Ctx, userId: Id<"users">, skillId: Id<"learningSkills">) {
  return await ctx.db
    .query("learningProgress")
    .withIndex("by_user_skill", (q) => q.eq("userId", userId).eq("skillId", skillId))
    .first();
}

async function skillsForPath(ctx: Ctx, pathId: Id<"learningPaths">) {
  return await ctx.db
    .query("learningSkills")
    .withIndex("by_path_order", (q) => q.eq("pathId", pathId))
    .collect();
}

async function orderedPaths(ctx: Ctx) {
  return await ctx.db.query("learningPaths").withIndex("by_order").collect();
}

function publicQuiz(quiz: LearningQuizQuestion[] | undefined) {
  return (quiz ?? []).map((question) => ({ prompt: question.prompt, options: question.options }));
}

function cleanText(value: string, label: string, maxLength = 600) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} can't be empty.`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function cleanOptionalText(value: string | undefined, maxLength = 1000) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function cleanUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Links must start with http:// or https://.");
  }

  return trimmed;
}

function validateResources(resources: LearningResource[]) {
  return resources.map((resource) => ({
    ...resource,
    title: cleanText(resource.title, "Resource title", 160),
    source: cleanText(resource.source, "Resource source", 80),
    url: cleanUrl(resource.url) ?? (() => {
      throw new Error("Every resource needs a link.");
    })(),
  }));
}

function validateQuiz(quiz: LearningQuizQuestion[] | undefined) {
  if (!quiz) {
    return undefined;
  }

  return quiz.map((question, index) => {
    const options = question.options.map((option) => option.trim()).filter(Boolean);

    if (options.length < 2) {
      throw new Error(`Question ${index + 1} needs at least two answer choices.`);
    }

    if (question.correctIndex < 0 || question.correctIndex >= options.length) {
      throw new Error(`Question ${index + 1} needs a correct answer marked.`);
    }

    return {
      prompt: cleanText(question.prompt, `Question ${index + 1}`, 400),
      options,
      correctIndex: question.correctIndex,
      explanation: cleanOptionalText(question.explanation, 400),
    };
  });
}

// ---- Student queries ----------------------------------------------------

/** Everything the Learning home page needs: paths, skills, and the viewer's progress. */
export const myLearning = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await viewerProfile(ctx);

    if (!viewer) {
      return null;
    }

    const role = viewer.profile?.role;
    const canEdit = viewer.profile?.status === "active" && canEditLearningRole(role);
    const canReview = viewer.profile?.status === "active" && canReviewLearningRole(role);
    const paths = (await orderedPaths(ctx)).filter((path) => path.isPublished || canEdit);
    const progressRows = await ctx.db
      .query("learningProgress")
      .withIndex("by_user", (q) => q.eq("userId", viewer.userId))
      .collect();
    const progressBySkill = new Map(progressRows.map((row) => [row.skillId, row]));
    const settings = await ctx.db
      .query("learnerSettings")
      .withIndex("by_user", (q) => q.eq("userId", viewer.userId))
      .first();

    const pathsWithSkills = await Promise.all(
      paths.map(async (path) => {
        const skills = (await skillsForPath(ctx, path._id)).filter((skill) => skill.isPublished || canEdit);

        return {
          _id: path._id,
          slug: path.slug,
          title: path.title,
          summary: path.summary,
          color: path.color,
          isPublished: path.isPublished,
          skills: skills.map((skill) => {
            const progress = progressBySkill.get(skill._id);

            return {
              _id: skill._id,
              stage: skill.stage,
              title: skill.title,
              checkType: skill.checkType,
              estimatedMinutes: skill.estimatedMinutes,
              isPublished: skill.isPublished,
              status: progress?.status ?? null,
              completedAt: progress?.completedAt,
            };
          }),
        };
      }),
    );

    const focusPathId =
      settings?.focusPathId && pathsWithSkills.some((path) => path._id === settings.focusPathId)
        ? settings.focusPathId
        : null;

    return {
      paths: pathsWithSkills,
      focusPathId,
      canEdit,
      canReview,
      canTrackProgress: viewer.profile?.status === "active",
    };
  },
});

/** One skill with its resources, the viewer's progress, and the skills before and after it. */
export const skill = query({
  args: { skillId: v.id("learningSkills") },
  handler: async (ctx, { skillId }) => {
    const viewer = await viewerProfile(ctx);

    if (!viewer) {
      return null;
    }

    const canEdit = viewer.profile?.status === "active" && canEditLearningRole(viewer.profile?.role);
    const skillDoc = await ctx.db.get(skillId);

    if (!skillDoc || (!skillDoc.isPublished && !canEdit)) {
      return { notFound: true as const };
    }

    const path = await ctx.db.get(skillDoc.pathId);

    if (!path || (!path.isPublished && !canEdit)) {
      return { notFound: true as const };
    }

    const siblings = (await skillsForPath(ctx, path._id)).filter((item) => item.isPublished || canEdit);
    const index = siblings.findIndex((item) => item._id === skillId);
    const progress = await progressFor(ctx, viewer.userId, skillId);
    const reviewerName = progress?.reviewedBy ? await nameForUser(ctx, progress.reviewedBy) : null;
    const neighbor = (item: Doc<"learningSkills"> | undefined) =>
      item ? { _id: item._id, title: item.title, stage: item.stage } : null;

    return {
      notFound: false as const,
      skill: {
        _id: skillDoc._id,
        stage: skillDoc.stage,
        title: skillDoc.title,
        successCriteria: skillDoc.successCriteria,
        practice: skillDoc.practice,
        checkType: skillDoc.checkType,
        estimatedMinutes: skillDoc.estimatedMinutes,
        resources: skillDoc.resources,
        quiz: publicQuiz(skillDoc.quiz),
        passPercent: skillDoc.passPercent ?? DEFAULT_QUIZ_PASS_PERCENT,
        isPublished: skillDoc.isPublished,
      },
      path: { _id: path._id, title: path.title, color: path.color, slug: path.slug },
      position: { index: index + 1, total: siblings.length },
      previous: neighbor(siblings[index - 1]),
      next: neighbor(siblings[index + 1]),
      progress: progress
        ? {
            status: progress.status,
            completedAt: progress.completedAt,
            quizBestPercent: progress.quizBestPercent,
            quizAttempts: progress.quizAttempts,
            evidenceNote: progress.evidenceNote,
            evidenceUrl: progress.evidenceUrl,
            requestedAt: progress.requestedAt,
            reviewedAt: progress.reviewedAt,
            mentorNote: progress.mentorNote,
            reviewerName,
          }
        : null,
      canEdit,
      canTrackProgress: viewer.profile?.status === "active",
    };
  },
});

// ---- Student mutations --------------------------------------------------

export const setFocusPath = mutation({
  args: { pathId: v.id("learningPaths") },
  handler: async (ctx, { pathId }) => {
    const viewer = await viewerProfile(ctx);

    if (!viewer) {
      throw new Error("Sign in to choose a path.");
    }

    const existing = await ctx.db
      .query("learnerSettings")
      .withIndex("by_user", (q) => q.eq("userId", viewer.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { focusPathId: pathId, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("learnerSettings", {
        userId: viewer.userId,
        focusPathId: pathId,
        updatedAt: Date.now(),
      });
    }
  },
});

async function loadSkillForLearner(ctx: MutationCtx, skillId: Id<"learningSkills">) {
  const skillDoc = await ctx.db.get(skillId);

  if (!skillDoc || !skillDoc.isPublished) {
    throw new Error("That skill isn't available.");
  }

  return skillDoc;
}

export const markDone = mutation({
  args: { skillId: v.id("learningSkills") },
  handler: async (ctx, { skillId }) => {
    const { userId } = await requireLearner(ctx);
    const skillDoc = await loadSkillForLearner(ctx, skillId);

    if (skillDoc.checkType !== "self") {
      throw new Error("This skill is checked with a quiz or a mentor sign-off.");
    }

    const now = Date.now();
    const existing = await progressFor(ctx, userId, skillId);

    if (existing) {
      await ctx.db.patch(existing._id, { status: "completed", completedAt: now, updatedAt: now });
    } else {
      await ctx.db.insert("learningProgress", {
        userId,
        skillId,
        pathId: skillDoc.pathId,
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
    }
  },
});

export const undoDone = mutation({
  args: { skillId: v.id("learningSkills") },
  handler: async (ctx, { skillId }) => {
    const { userId } = await requireLearner(ctx);
    const skillDoc = await ctx.db.get(skillId);

    if (skillDoc?.checkType !== "self") {
      throw new Error("Only self-checked skills can be unmarked.");
    }

    const existing = await progressFor(ctx, userId, skillId);

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const submitQuiz = mutation({
  args: { skillId: v.id("learningSkills"), answers: v.array(v.number()) },
  handler: async (ctx, { skillId, answers }) => {
    const { userId } = await requireLearner(ctx);
    const skillDoc = await loadSkillForLearner(ctx, skillId);
    const quiz = skillDoc.quiz ?? [];

    if (skillDoc.checkType !== "quiz" || quiz.length === 0) {
      throw new Error("This skill doesn't have a quiz.");
    }

    if (answers.length !== quiz.length || answers.some((answer) => answer < 0)) {
      throw new Error("Answer every question before submitting.");
    }

    const results = quiz.map((question, index) => ({
      correct: answers[index] === question.correctIndex,
      correctIndex: question.correctIndex,
      explanation: question.explanation ?? null,
    }));
    const correctCount = results.filter((result) => result.correct).length;
    const percent = Math.round((correctCount / quiz.length) * 100);
    const passPercent = skillDoc.passPercent ?? DEFAULT_QUIZ_PASS_PERCENT;
    const passed = percent >= passPercent;
    const now = Date.now();
    const existing = await progressFor(ctx, userId, skillId);

    if (existing) {
      const alreadyComplete = existing.status === "completed";

      await ctx.db.patch(existing._id, {
        quizAttempts: (existing.quizAttempts ?? 0) + 1,
        quizBestPercent: Math.max(existing.quizBestPercent ?? 0, percent),
        status: alreadyComplete || passed ? "completed" : existing.status,
        completedAt: alreadyComplete ? existing.completedAt : passed ? now : existing.completedAt,
        updatedAt: now,
      });
    } else if (passed) {
      await ctx.db.insert("learningProgress", {
        userId,
        skillId,
        pathId: skillDoc.pathId,
        status: "completed",
        completedAt: now,
        quizAttempts: 1,
        quizBestPercent: percent,
        updatedAt: now,
      });
    }

    return { percent, passed, passPercent, correctCount, total: quiz.length, results };
  },
});

export const requestSignoff = mutation({
  args: {
    skillId: v.id("learningSkills"),
    note: v.optional(v.string()),
    evidenceUrl: v.optional(v.string()),
  },
  handler: async (ctx, { skillId, note, evidenceUrl }) => {
    const { userId } = await requireLearner(ctx);
    const skillDoc = await loadSkillForLearner(ctx, skillId);

    if (skillDoc.checkType !== "mentor") {
      throw new Error("This skill doesn't need a mentor sign-off.");
    }

    const now = Date.now();
    const existing = await progressFor(ctx, userId, skillId);
    const fields = {
      status: "signoff_requested" as const,
      evidenceNote: cleanOptionalText(note),
      evidenceUrl: cleanUrl(evidenceUrl),
      requestedAt: now,
      updatedAt: now,
    };

    if (existing?.status === "completed") {
      throw new Error("You're already signed off on this skill.");
    }

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("learningProgress", { userId, skillId, pathId: skillDoc.pathId, ...fields });
    }
  },
});

export const cancelSignoffRequest = mutation({
  args: { skillId: v.id("learningSkills") },
  handler: async (ctx, { skillId }) => {
    const { userId } = await requireLearner(ctx);
    const existing = await progressFor(ctx, userId, skillId);

    if (existing?.status === "signoff_requested") {
      await ctx.db.delete(existing._id);
    }
  },
});

// ---- Mentor: sign-offs and team progress --------------------------------

export const signoffQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireReviewer(ctx);

    const requests = await ctx.db
      .query("learningProgress")
      .withIndex("by_status", (q) => q.eq("status", "signoff_requested"))
      .collect();

    const items = await Promise.all(
      requests.map(async (request) => {
        const [skillDoc, path, studentName] = await Promise.all([
          ctx.db.get(request.skillId),
          ctx.db.get(request.pathId),
          nameForUser(ctx, request.userId),
        ]);

        if (!skillDoc || !path) {
          return null;
        }

        return {
          progressId: request._id,
          studentName,
          skillId: skillDoc._id,
          skillTitle: skillDoc.title,
          successCriteria: skillDoc.successCriteria,
          stage: skillDoc.stage,
          pathTitle: path.title,
          pathColor: path.color,
          note: request.evidenceNote,
          evidenceUrl: request.evidenceUrl,
          requestedAt: request.requestedAt ?? request.updatedAt,
        };
      }),
    );

    return items
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.requestedAt - b.requestedAt);
  },
});

export const reviewSignoff = mutation({
  args: {
    progressId: v.id("learningProgress"),
    approved: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { progressId, approved, note }) => {
    const reviewer = await requireReviewer(ctx);
    const progress = await ctx.db.get(progressId);

    if (!progress) {
      throw new Error("That sign-off request no longer exists.");
    }

    const now = Date.now();
    const mentorNote = cleanOptionalText(note, 600);

    if (!approved && !mentorNote) {
      throw new Error("Add a note so the student knows what to work on.");
    }

    await ctx.db.patch(progressId, {
      status: approved ? "completed" : "needs_work",
      completedAt: approved ? now : undefined,
      reviewedBy: reviewer.userId,
      reviewedAt: now,
      mentorNote,
      updatedAt: now,
    });
  },
});

/** In-class sign-off: a mentor marks several students complete on one skill at once. */
export const signOffStudents = mutation({
  args: { skillId: v.id("learningSkills"), userIds: v.array(v.id("users")) },
  handler: async (ctx, { skillId, userIds }) => {
    const reviewer = await requireReviewer(ctx);
    const skillDoc = await ctx.db.get(skillId);

    if (!skillDoc) {
      throw new Error("That skill no longer exists.");
    }

    const now = Date.now();
    let signedOff = 0;

    for (const userId of new Set(userIds)) {
      const existing = await progressFor(ctx, userId, skillId);

      if (existing?.status === "completed") {
        continue;
      }

      const fields = {
        status: "completed" as const,
        completedAt: now,
        reviewedBy: reviewer.userId,
        reviewedAt: now,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, fields);
      } else {
        await ctx.db.insert("learningProgress", { userId, skillId, pathId: skillDoc.pathId, ...fields });
      }

      signedOff += 1;
    }

    return { signedOff };
  },
});

export const clearProgress = mutation({
  args: { userId: v.id("users"), skillId: v.id("learningSkills") },
  handler: async (ctx, { userId, skillId }) => {
    await requireReviewer(ctx);
    const existing = await progressFor(ctx, userId, skillId);

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/** Students x skills grid for one path. */
export const teamProgress = query({
  args: { pathId: v.id("learningPaths") },
  handler: async (ctx, { pathId }) => {
    await requireReviewer(ctx);

    const path = await ctx.db.get(pathId);

    if (!path) {
      return null;
    }

    const skills = await skillsForPath(ctx, pathId);
    const students = await ctx.db
      .query("profiles")
      .withIndex("by_role_status", (q) => q.eq("role", "student").eq("status", "active"))
      .collect();
    const progressRows = await ctx.db
      .query("learningProgress")
      .withIndex("by_path", (q) => q.eq("pathId", pathId))
      .collect();
    const progressByUser = new Map<Id<"users">, Map<Id<"learningSkills">, Doc<"learningProgress">>>();

    for (const row of progressRows) {
      const forUser = progressByUser.get(row.userId) ?? new Map();
      forUser.set(row.skillId, row);
      progressByUser.set(row.userId, forUser);
    }

    const rows = await Promise.all(
      students.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        const forUser = progressByUser.get(profile.userId);

        return {
          userId: profile.userId,
          name: nameFor(profile, user),
          program: programForProfile(profile),
          statuses: skills.map((skillDoc) => forUser?.get(skillDoc._id)?.status ?? null),
        };
      }),
    );

    return {
      path: { _id: path._id, title: path.title, color: path.color },
      skills: skills.map((skillDoc) => ({
        _id: skillDoc._id,
        stage: skillDoc.stage,
        title: skillDoc.title,
        checkType: skillDoc.checkType,
        isPublished: skillDoc.isPublished,
      })),
      students: rows.sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

// ---- Content management -------------------------------------------------

export const manageContent = query({
  args: {},
  handler: async (ctx) => {
    await requireEditor(ctx);

    const paths = await orderedPaths(ctx);

    return await Promise.all(
      paths.map(async (path) => ({
        ...path,
        skills: await skillsForPath(ctx, path._id),
      })),
    );
  },
});

export const savePath = mutation({
  args: {
    pathId: v.optional(v.id("learningPaths")),
    title: v.string(),
    summary: v.string(),
    color: learningPathColorValidator,
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    const now = Date.now();
    const fields = {
      title: cleanText(args.title, "Path name", 80),
      summary: cleanText(args.summary, "Path summary", 400),
      color: args.color,
      isPublished: args.isPublished,
      updatedAt: now,
    };

    if (args.pathId) {
      await ctx.db.patch(args.pathId, fields);
      return args.pathId;
    }

    const existing = await orderedPaths(ctx);
    const baseSlug = fields.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "path";
    let slug = baseSlug;
    let suffix = 2;

    while (existing.some((path) => path.slug === slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return await ctx.db.insert("learningPaths", {
      ...fields,
      slug,
      order: (existing.at(-1)?.order ?? 0) + 1,
      createdAt: now,
    });
  },
});

export const saveSkill = mutation({
  args: {
    skillId: v.optional(v.id("learningSkills")),
    pathId: v.id("learningPaths"),
    stage: v.string(),
    title: v.string(),
    successCriteria: v.string(),
    practice: v.optional(v.string()),
    checkType: learningCheckTypeValidator,
    estimatedMinutes: v.number(),
    resources: v.array(learningResourceValidator),
    quiz: v.optional(v.array(learningQuizQuestionValidator)),
    passPercent: v.optional(v.number()),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    const quiz = validateQuiz(args.quiz);

    if (args.checkType === "quiz" && (!quiz || quiz.length === 0)) {
      throw new Error("A quiz skill needs at least one question.");
    }

    const passPercent =
      args.passPercent === undefined ? undefined : Math.min(100, Math.max(1, Math.round(args.passPercent)));
    const now = Date.now();
    const fields = {
      pathId: args.pathId,
      stage: cleanText(args.stage, "Stage", 60),
      title: cleanText(args.title, "Skill", 200),
      successCriteria: cleanText(args.successCriteria, "Success looks like", 600),
      practice: cleanOptionalText(args.practice, 800),
      checkType: args.checkType,
      estimatedMinutes: Math.max(5, Math.round(args.estimatedMinutes)),
      resources: validateResources(args.resources),
      quiz: args.checkType === "quiz" ? quiz : undefined,
      passPercent: args.checkType === "quiz" ? passPercent : undefined,
      isPublished: args.isPublished,
      updatedAt: now,
    };

    if (args.skillId) {
      const existing = await ctx.db.get(args.skillId);

      if (!existing) {
        throw new Error("That skill no longer exists.");
      }

      await ctx.db.patch(args.skillId, fields);

      if (existing.pathId !== args.pathId) {
        const rows = await ctx.db
          .query("learningProgress")
          .withIndex("by_skill", (q) => q.eq("skillId", args.skillId!))
          .collect();
        await Promise.all(rows.map((row) => ctx.db.patch(row._id, { pathId: args.pathId })));
      }

      return args.skillId;
    }

    const siblings = await skillsForPath(ctx, args.pathId);

    return await ctx.db.insert("learningSkills", {
      ...fields,
      order: (siblings.at(-1)?.order ?? 0) + 1,
      createdAt: now,
    });
  },
});

export const moveSkill = mutation({
  args: { skillId: v.id("learningSkills"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { skillId, direction }) => {
    await requireEditor(ctx);
    const skillDoc = await ctx.db.get(skillId);

    if (!skillDoc) {
      return;
    }

    const siblings = await skillsForPath(ctx, skillDoc.pathId);
    const index = siblings.findIndex((item) => item._id === skillId);
    const swapWith = siblings[direction === "up" ? index - 1 : index + 1];

    if (!swapWith) {
      return;
    }

    await ctx.db.patch(skillDoc._id, { order: swapWith.order });
    await ctx.db.patch(swapWith._id, { order: skillDoc.order });
  },
});

export const deleteSkill = mutation({
  args: { skillId: v.id("learningSkills") },
  handler: async (ctx, { skillId }) => {
    await requireEditor(ctx);
    const rows = await ctx.db
      .query("learningProgress")
      .withIndex("by_skill", (q) => q.eq("skillId", skillId))
      .collect();

    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    await ctx.db.delete(skillId);
  },
});

/** Adds the starter paths and skills from the pre-season objectives. Safe to run again. */
export const loadStarterContent = mutation({
  args: {},
  handler: async (ctx) => {
    await requireEditor(ctx);
    const now = Date.now();
    let pathsAdded = 0;
    let skillsAdded = 0;
    const existingPaths = await orderedPaths(ctx);
    let nextPathOrder = (existingPaths.at(-1)?.order ?? 0) + 1;

    for (const seedPath of learningSeedPaths) {
      let path = existingPaths.find((item) => item.slug === seedPath.slug);

      if (!path) {
        const pathId = await ctx.db.insert("learningPaths", {
          slug: seedPath.slug,
          title: seedPath.title,
          summary: seedPath.summary,
          color: seedPath.color,
          order: nextPathOrder,
          isPublished: true,
          createdAt: now,
          updatedAt: now,
        });
        nextPathOrder += 1;
        pathsAdded += 1;
        path = (await ctx.db.get(pathId))!;
      }

      const siblings = await skillsForPath(ctx, path._id);
      let nextOrder = (siblings.at(-1)?.order ?? 0) + 1;

      for (const seedSkill of seedPath.skills) {
        const existing = await ctx.db
          .query("learningSkills")
          .withIndex("by_seed_key", (q) => q.eq("seedKey", seedSkill.key))
          .first();

        if (existing) {
          continue;
        }

        await ctx.db.insert("learningSkills", {
          pathId: path._id,
          seedKey: seedSkill.key,
          stage: seedSkill.stage,
          title: seedSkill.title,
          successCriteria: seedSkill.successCriteria,
          practice: seedSkill.practice,
          checkType: seedSkill.checkType,
          estimatedMinutes: seedSkill.estimatedMinutes,
          resources: seedSkill.resources,
          quiz: seedSkill.quiz,
          order: nextOrder,
          isPublished: true,
          createdAt: now,
          updatedAt: now,
        });
        nextOrder += 1;
        skillsAdded += 1;
      }
    }

    return { pathsAdded, skillsAdded };
  },
});
