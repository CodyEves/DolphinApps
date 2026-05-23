import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(
  v.literal("student"),
  v.literal("instructor"),
  v.literal("mentor"),
  v.literal("guest"),
  v.literal("admin"),
);
const activeStatus = v.union(v.literal("active"), v.literal("inactive"));
const lessonType = v.union(
  v.literal("video"),
  v.literal("video_assignment"),
  v.literal("exam"),
  v.literal("reading"),
  v.literal("exercise"),
);
const progressStatus = v.union(
  v.literal("not_started"),
  v.literal("started"),
  v.literal("completed"),
);
const questionType = v.union(
  v.literal("multiple_choice"),
  v.literal("true_false"),
  v.literal("short_answer"),
  v.literal("fill_blank"),
  v.literal("file_upload"),
);
const attemptStatus = v.union(
  v.literal("in_progress"),
  v.literal("passed"),
  v.literal("failed"),
);
const submissionStatus = v.union(
  v.literal("submitted"),
  v.literal("needs_revision"),
  v.literal("approved"),
);
const signOffStatus = v.union(
  v.literal("not_started"),
  v.literal("requested"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("expired"),
);
const approvalAction = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("commented"),
);
const websiteEditKind = v.union(
  v.literal("text"),
  v.literal("color"),
  v.literal("background"),
  v.literal("image"),
);

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    role,
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    graduationYear: v.optional(v.number()),
    studentGroup: v.optional(v.string()),
    status: activeStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_role", ["role"])
    .index("by_email", ["email"]),

  trainingTracks: defineTable({
    title: v.string(),
    description: v.string(),
    category: v.string(),
    level: v.union(v.literal("intro"), v.literal("intermediate"), v.literal("advanced")),
    order: v.number(),
    isPublished: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["order"])
    .index("by_category", ["category"]),

  units: defineTable({
    trackId: v.id("trainingTracks"),
    title: v.string(),
    description: v.string(),
    order: v.number(),
    isRequired: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_track", ["trackId"])
    .index("by_track_order", ["trackId", "order"]),

  lessons: defineTable({
    unitId: v.id("units"),
    title: v.string(),
    description: v.string(),
    lessonType,
    youtubeUrl: v.optional(v.string()),
    estimatedMinutes: v.number(),
    required: v.boolean(),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_unit", ["unitId"])
    .index("by_unit_order", ["unitId", "order"]),

  lessonProgress: defineTable({
    userId: v.id("users"),
    lessonId: v.id("lessons"),
    status: progressStatus,
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    videoSecondsWatched: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_lesson", ["lessonId"])
    .index("by_user_lesson", ["userId", "lessonId"]),

  quizzes: defineTable({
    title: v.string(),
    description: v.string(),
    linkedLessonId: v.optional(v.id("lessons")),
    linkedUnitId: v.optional(v.id("units")),
    linkedEquipmentId: v.optional(v.id("equipment")),
    passingScorePercent: v.number(),
    maxAttempts: v.optional(v.number()),
    isPublished: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_lesson", ["linkedLessonId"])
    .index("by_equipment", ["linkedEquipmentId"]),

  questions: defineTable({
    quizId: v.id("quizzes"),
    type: questionType,
    prompt: v.string(),
    choices: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
    allowMultipleCorrect: v.optional(v.boolean()),
    order: v.number(),
    points: v.number(),
  })
    .index("by_quiz", ["quizId"])
    .index("by_quiz_order", ["quizId", "order"]),

  quizAttempts: defineTable({
    quizId: v.id("quizzes"),
    userId: v.id("users"),
    status: attemptStatus,
    scorePercent: v.optional(v.number()),
    answers: v.optional(v.array(v.object({ questionId: v.id("questions"), answer: v.string() }))),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_quiz", ["quizId"])
    .index("by_user_quiz", ["userId", "quizId"]),

  exerciseSubmissions: defineTable({
    userId: v.id("users"),
    lessonId: v.optional(v.id("lessons")),
    unitId: v.optional(v.id("units")),
    prompt: v.string(),
    response: v.string(),
    status: submissionStatus,
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_lesson", ["lessonId"]),

  badges: defineTable({
    title: v.string(),
    description: v.string(),
    criteriaSummary: v.string(),
    linkedTrackId: v.optional(v.id("trainingTracks")),
    linkedUnitId: v.optional(v.id("units")),
    linkedEquipmentId: v.optional(v.id("equipment")),
    requiredTrackIds: v.optional(v.array(v.id("trainingTracks"))),
    requiredEquipmentIds: v.optional(v.array(v.id("equipment"))),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active", ["isActive"]),

  userBadges: defineTable({
    userId: v.id("users"),
    badgeId: v.id("badges"),
    earnedAt: v.number(),
    awardedBy: v.optional(v.id("users")),
  })
    .index("by_user", ["userId"])
    .index("by_badge", ["badgeId"])
    .index("by_user_badge", ["userId", "badgeId"]),

  equipment: defineTable({
    name: v.string(),
    category: v.string(),
    description: v.string(),
    videoUrl: v.optional(v.string()),
    requiredTrainingTrackId: v.optional(v.id("trainingTracks")),
    requiredQuizId: v.optional(v.id("quizzes")),
    instructorApprovalRequired: v.boolean(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  equipmentSopDocuments: defineTable({
    equipmentId: v.id("equipment"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    uploadedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_equipment", ["equipmentId"])
    .index("by_storage", ["storageId"]),

  equipmentSignOffs: defineTable({
    equipmentId: v.id("equipment"),
    userId: v.id("users"),
    status: signOffStatus,
    requestedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
    expiresAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_equipment", ["equipmentId"])
    .index("by_user_equipment", ["userId", "equipmentId"])
    .index("by_status", ["status"]),

  approvalEvents: defineTable({
    signOffId: v.id("equipmentSignOffs"),
    actorUserId: v.id("users"),
    action: approvalAction,
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_signoff", ["signOffId"])
    .index("by_actor", ["actorUserId"]),

  websiteEdits: defineTable({
    pagePath: v.string(),
    targetKey: v.string(),
    kind: websiteEditKind,
    value: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_page", ["pagePath"])
    .index("by_page_target_kind", ["pagePath", "targetKey", "kind"]),
});
