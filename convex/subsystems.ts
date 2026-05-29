import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireProfile, requireRole, requireSeasonAccess } from "./lib/authz";

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
    const profile = await requireProfile(ctx);
    requireRole(profile, ["admin"]);
    await requireSeasonAccess(ctx, profile, args.seasonId);

    const letter = args.letter.trim().toUpperCase();

    if (letter.length < 1 || letter.length > 3) {
      throw new Error("Subsystem letter must be 1-3 characters.");
    }

    if (args.subsystemId) {
      await ctx.db.patch(args.subsystemId, {
        letter,
        name: args.name.trim(),
        isEnabled: args.isEnabled,
      });
      return args.subsystemId;
    }

    const existing = await ctx.db
      .query("subsystems")
      .withIndex("by_seasonId_and_letter", (q) =>
        q.eq("seasonId", args.seasonId).eq("letter", letter),
      )
      .unique();

    if (existing) {
      throw new Error("That subsystem letter already exists for this season.");
    }

    return await ctx.db.insert("subsystems", {
      seasonId: args.seasonId,
      letter,
      name: args.name.trim(),
      nextPartNumber: 1,
      isEnabled: args.isEnabled,
      sortOrder: Date.now(),
    });
  },
});
