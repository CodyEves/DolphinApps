import { v } from "convex/values";
import type { Infer } from "convex/values";

/**
 * Learning (skills-based) domain.
 *
 * A path is one training group (Mechanical & Design, Electrical & Control
 * Systems, Business, Media & Outreach). A skill is one "I can..." objective.
 * Each skill is checked one of three ways:
 *   - self:   the student marks it done
 *   - quiz:   the student passes a short quiz (graded on the server)
 *   - mentor: a mentor signs the student off
 */

export const learningCheckTypeValidator = v.union(
  v.literal("self"),
  v.literal("quiz"),
  v.literal("mentor"),
);

export const learningProgressStatusValidator = v.union(
  v.literal("completed"),
  v.literal("signoff_requested"),
  v.literal("needs_work"),
);

export const learningResourceKindValidator = v.union(
  v.literal("interactive"),
  v.literal("video"),
  v.literal("reading"),
  v.literal("course"),
  v.literal("tool"),
);

export const learningPathColorValidator = v.union(
  v.literal("blue"),
  v.literal("amber"),
  v.literal("violet"),
  v.literal("teal"),
  v.literal("rose"),
);

export const learningResourceValidator = v.object({
  title: v.string(),
  url: v.string(),
  kind: learningResourceKindValidator,
  source: v.string(),
  minutes: v.optional(v.number()),
});

export const learningQuizQuestionValidator = v.object({
  prompt: v.string(),
  options: v.array(v.string()),
  correctIndex: v.number(),
  explanation: v.optional(v.string()),
});

export type LearningCheckType = Infer<typeof learningCheckTypeValidator>;
export type LearningProgressStatus = Infer<typeof learningProgressStatusValidator>;
export type LearningResource = Infer<typeof learningResourceValidator>;
export type LearningQuizQuestion = Infer<typeof learningQuizQuestionValidator>;
export type LearningPathColor = Infer<typeof learningPathColorValidator>;

export const DEFAULT_QUIZ_PASS_PERCENT = 80;

export function canReviewLearningRole(role: string | undefined) {
  return role === "admin" || role === "mentor" || role === "instructor";
}

export function canEditLearningRole(role: string | undefined) {
  return role === "admin" || role === "mentor" || role === "instructor" || role === "lead";
}
