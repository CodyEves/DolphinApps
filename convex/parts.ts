import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireProfile, requireRole } from "./lib/authz";
import { formatPartNumber } from "./lib/parts";
import { partKindValidator, partStatusValidator, priorityValidator } from "./lib/validators";

type PartStatus = Doc<"parts">["status"];

const partInput = {
  seasonId: v.id("seasons"),
  subsystemId: v.id("subsystems"),
  name: v.string(),
  kind: partKindValidator,
  quantity: v.number(),
  priority: priorityValidator,
  materialOptionId: v.union(v.id("catalogOptions"), v.null()),
  toolOptionId: v.union(v.id("catalogOptions"), v.null()),
  bitSizeOptionId: v.union(v.id("catalogOptions"), v.null()),
  storageLocationOptionId: v.union(v.id("catalogOptions"), v.null()),
  onshapeDocumentUrl: v.string(),
  onshapePartStudioUrl: v.string(),
  onshapeDrawingUrl: v.string(),
  notes: v.string(),
  supersedesPartId: v.union(v.id("parts"), v.null()),
};

async function insertEvent(
  ctx: MutationCtx,
  partId: Id<"parts">,
  profileId: Id<"profiles"> | null,
  eventType:
    | "createdDraft"
    | "generated"
    | "designed"
    | "statusChanged"
    | "manufactured"
    | "stored"
    | "installed"
    | "deprecated"
    | "note",
  fromStatus: PartStatus | null,
  toStatus: PartStatus | null,
  note: string,
) {
  await ctx.db.insert("partEvents", {
    partId,
    eventType,
    profileId,
    occurredAt: Date.now(),
    fromStatus,
    toStatus,
    note,
  });
}

export const list = query({
  args: {
    seasonId: v.id("seasons"),
    subsystemId: v.optional(v.id("subsystems")),
    status: v.optional(partStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireProfile(ctx);

    if (args.subsystemId && args.status) {
      const subsystemId = args.subsystemId;
      const status = args.status;
      return await ctx.db
        .query("parts")
        .withIndex("by_subsystemId_and_status", (q) =>
          q.eq("subsystemId", subsystemId).eq("status", status),
        )
        .order("desc")
        .take(200);
    }

    if (args.subsystemId) {
      const subsystemId = args.subsystemId;
      return await ctx.db
        .query("parts")
        .withIndex("by_seasonId_and_subsystemId", (q) =>
          q.eq("seasonId", args.seasonId).eq("subsystemId", subsystemId),
        )
        .order("desc")
        .take(200);
    }

    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("parts")
        .withIndex("by_seasonId_and_status", (q) =>
          q.eq("seasonId", args.seasonId).eq("status", status),
        )
        .order("desc")
        .take(200);
    }

    return await ctx.db
      .query("parts")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .order("desc")
      .take(200);
  },
});

export const detail = query({
  args: {
    partId: v.id("parts"),
  },
  handler: async (ctx, args) => {
    await requireProfile(ctx);

    const part = await ctx.db.get(args.partId);
    if (!part) {
      return null;
    }

    const children = await ctx.db
      .query("partLinks")
      .withIndex("by_parentPartId", (q) => q.eq("parentPartId", args.partId))
      .take(100);
    const parents = await ctx.db
      .query("partLinks")
      .withIndex("by_childPartId", (q) => q.eq("childPartId", args.partId))
      .take(100);
    const events = await ctx.db
      .query("partEvents")
      .withIndex("by_partId_and_occurredAt", (q) => q.eq("partId", args.partId))
      .order("desc")
      .take(100);

    return { part, children, parents, events };
  },
});

export const saveDraft = mutation({
  args: partInput,
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const now = Date.now();

    const partId = await ctx.db.insert("parts", {
      ...args,
      name: args.name.trim(),
      partNumber: null,
      sequenceNumber: null,
      status: "draft",
      designedByProfileId: profile._id,
      manufacturedByProfileId: null,
      designedAt: now,
      manufacturedAt: null,
      installedAt: null,
      deprecatedAt: null,
    });

    await insertEvent(ctx, partId, profile._id, "createdDraft", null, "draft", "Draft saved.");
    return partId;
  },
});

