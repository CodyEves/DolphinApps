import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireActiveProfile, requireProfile, requireRole, requireSeasonAccess } from "./lib/authz";
import { requirePartsTeamAccess, teamNumberForSeason } from "./lib/programs";
import { formatPartNumber } from "./lib/parts";
import { partKindValidator, partStatusValidator, priorityValidator } from "./lib/validators";

type PartStatus = Doc<"parts">["status"];
type CatalogKind = Doc<"catalogOptions">["kind"];

type PartFieldInput = {
  name: string;
  quantity: number;
  materialOptionId: Id<"catalogOptions"> | null;
  toolOptionId: Id<"catalogOptions"> | null;
  bitSizeOptionId: Id<"catalogOptions"> | null;
  sizeProfile?: string;
  storageLocationOptionId: Id<"catalogOptions"> | null;
  onshapeDocumentUrl: string;
  onshapePartStudioUrl: string;
  onshapeDrawingUrl: string;
  notes: string;
};

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
  sizeProfile: v.optional(v.string()),
  storageLocationOptionId: v.union(v.id("catalogOptions"), v.null()),
  onshapeDocumentUrl: v.string(),
  onshapePartStudioUrl: v.string(),
  onshapeDrawingUrl: v.string(),
  notes: v.string(),
  supersedesPartId: v.optional(v.union(v.id("parts"), v.null())),
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

async function requireSubsystemInSeason(
  ctx: MutationCtx,
  subsystemId: Id<"subsystems">,
  seasonId: Id<"seasons">,
) {
  const subsystem = await ctx.db.get(subsystemId);

  if (!subsystem || subsystem.seasonId !== seasonId || !subsystem.isEnabled) {
    throw new Error("Choose an enabled subsystem in the active season.");
  }

  return subsystem;
}

async function requireSupersededPartInSeason(
  ctx: MutationCtx,
  supersedesPartId: Id<"parts"> | null,
  seasonId: Id<"seasons">,
) {
  if (!supersedesPartId) {
    return null;
  }

  const supersededPart = await ctx.db.get(supersedesPartId);

  if (!supersededPart || supersededPart.seasonId !== seasonId) {
    throw new Error("Choose a superseded part from the same robot program season.");
  }

  return supersededPart;
}

async function requireCatalogOptionKind(
  ctx: MutationCtx,
  optionId: Id<"catalogOptions"> | null,
  kind: CatalogKind,
) {
  if (!optionId) {
    return;
  }

  const option = await ctx.db.get(optionId);

  if (!option || option.kind !== kind || !option.isEnabled) {
    throw new Error(`Choose an enabled ${kind} catalog option.`);
  }
}

async function requirePartCatalogOptions(ctx: MutationCtx, input: PartFieldInput) {
  await Promise.all([
    requireCatalogOptionKind(ctx, input.materialOptionId, "material"),
    requireCatalogOptionKind(ctx, input.toolOptionId, "tool"),
    requireCatalogOptionKind(ctx, input.bitSizeOptionId, "bitSize"),
    requireCatalogOptionKind(ctx, input.storageLocationOptionId, "storageLocation"),
  ]);
}

function normalizedPartFields<T extends PartFieldInput>(input: T) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Part name is required.");
  }

  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new Error("Quantity must be a whole number of at least 1.");
  }

  return {
    ...input,
    name,
    sizeProfile: (input.sizeProfile ?? "").trim(),
    onshapeDocumentUrl: input.onshapeDocumentUrl.trim(),
    onshapePartStudioUrl: input.onshapePartStudioUrl.trim(),
    onshapeDrawingUrl: input.onshapeDrawingUrl.trim(),
    notes: input.notes.trim(),
  };
}

async function nextAvailablePartNumber(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
  letter: string,
  startingSequenceNumber: number,
) {
  let sequenceNumber = Number.isFinite(startingSequenceNumber)
    ? Math.max(1, Math.trunc(startingSequenceNumber))
    : 1;

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const partNumber = formatPartNumber(letter, sequenceNumber);
    const duplicate = await ctx.db
      .query("parts")
      .withIndex("by_seasonId_and_partNumber", (q) =>
        q.eq("seasonId", seasonId).eq("partNumber", partNumber),
      )
      .first();

    if (!duplicate) {
      return { partNumber, sequenceNumber };
    }

    sequenceNumber += 1;
  }

  throw new Error("No available part number found for this subsystem.");
}

