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
    const manufacturing = parts.filter(
      (part) => part.status === "readyForFab" || part.status === "inManufacturing",
    );
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
    const designerIds = new Set(
      parts
        .map((part) => part.designedByProfileId)
        .filter((profileId): profileId is NonNullable<typeof profileId> => profileId !== null),
    );
    const designers = await Promise.all(
      [...designerIds].map(async (profileId) => await ctx.db.get(profileId)),
    );

    return {
      profile,
      season,
      subsystems,
      parts,
      manufacturing,
      orders,
      transmissions,
      designers: designers.filter((designer) => designer !== null),
    };
  },
});
