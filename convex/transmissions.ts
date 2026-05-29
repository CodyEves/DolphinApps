import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireProfile, requireSeasonAccess } from "./lib/authz";

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
    const profile = await requireProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);
    const subsystem = await ctx.db.get(args.subsystemId);

    if (!subsystem || subsystem.seasonId !== args.seasonId) {
      throw new Error("Choose a subsystem in the active season.");
    }

    const now = Date.now();

    if (args.transmissionId) {
      const transmission = await ctx.db.get(args.transmissionId);

      if (!transmission || transmission.seasonId !== args.seasonId) {
        throw new Error("Transmission not found in this robot program season.");
      }

      const { transmissionId, ...patch } = args;
      await ctx.db.patch(transmissionId, {
        ...patch,
        name: patch.name.trim(),
        updatedByProfileId: profile._id,
        updatedAt: now,
      });
      return transmissionId;
    }

    return await ctx.db.insert("transmissions", {
      seasonId: args.seasonId,
      subsystemId: args.subsystemId,
      name: args.name.trim(),
      ratio: args.ratio,
      driverTeeth: args.driverTeeth,
      drivenTeeth: args.drivenTeeth,
      beltTeeth: args.beltTeeth,
      centerDistance: args.centerDistance,
      calculatorUrl: args.calculatorUrl,
      notes: args.notes,
      updatedByProfileId: profile._id,
      updatedAt: now,
    });
  },
});