export const list = query({
  args: {
    seasonId: v.id("seasons"),
    subsystemId: v.optional(v.id("subsystems")),
    status: v.optional(partStatusValidator),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);

    if (args.subsystemId) {
      const subsystem = await ctx.db.get(args.subsystemId);

      if (!subsystem || subsystem.seasonId !== args.seasonId) {
        throw new Error("Choose a subsystem in the active season.");
      }
    }

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
    const profile = await requireProfile(ctx);

    const part = await ctx.db.get(args.partId);
    if (!part) {
      return null;
    }

    const season = await ctx.db.get(part.seasonId);
    if (!season) {
      return null;
    }
    requirePartsTeamAccess(profile, teamNumberForSeason(season));

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
    const profile = await requireActiveProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);
    await requireSubsystemInSeason(ctx, args.subsystemId, args.seasonId);
    const supersedesPartId = args.supersedesPartId ?? null;
    await requireSupersededPartInSeason(ctx, supersedesPartId, args.seasonId);
    await requirePartCatalogOptions(ctx, args);
    const partFields = normalizedPartFields(args);
    const now = Date.now();

    const partId = await ctx.db.insert("parts", {
      ...partFields,
      supersedesPartId,
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
    const profile = await requireActiveProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);
    const subsystem = await requireSubsystemInSeason(ctx, args.subsystemId, args.seasonId);
    const supersedesPartId = args.supersedesPartId ?? null;
    await requireSupersededPartInSeason(ctx, supersedesPartId, args.seasonId);
    await requirePartCatalogOptions(ctx, args);
    const partFields = normalizedPartFields(args);

    const { partNumber, sequenceNumber } = await nextAvailablePartNumber(
      ctx,
      args.seasonId,
      subsystem.letter,
      subsystem.nextPartNumber,
    );

    await ctx.db.patch(args.subsystemId, {
      nextPartNumber: sequenceNumber + 1,
    });

    const now = Date.now();
    const partId = await ctx.db.insert("parts", {
      ...partFields,
      supersedesPartId,
      partNumber,
      sequenceNumber,
      status: "inDesign",
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
      "inDesign",
      `Generated ${partNumber} and started design.`,
    );
    return partId;
  },
});

export const generateNumber = mutation({
  args: {
    seasonId: v.id("seasons"),
    subsystemId: v.id("subsystems"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);
    const subsystem = await requireSubsystemInSeason(ctx, args.subsystemId, args.seasonId);

    const { partNumber, sequenceNumber } = await nextAvailablePartNumber(
      ctx,
      args.seasonId,
      subsystem.letter,
      subsystem.nextPartNumber,
    );

    await ctx.db.patch(args.subsystemId, {
      nextPartNumber: sequenceNumber + 1,
    });

    const now = Date.now();
    const partId = await ctx.db.insert("parts", {
      seasonId: args.seasonId,
      subsystemId: args.subsystemId,
      name: args.name.trim(),
      kind: "part",
      quantity: 1,
      priority: "normal",
      materialOptionId: null,
      toolOptionId: null,
      bitSizeOptionId: null,
      sizeProfile: "",
      storageLocationOptionId: null,
      onshapeDocumentUrl: "",
      onshapePartStudioUrl: "",
      onshapeDrawingUrl: "",
      notes: "",
      supersedesPartId: null,
      partNumber,
      sequenceNumber,
      status: "inDesign",
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
      "inDesign",
      `Generated ${partNumber} and started design.`,
    );

    return { partId, partNumber };
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
    sizeProfile: v.string(),
    storageLocationOptionId: v.union(v.id("catalogOptions"), v.null()),
    onshapeDocumentUrl: v.string(),
    onshapePartStudioUrl: v.string(),
    onshapeDrawingUrl: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    const { partId, ...patch } = args;
    const part = await ctx.db.get(partId);

    if (!part) {
      throw new Error("Part not found.");
    }

    await requireSeasonAccess(ctx, profile, part.seasonId);
    await requirePartCatalogOptions(ctx, patch);
    const partFields = normalizedPartFields(patch);

    await ctx.db.patch(partId, {
      ...partFields,
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
    const profile = await requireActiveProfile(ctx);
    const part = await ctx.db.get(args.partId);

    if (!part) {
      throw new Error("Part not found.");
    }

    await requireSeasonAccess(ctx, profile, part.seasonId);
    await requireCatalogOptionKind(ctx, args.storageLocationOptionId, "storageLocation");

    if (
      args.status === "readyForFab" ||
      args.status === "inManufacturing" ||
      args.status === "deprecated"
    ) {
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
    const profile = await requireActiveProfile(ctx);

    if (args.parentPartId === args.childPartId) {
      throw new Error("A part cannot contain itself.");
    }

    if (!Number.isInteger(args.quantity) || args.quantity < 1) {
      throw new Error("BOM quantity must be a whole number of at least 1.");
    }

    const parentPart = await ctx.db.get(args.parentPartId);
    const childPart = await ctx.db.get(args.childPartId);
    const notes = args.notes.trim();

    if (!parentPart || !childPart || parentPart.seasonId !== childPart.seasonId) {
      throw new Error("Choose parts from the same robot program season.");
    }

    await requireSeasonAccess(ctx, profile, parentPart.seasonId);

    const existing = await ctx.db
      .query("partLinks")
      .withIndex("by_parentPartId_and_childPartId", (q) =>
        q.eq("parentPartId", args.parentPartId).eq("childPartId", args.childPartId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
        notes,
      });
      return existing._id;
    }

    return await ctx.db.insert("partLinks", {
      ...args,
      notes,
    });
  },
});

export const removeBomLink = mutation({
  args: {
    linkId: v.id("partLinks"),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    const link = await ctx.db.get(args.linkId);

    if (!link) {
      return null;
    }

    const parentPart = await ctx.db.get(link.parentPartId);
    if (!parentPart) {
      await ctx.db.delete(args.linkId);
      return null;
    }

    await requireSeasonAccess(ctx, profile, parentPart.seasonId);
    await ctx.db.delete(args.linkId);
    return null;
  },
});


