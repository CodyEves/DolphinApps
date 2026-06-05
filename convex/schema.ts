import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const program = v.union(v.literal("frc_5199"), v.literal("frc_9271"));
const role = v.union(
  v.literal("student"),
  v.literal("instructor"),
  v.literal("mentor"),
  v.literal("guest"),
  v.literal("admin"),
);
const activeStatus = v.union(v.literal("active"), v.literal("inactive"));
const provisionedAccountStatus = v.union(
  v.literal("pending_setup"),
  v.literal("active"),
  v.literal("inactive"),
);
const credentialLinkPurpose = v.union(
  v.literal("initial_setup"),
  v.literal("password_reset"),
);
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
  v.literal("paragraph"),
  v.literal("fill_blank"),
  v.literal("file_upload"),
  v.literal("number"),
  v.literal("linear_scale"),
  v.literal("matching"),
  v.literal("ordering"),
  v.literal("url"),
);
const lessonResourceType = v.union(
  v.literal("link"),
  v.literal("file"),
  v.literal("note"),
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
const partStatus = v.union(
  v.literal("draft"),
  v.literal("inDesign"),
  v.literal("readyForFab"),
  v.literal("inManufacturing"),
  v.literal("manufactured"),
  v.literal("stored"),
  v.literal("onRobot"),
  v.literal("deprecated"),
);
const partPriority = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
  v.literal("critical"),
);
const partKind = v.union(v.literal("part"), v.literal("assembly"));
const catalogKind = v.union(
  v.literal("material"),
  v.literal("tool"),
  v.literal("bitSize"),
  v.literal("storageLocation"),
);
const partEventType = v.union(
  v.literal("createdDraft"),
  v.literal("generated"),
  v.literal("designed"),
  v.literal("statusChanged"),
  v.literal("manufactured"),
  v.literal("stored"),
  v.literal("installed"),
  v.literal("deprecated"),
  v.literal("note"),
);
const orderStatus = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("ordered"),
  v.literal("backordered"),
  v.literal("delivered"),
  v.literal("canceled"),
);

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    role,
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    primaryProgram: v.optional(program),
    graduationYear: v.optional(v.number()),
    studentGroup: v.optional(v.string()),
    status: activeStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_role", ["role"])
    .index("by_email", ["email"]),

  provisionedAccounts: defineTable({
    username: v.string(),
    displayName: v.string(),
    accountLabel: v.union(
      v.literal("varsity_5199"),
      v.literal("jv_9271"),
      v.literal("mentor"),
      v.literal("guest"),
      v.literal("admin"),
    ),
    userId: v.optional(v.id("users")),
    profileId: v.optional(v.id("profiles")),
    graduationYear: v.optional(v.number()),
    status: provisionedAccountStatus,
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_username", ["username"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  credentialLinks: defineTable({
    provisionedAccountId: v.id("provisionedAccounts"),
    tokenHash: v.string(),
    purpose: credentialLinkPurpose,
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_account", ["provisionedAccountId"])
    .index("by_account_purpose", ["provisionedAccountId", "purpose"]),

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

  lessonResources: defineTable({
    lessonId: v.id("lessons"),
    resourceType: lessonResourceType,
    title: v.string(),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_lesson", ["lessonId"])
    .index("by_lesson_order", ["lessonId", "order"]),

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
    matchingPairs: v.optional(
      v.array(v.object({ prompt: v.string(), answer: v.string() })),
    ),
    scaleMin: v.optional(v.number()),
    scaleMax: v.optional(v.number()),
    scaleMinLabel: v.optional(v.string()),
    scaleMaxLabel: v.optional(v.string()),
    answerPlaceholder: v.optional(v.string()),
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


  equipmentVideoProgress: defineTable({
    equipmentId: v.id("equipment"),
    userId: v.id("users"),
    status: progressStatus,
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_equipment", ["equipmentId"])
    .index("by_user_equipment", ["userId", "equipmentId"]),
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

  seasons: defineTable({
    name: v.string(),
    year: v.number(),
    teamNumber: v.optional(v.union(v.literal("5199"), v.literal("9271"))),
    isActive: v.boolean(),
    createdByProfileId: v.id("profiles"),
  })
    .index("by_isActive", ["isActive"])
    .index("by_teamNumber_and_isActive", ["teamNumber", "isActive"])
    .index("by_year", ["year"]),

  subsystems: defineTable({
    seasonId: v.id("seasons"),
    letter: v.string(),
    name: v.string(),
    nextPartNumber: v.number(),
    isEnabled: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_and_letter", ["seasonId", "letter"])
    .index("by_seasonId_and_sortOrder", ["seasonId", "sortOrder"]),

  catalogOptions: defineTable({
    kind: catalogKind,
    label: v.string(),
    isEnabled: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_kind", ["kind"])
    .index("by_kind_and_label", ["kind", "label"]),

  parts: defineTable({
    seasonId: v.id("seasons"),
    subsystemId: v.id("subsystems"),
    partNumber: v.union(v.string(), v.null()),
    sequenceNumber: v.union(v.number(), v.null()),
    name: v.string(),
    kind: partKind,
    status: partStatus,
    quantity: v.number(),
    priority: partPriority,
    materialOptionId: v.union(v.id("catalogOptions"), v.null()),
    toolOptionId: v.union(v.id("catalogOptions"), v.null()),
    bitSizeOptionId: v.union(v.id("catalogOptions"), v.null()),
    storageLocationOptionId: v.union(v.id("catalogOptions"), v.null()),
    onshapeDocumentUrl: v.string(),
    onshapePartStudioUrl: v.string(),
    onshapeDrawingUrl: v.string(),
    notes: v.string(),
    designedByProfileId: v.union(v.id("profiles"), v.null()),
    manufacturedByProfileId: v.union(v.id("profiles"), v.null()),
    supersedesPartId: v.union(v.id("parts"), v.null()),
    designedAt: v.union(v.number(), v.null()),
    manufacturedAt: v.union(v.number(), v.null()),
    installedAt: v.union(v.number(), v.null()),
    deprecatedAt: v.union(v.number(), v.null()),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_and_partNumber", ["seasonId", "partNumber"])
    .index("by_seasonId_and_subsystemId", ["seasonId", "subsystemId"])
    .index("by_seasonId_and_status", ["seasonId", "status"])
    .index("by_subsystemId_and_status", ["subsystemId", "status"]),

  partLinks: defineTable({
    parentPartId: v.id("parts"),
    childPartId: v.id("parts"),
    quantity: v.number(),
    notes: v.string(),
  })
    .index("by_parentPartId", ["parentPartId"])
    .index("by_childPartId", ["childPartId"])
    .index("by_parentPartId_and_childPartId", ["parentPartId", "childPartId"]),

  partEvents: defineTable({
    partId: v.id("parts"),
    eventType: partEventType,
    profileId: v.union(v.id("profiles"), v.null()),
    occurredAt: v.number(),
    fromStatus: v.union(partStatus, v.null()),
    toStatus: v.union(partStatus, v.null()),
    note: v.string(),
  })
    .index("by_partId", ["partId"])
    .index("by_partId_and_occurredAt", ["partId", "occurredAt"]),

  transmissions: defineTable({
    seasonId: v.id("seasons"),
    subsystemId: v.id("subsystems"),
    name: v.string(),
    ratio: v.string(),
    driverTeeth: v.union(v.number(), v.null()),
    drivenTeeth: v.union(v.number(), v.null()),
    beltTeeth: v.union(v.number(), v.null()),
    centerDistance: v.string(),
    calculatorUrl: v.string(),
    notes: v.string(),
    updatedByProfileId: v.id("profiles"),
    updatedAt: v.number(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_and_subsystemId", ["seasonId", "subsystemId"]),

  orderRequests: defineTable({
    seasonId: v.id("seasons"),
    subsystemId: v.union(v.id("subsystems"), v.null()),
    partId: v.union(v.id("parts"), v.null()),
    itemName: v.string(),
    vendor: v.string(),
    url: v.string(),
    quantity: v.number(),
    estimatedCost: v.union(v.number(), v.null()),
    reason: v.string(),
    status: orderStatus,
    requestedByProfileId: v.id("profiles"),
    approvedByProfileId: v.union(v.id("profiles"), v.null()),
    orderedByProfileId: v.union(v.id("profiles"), v.null()),
    requestedAt: v.number(),
    approvedAt: v.union(v.number(), v.null()),
    orderedAt: v.union(v.number(), v.null()),
    deliveredAt: v.union(v.number(), v.null()),
    notes: v.string(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_and_status", ["seasonId", "status"])
    .index("by_requestedByProfileId", ["requestedByProfileId"]),
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


