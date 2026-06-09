import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireActiveProfile, requireProfile, requireRole, requireSeasonAccess } from "./lib/authz";

export const list = query({
  args: {
    seasonId: v.id("seasons"),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await requireSeasonAccess(ctx, profile, args.seasonId);

    return await ctx.db
      .query("subsystems")
      .withIndex("by_seasonId_and_sortOrder", (q) => q.eq("seasonId", args.seasonId))
      .take(100);
  },
});

export const upsert = mutation({
  args: {
    seasonId: v.id("seasons"),
    subsystemId: v.optional(v.id("subsystems")),
    letter: v.string(),
    name: v.string(),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    requireRole(profile, ["admin"]);
    await requireSeasonAccess(ctx, profile, args.seasonId);

    const letter = args.letter.trim().toUpperCase();
    const name = args.name.trim();

    if (letter.length < 1 || letter.length > 3) {
      throw new Error("Subsystem letter must be 1-3 characters.");
    }

    if (!name) {
      throw new Error("Subsystem name is required.");
    }

    const existing = await ctx.db
      .query("subsystems")
      .withIndex("by_seasonId_and_letter", (q) =>
        q.eq("seasonId", args.seasonId).eq("letter", letter),
      )
      .unique();

    if (existing && existing._id !== args.subsystemId) {
      throw new Error("That subsystem letter already exists for this season.");
    }

    if (args.subsystemId) {
      const subsystem = await ctx.db.get(args.subsystemId);

      if (!subsystem || subsystem.seasonId !== args.seasonId) {
        throw new Error("Subsystem not found in this season.");
      }

      await ctx.db.patch(args.subsystemId, {
        letter,
        name,
        isEnabled: args.isEnabled,
      });
      return args.subsystemId;
    }

    return await ctx.db.insert("subsystems", {
      seasonId: args.seasonId,
      letter,
      name,
      nextPartNumber: 1,
      isEnabled: args.isEnabled,
      sortOrder: Date.now(),
    });
  },
});
