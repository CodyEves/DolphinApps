import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("student"),
  v.literal("mentor"),
  v.literal("admin"),
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
