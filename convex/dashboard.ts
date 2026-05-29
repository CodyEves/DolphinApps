import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireProfile, requireSeasonAccess } from "./lib/authz";

export const overview = query({
  args: {
    seasonId: v.id("seasons"),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const season = await requireSeasonAccess(ctx, profile, args.seasonId);
    const subsystems = await ctx.db
      .query("subsystems")
      .withIndex("by_seasonId_and_sortOrder", (q) => q.eq("seasonId", args.seasonId))
      .take(100);
    const parts = await ctx.db
      .query("parts")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .order("desc")
      .take(200);
    const manufacturing = await ctx.db
      .query("parts")
      .withIndex("by_seasonId_and_status", (q) =>
        q.eq("seasonId", args.seasonId).eq("status", "inManufacturing"),
      )
      .order("desc")
      .take(100);
    const orders = await ctx.db
      .query("orderRequests")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .order("desc")
      .take(100);
    const transmissions = await ctx.db
      .query("transmissions")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .order("desc")
      .take(100);

    return {
      profile,
      season,
      subsystems,
      parts,
      manufacturing,
      orders,
      transmissions,
    };
  },
});
