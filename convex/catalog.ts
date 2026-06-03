import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireActiveProfile, requireProfile, requireRole } from "./lib/authz";
import { catalogKindValidator } from "./lib/validators";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);

    return await ctx.db.query("catalogOptions").take(200);
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

    const existing = await ctx.db
      .query("catalogOptions")
      .withIndex("by_kind_and_label", (q) =>
        q.eq("kind", args.kind).eq("label", args.label),
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
      label: args.label,
      isEnabled: args.isEnabled,
      sortOrder: Date.now(),
    });
  },
});
