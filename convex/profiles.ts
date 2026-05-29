import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { programForProfile, programValidator } from "./lib/programs";

const roleValidator = v.union(
  v.literal("student"),
  v.literal("instructor"),
  v.literal("mentor"),
  v.literal("guest"),
  v.literal("admin"),
);

const accountLabelValidator = v.union(
  v.literal("varsity_5199"),
  v.literal("jv_9271"),
  v.literal("mentor"),
  v.literal("guest"),
  v.literal("admin"),
);

async function currentUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  return await ctx.db.get(userId);
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("Only an admin can manage users.");
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (profile?.role !== "admin") {
    throw new Error("Only an admin can manage users.");
  }

  return profile;
}

function accountLabelForProfile(profile: {
  role: "student" | "instructor" | "mentor" | "guest" | "admin";
  primaryProgram?: "frc_5199" | "frc_9271";
  studentGroup?: string;
}) {
  if (profile.role === "admin") {
    return "admin" as const;
  }

  if (profile.role === "mentor" || profile.role === "instructor") {
    return "mentor" as const;
  }

  if (profile.role === "guest") {
    return "guest" as const;
  }

  if (programForProfile(profile) === "frc_9271") {
    return "jv_9271" as const;
  }

  return "varsity_5199" as const;
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
      .first();

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
      .first();

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

export const listUsersForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const profiles = await ctx.db.query("profiles").collect();
    const users = await Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);

        return {
          ...profile,
          user,
          accountLabel: accountLabelForProfile(profile),
        };
      }),
    );

    return users.sort((a, b) =>
      (a.displayName ?? a.email ?? a.user?.email ?? "").localeCompare(
        b.displayName ?? b.email ?? b.user?.email ?? "",
      ),
    );
  },
});

export const setAccountLabel = mutation({
  args: {
    userId: v.id("users"),
    accountLabel: accountLabelValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error("User not found.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const patch =
      args.accountLabel === "admin"
        ? { role: "admin" as const, studentGroup: undefined }
        : args.accountLabel === "mentor"
          ? { role: "mentor" as const, studentGroup: undefined }
          : args.accountLabel === "guest"
            ? { role: "guest" as const, studentGroup: undefined }
            : {
                role: "student" as const,
                primaryProgram:
                  args.accountLabel === "jv_9271" ? "frc_9271" as const : "frc_5199" as const,
                studentGroup:
                  args.accountLabel === "jv_9271" ? "9271 Student" : "5199 Student",
              };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...patch,
        displayName: user.name,
        email: user.email,
        updatedAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId: args.userId,
      ...patch,
      displayName: user.name,
      email: user.email,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setPrimaryProgram = mutation({
  args: {
    program: programValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("You must be signed in to choose a program.");
    }

    const user = await ctx.db.get(userId);
    const now = Date.now();
    const studentGroup = args.program === "frc_9271" ? "9271 Student" : "5199 Student";
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      if (existing.role !== "student") {
        throw new Error("Program onboarding is only available for student accounts.");
      }

      await ctx.db.patch(existing._id, {
        primaryProgram: args.program,
        studentGroup,
        displayName: user?.name,
        email: user?.email,
        updatedAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId,
      role: "student",
      primaryProgram: args.program,
      studentGroup,
      displayName: user?.name,
      email: user?.email,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
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
        .first();

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
      .first();

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
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const profiles = await ctx.db.query("profiles").take(500);

    return profiles
      .map((profile) => ({
        ...profile,
        name: profile.displayName ?? profile.email ?? "Team member",
        isActive: profile.status === "active",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const updateRole = mutation({
  args: {
    profileId: v.id("profiles"),
    role: roleValidator,
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await ctx.db.patch(args.profileId, {
      role: args.role,
      status: args.isActive ? "active" : "inactive",
      updatedAt: Date.now(),
    });

    return args.profileId;
  },
});