export const generate = mutation({
  args: partInput,
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const subsystem = await ctx.db.get(args.subsystemId);

    if (!subsystem || subsystem.seasonId !== args.seasonId || !subsystem.isEnabled) {
      throw new Error("Choose an enabled subsystem in the active season.");
    }

    const sequenceNumber = subsystem.nextPartNumber;
    const partNumber = formatPartNumber(subsystem.letter, sequenceNumber);
    const duplicate = await ctx.db
      .query("parts")
      .withIndex("by_seasonId_and_partNumber", (q) =>
        q.eq("seasonId", args.seasonId).eq("partNumber", partNumber),
      )
      .unique();

    if (duplicate) {
      throw new Error("Part number collision detected. Try again.");
    }

    await ctx.db.patch(args.subsystemId, {
      nextPartNumber: sequenceNumber + 1,
    });

    const now = Date.now();
    const partId = await ctx.db.insert("parts", {
      ...args,
      name: args.name.trim(),
      partNumber,
      sequenceNumber,
      status: "inManufacturing",
      designedByProfileId: profile._id,
      manufacturedByProfileId: null,
      designedAt: now,
      manufacturedAt: null,
      installedAt: null,
      deprecatedAt: null,
    });

    await insertEvent(
      ctx,
      partId,
      profile._id,
      "generated",
      null,
      "inManufacturing",
      `Generated ${partNumber} and moved to manufacturing.`,
    );
    return partId;
  },
});

export const update = mutation({
  args: {
    partId: v.id("parts"),
    name: v.string(),
    kind: partKindValidator,
    quantity: v.number(),
    priority: priorityValidator,
    materialOptionId: v.union(v.id("catalogOptions"), v.null()),
    toolOptionId: v.union(v.id("catalogOptions"), v.null()),
    bitSizeOptionId: v.union(v.id("catalogOptions"), v.null()),
    storageLocationOptionId: v.union(v.id("catalogOptions"), v.null()),
    onshapeDocumentUrl: v.string(),
    onshapePartStudioUrl: v.string(),
    onshapeDrawingUrl: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireProfile(ctx);
    const { partId, ...patch } = args;

    await ctx.db.patch(partId, {
      ...patch,
      name: patch.name.trim(),
    });

    return null;
  },
});

export const updateStatus = mutation({
  args: {
    partId: v.id("parts"),
    status: partStatusValidator,
    note: v.string(),
    storageLocationOptionId: v.union(v.id("catalogOptions"), v.null()),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const part = await ctx.db.get(args.partId);

    if (!part) {
      throw new Error("Part not found.");
    }

    if (args.status === "deprecated") {
      requireRole(profile, ["mentor", "admin"]);
    }

    const now = Date.now();
    const patch = {
      status: args.status,
      storageLocationOptionId:
        args.storageLocationOptionId ?? part.storageLocationOptionId,
      manufacturedAt:
        args.status === "manufactured" ? now : part.manufacturedAt,
      manufacturedByProfileId:
        args.status === "manufactured" ? profile._id : part.manufacturedByProfileId,
      installedAt: args.status === "onRobot" ? now : part.installedAt,
      deprecatedAt: args.status === "deprecated" ? now : part.deprecatedAt,
    };

    await ctx.db.patch(args.partId, patch);
    await insertEvent(
      ctx,
      args.partId,
      profile._id,
      args.status === "deprecated" ? "deprecated" : "statusChanged",
      part.status,
      args.status,
      args.note.trim(),
    );

    return null;
  },
});

export const addBomLink = mutation({
  args: {
    parentPartId: v.id("parts"),
    childPartId: v.id("parts"),
    quantity: v.number(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireProfile(ctx);

    if (args.parentPartId === args.childPartId) {
      throw new Error("A part cannot contain itself.");
    }

    const existing = await ctx.db
      .query("partLinks")
      .withIndex("by_parentPartId_and_childPartId", (q) =>
        q.eq("parentPartId", args.parentPartId).eq("childPartId", args.childPartId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
        notes: args.notes,
      });
      return existing._id;
    }

    return await ctx.db.insert("partLinks", args);
  },
});

export const removeBomLink = mutation({
  args: {
    linkId: v.id("partLinks"),
  },
  handler: async (ctx, args) => {
    await requireProfile(ctx);
    await ctx.db.delete(args.linkId);
    return null;
  },
});


