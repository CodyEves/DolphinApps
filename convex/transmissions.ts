import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireActiveProfile, requireProfile, requireSeasonAccess } from "./lib/authz";

function normalizeOptionalPositiveInteger(value: number | null, label: string) {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a whole number of at least 1.`);
  }

  return value;
}

export const list = query({
  args: {
    seasonId: v.id("seasons"),
    subsystemId: v.optional(v.id("subsystems")),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);

    if (args.subsystemId) {
      const subsystemId = args.subsystemId;
      return await ctx.db
        .query("transmissions")
        .withIndex("by_seasonId_and_subsystemId", (q) =>
          q.eq("seasonId", args.seasonId).eq("subsystemId", subsystemId),
        )
        .order("desc")
        .take(100);
    }

    return await ctx.db
      .query("transmissions")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .order("desc")
      .take(100);
  },
});

export const upsert = mutation({
  args: {
    transmissionId: v.optional(v.id("transmissions")),
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
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);
    const subsystem = await ctx.db.get(args.subsystemId);

    if (!subsystem || subsystem.seasonId !== args.seasonId) {
      throw new Error("Choose a subsystem in the active season.");
    }

    const transmission = {
      seasonId: args.seasonId,
      subsystemId: args.subsystemId,
      name: args.name.trim(),
      ratio: args.ratio.trim(),
      driverTeeth: normalizeOptionalPositiveInteger(args.driverTeeth, "Driver teeth"),
      drivenTeeth: normalizeOptionalPositiveInteger(args.drivenTeeth, "Driven teeth"),
      beltTeeth: normalizeOptionalPositiveInteger(args.beltTeeth, "Belt teeth"),
      centerDistance: args.centerDistance.trim(),
      calculatorUrl: args.calculatorUrl.trim(),
      notes: args.notes.trim(),
    };

    if (!transmission.name) {
      throw new Error("Transmission name is required.");
    }

    const now = Date.now();

    if (args.transmissionId) {
      const existingTransmission = await ctx.db.get(args.transmissionId);

      if (!existingTransmission || existingTransmission.seasonId !== args.seasonId) {
        throw new Error("Transmission not found in this robot program season.");
      }

      await ctx.db.patch(args.transmissionId, {
        ...transmission,
        updatedByProfileId: profile._id,
        updatedAt: now,
      });
      return args.transmissionId;
    }

    return await ctx.db.insert("transmissions", {
      ...transmission,
      updatedByProfileId: profile._id,
      updatedAt: now,
    });
  },
});
