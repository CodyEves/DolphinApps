import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
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

  if (profile?.role !== "admin" || profile.status !== "active") {
    throw new Error("Only an admin can manage users.");
  }

  return profile;
}

async function provisionedAccountForProfile(
  ctx: QueryCtx | MutationCtx,
  profile: Doc<"profiles">,
) {
  return await ctx.db
    .query("provisionedAccounts")
    .withIndex("by_user", (q) => q.eq("userId", profile.userId))
    .first();
}

function userProfileFields(user: Doc<"users"> | null) {
  return {
    ...(user?.name ? { displayName: user.name } : {}),
    ...(user?.email ? { email: user.email } : {}),
  };
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
        role: "guest" as const,
        status: "inactive" as const,
        displayName: user.name,
      },
    };
  },
});

export const listUsersForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const profiles = (await ctx.db.query("profiles").collect()).filter(
      (profile) => !profile.archivedAt,
    );
    const users = await Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        const provisionedAccount = await provisionedAccountForProfile(ctx, profile);

        return {
          ...profile,
          user,
          provisionedAccount,
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

export const clearLegacyProfile = mutation({
  args: {
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const profile = await ctx.db.get(args.profileId);

    if (!profile) {
      return args.profileId;
    }

    if (profile.userId === admin.userId) {
      throw new Error("You cannot clear your own profile.");
    }

    const provisionedAccount = await provisionedAccountForProfile(ctx, profile);

    if (provisionedAccount) {
      throw new Error("This profile is linked to a provisioned account.");
    }

    await ctx.db.patch(args.profileId, {
      status: "inactive",
      archivedAt: Date.now(),
      archivedBy: admin.userId,
      updatedAt: Date.now(),
    });

    return args.profileId;
  },
});

export const clearLegacyProfiles = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const profiles = (await ctx.db.query("profiles").collect()).filter(
      (profile) => !profile.archivedAt,
    );
    let clearedCount = 0;
    let skippedCount = 0;

    for (const profile of profiles) {
      if (profile.userId === admin.userId) {
        skippedCount += 1;
        continue;
      }

      const provisionedAccount = await provisionedAccountForProfile(ctx, profile);

      if (provisionedAccount) {
        skippedCount += 1;
        continue;
      }

      await ctx.db.patch(profile._id, {
        status: "inactive",
        archivedAt: Date.now(),
        archivedBy: admin.userId,
        updatedAt: Date.now(),
      });
      clearedCount += 1;
    }

    return { clearedCount, skippedCount };
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
        ...userProfileFields(user),
        updatedAt: now,
      });

      const provisionedAccount = await ctx.db
        .query("provisionedAccounts")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();

      if (provisionedAccount) {
        await ctx.db.patch(provisionedAccount._id, {
          accountLabel: args.accountLabel,
          updatedAt: now,
        });
      }

      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId: args.userId,
      ...patch,
      ...userProfileFields(user),
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
        ...userProfileFields(user),
        updatedAt: now,
      });

      return existing._id;
    }

    throw new Error("Ask an admin to provision your team account.");
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
        ...userProfileFields(user),
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId: user._id,
      role: args.role,
      ...userProfileFields(user),
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
    const profiles = (await ctx.db.query("profiles").take(500)).filter(
      (profile) => !profile.archivedAt,
    );

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
