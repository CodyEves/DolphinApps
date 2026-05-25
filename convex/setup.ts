import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireProfile, requireRole } from "./lib/authz";

const defaultSubsystems = [
  ["D", "Drivetrain"],
  ["I", "Intake"],
  ["S", "Shooter"],
  ["A", "Arm"],
  ["E", "Elevator"],
  ["C", "Climber"],
  ["P", "Pneumatics"],
  ["W", "Wiring"],
  ["F", "Frame"],
] as const;

const defaultCatalogOptions = {
  material: ["6061 Aluminum", "7075 Aluminum", "Polycarbonate", "Delrin", "Steel", "3D Printed"],
  tool: ["CNC Router", "Mill", "Lathe", "Bandsaw", "Drill Press", "3D Printer"],
  bitSize: ['1/8"', '3/16"', '1/4"', '5mm', '6mm', "N/A"],
  storageLocation: ["On Robot", "Pit Spare Bin", "Fab Cart", "Subsystem Shelf", "Electrical Cabinet"],
} as const;

export const activeSeason = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return { profile: null, season: null };
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile || profile.status !== "active") {
      return { profile: null, season: null };
    }

    const season = await ctx.db
      .query("seasons")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .first();

    return { profile, season };
  },
});

export const seedDefaults = mutation({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    requireRole(profile, ["admin"]);

    const activeSeason = await ctx.db
      .query("seasons")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .first();

    const year = args.year ?? new Date().getFullYear();
    const seasonId =
      activeSeason?._id ??
      (await ctx.db.insert("seasons", {
        name: `${year} Robot`,
        year,
        isActive: true,
        createdByProfileId: profile._id,
      }));

    for (const [index, [letter, name]] of defaultSubsystems.entries()) {
      const existing = await ctx.db
        .query("subsystems")
        .withIndex("by_seasonId_and_letter", (q) =>
          q.eq("seasonId", seasonId).eq("letter", letter),
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("subsystems", {
          seasonId,
          letter,
          name,
          nextPartNumber: 1,
          isEnabled: true,
          sortOrder: index,
        });
      }
    }

    for (const [kind, labels] of Object.entries(defaultCatalogOptions)) {
      for (const [index, label] of labels.entries()) {
        const existing = await ctx.db
          .query("catalogOptions")
          .withIndex("by_kind_and_label", (q) =>
            q.eq("kind", kind as keyof typeof defaultCatalogOptions).eq("label", label),
          )
          .unique();

        if (!existing) {
          await ctx.db.insert("catalogOptions", {
            kind: kind as keyof typeof defaultCatalogOptions,
            label,
            isEnabled: true,
            sortOrder: index,
          });
        }
      }
    }

    return seasonId;
  },
});
