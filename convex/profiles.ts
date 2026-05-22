import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

const roleValidator = v.union(
  v.literal("student"),
  v.literal("instructor"),
  v.literal("admin"),
);

async function currentUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  return await ctx.db.get(userId);
}

export const ensureCurrentUserProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("You must be signed in to create a profile.");
    }

    const user = await ctx.db.get(userId);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: user?.name,
        email: user?.email,
        updatedAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId,
      role: "student",
      displayName: user?.name,
      email: user?.email,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);

    if (!user) {
      return null;
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    return {
      user,
      profile: profile ?? {
        role: "student" as const,
        status: "active" as const,
        displayName: user.name,
        email: user.email,
      },
    };
  },
});

export const setRoleForEmail = mutation({
  args: {
    email: v.string(),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const admins = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .take(1);

    if (admins.length > 0) {
      const actingUserId = await getAuthUserId(ctx);

      if (!actingUserId) {
        throw new Error("Only an admin can change roles after bootstrap.");
      }

      const actingProfile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", actingUserId))
        .unique();

      if (actingProfile?.role !== "admin") {
        throw new Error("Only an admin can change roles.");
      }
    }

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!user) {
      throw new Error("No Convex Auth user exists with that email.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        displayName: user.name,
        email: user.email,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId: user._id,
      role: args.role,
      displayName: user.name,
      email: user.email,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});
