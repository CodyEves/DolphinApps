import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const editKindValidator = v.union(
  v.literal("text"),
  v.literal("color"),
  v.literal("background"),
  v.literal("image"),
);

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("Sign in as an admin to edit the site.");
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (profile?.role !== "admin") {
    throw new Error("Only admins can edit the site.");
  }

  return profile;
}

async function upsertEdit(
  ctx: MutationCtx,
  args: {
    pagePath: string;
    targetKey: string;
    kind: "text" | "color" | "background" | "image";
    value: string;
  },
) {
  const profile = await requireAdmin(ctx);
  const value = args.value.trim();

  if (!args.pagePath.trim() || !args.targetKey.trim()) {
    throw new Error("Choose something on the page before saving.");
  }

  const existing = await ctx.db
    .query("websiteEdits")
    .withIndex("by_page_target_kind", (q) =>
      q
        .eq("pagePath", args.pagePath)
        .eq("targetKey", args.targetKey)
        .eq("kind", args.kind),
    )
    .unique();
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      value,
      updatedBy: profile.userId,
      updatedAt: now,
    });

    return existing._id;
  }

  return await ctx.db.insert("websiteEdits", {
    pagePath: args.pagePath,
    targetKey: args.targetKey,
    kind: args.kind,
    value,
    updatedBy: profile.userId,
    updatedAt: now,
  });
}

export const listEdits = query({
  args: {
    pagePath: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("websiteEdits")
      .withIndex("by_page", (q) => q.eq("pagePath", args.pagePath))
      .collect();
  },
});

export const saveEdit = mutation({
  args: {
    pagePath: v.string(),
    targetKey: v.string(),
    kind: editKindValidator,
    value: v.string(),
  },
  handler: async (ctx, args) => {
    return await upsertEdit(ctx, args);
  },
});

export const deleteEdit = mutation({
  args: {
    editId: v.id("websiteEdits"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.editId);

    return args.editId;
  },
});

export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return await ctx.storage.generateUploadUrl();
  },
});

export const saveImageEdit = mutation({
  args: {
    pagePath: v.string(),
    targetKey: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);

    if (!url) {
      throw new Error("Uploaded image could not be loaded.");
    }

    return await upsertEdit(ctx, {
      pagePath: args.pagePath,
      targetKey: args.targetKey,
      kind: "image",
      value: url,
    });
  },
});
