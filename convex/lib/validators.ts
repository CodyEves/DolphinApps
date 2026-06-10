import { v } from "convex/values";

export const programValidator = v.union(
  v.literal("frc_5199"),
  v.literal("frc_9271"),
);

export const roleValidator = v.union(
  v.literal("student"),
  v.literal("instructor"),
  v.literal("mentor"),
  v.literal("guest"),
  v.literal("kiosk"),
  v.literal("admin"),
);

export const activeStatusValidator = v.union(v.literal("active"), v.literal("inactive"));

export const accountLabelValidator = v.union(
  v.literal("varsity_5199"),
  v.literal("jv_9271"),
  v.literal("mentor"),
  v.literal("guest"),
  v.literal("kiosk"),
  v.literal("admin"),
);

export const provisionedAccountStatusValidator = v.union(
  v.literal("pending_setup"),
  v.literal("active"),
  v.literal("inactive"),
);

export const credentialLinkPurposeValidator = v.union(
  v.literal("initial_setup"),
  v.literal("password_reset"),
);

export const trainingLevelValidator = v.union(
  v.literal("intro"),
  v.literal("intermediate"),
  v.literal("advanced"),
);

export const lessonTypeValidator = v.union(
  v.literal("video"),
  v.literal("video_assignment"),
  v.literal("exam"),
  v.literal("reading"),
  v.literal("exercise"),
);

export const progressStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("started"),
  v.literal("completed"),
);

export const questionTypeValidator = v.union(
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

export const equipmentQuestionTypeValidator = v.union(
  v.literal("multiple_choice"),
  v.literal("true_false"),
  v.literal("short_answer"),
  v.literal("fill_blank"),
  v.literal("file_upload"),
);

export const lessonResourceTypeValidator = v.union(
  v.literal("link"),
  v.literal("file"),
  v.literal("note"),
);

export const attemptStatusValidator = v.union(
  v.literal("in_progress"),
  v.literal("passed"),
  v.literal("failed"),
);

export const submissionStatusValidator = v.union(
  v.literal("submitted"),
  v.literal("needs_revision"),
  v.literal("approved"),
);

export const signOffStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("requested"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("expired"),
);

export const approvalActionValidator = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("commented"),
);

export const websiteEditKindValidator = v.union(
  v.literal("text"),
  v.literal("color"),
  v.literal("background"),
  v.literal("image"),
);

export const partStatusValidator = v.union(
  v.literal("draft"),
  v.literal("inDesign"),
  v.literal("submittedForReview"),
  v.literal("readyForFab"),
  v.literal("inManufacturing"),
  v.literal("manufactured"),
  v.literal("stored"),
  v.literal("onRobot"),
  v.literal("deprecated"),
);

export const priorityValidator = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
  v.literal("critical"),
);

export const partKindValidator = v.union(v.literal("part"), v.literal("assembly"));

export const partEventTypeValidator = v.union(
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

export const catalogKindValidator = v.union(
  v.literal("material"),
  v.literal("tool"),
  v.literal("bitSize"),
  v.literal("storageLocation"),
);

export const orderStatusValidator = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("ordered"),
  v.literal("backordered"),
  v.literal("delivered"),
  v.literal("canceled"),
);

export const shopSessionStatusValidator = v.union(v.literal("active"), v.literal("closed"));

export const attendanceStatusValidator = v.union(
  v.literal("open"),
  v.literal("complete"),
  v.literal("needs_review"),
  v.literal("void"),
);

export const attendanceSourceValidator = v.union(
  v.literal("slack"),
  v.literal("web"),
  v.literal("manual"),
);

export const attendanceEventStatusValidator = v.union(
  v.literal("active"),
  v.literal("closed"),
);

export const teamNumberValidator = v.union(v.literal("5199"), v.literal("9271"));
