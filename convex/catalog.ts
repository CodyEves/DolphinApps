import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireActiveProfile, requireProfile, requireRole } from "./lib/authz";
import { catalogKindValidator } from "./lib/validators";

const catalogKinds = ["material", "tool", "bitSize", "storageLocation"] as const;

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);

    const groups = await Promise.all(
      catalogKinds.map((kind) =>
        ctx.db
          .query("catalogOptions")
          .withIndex("by_kind_sort_order", (q) => q.eq("kind", kind))
          .collect(),
      ),
    );

    return groups.flat();
  },
});

export const upsert = mutation({
  args: {
    kind: catalogKindValidator,
    label: v.string(),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    requireRole(profile, ["admin"]);
    const label = args.label.trim();

    if (!label) {
      throw new Error("Catalog option label is required.");
    }

    const existing = await ctx.db
      .query("catalogOptions")
      .withIndex("by_kind_and_label", (q) =>
        q.eq("kind", args.kind).eq("label", label),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isEnabled: args.isEnabled,
      });
      return existing._id;
    }

    return await ctx.db.insert("catalogOptions", {
      kind: args.kind,
      label,
      isEnabled: args.isEnabled,
      sortOrder: Date.now(),
    });
  },
});
