import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  accountLabelValidator,
  credentialLinkPurposeValidator,
  programValidator,
} from "./lib/validators";

type AccountLabel = Doc<"provisionedAccounts">["accountLabel"];
const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/;

function normalizeUsernamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16);
}

function usernameBase(displayName: string) {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .map(normalizeUsernamePart)
    .filter(Boolean);
  const first = parts[0] ?? "student";
  const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : "x";

  return `${first}.${lastInitial}`;
}

function normalizeNamePart(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function namePartsFromInput(input: {
  firstName?: string;
  lastName?: string;
  displayName?: string;
}) {
  const explicitFirstName = normalizeNamePart(input.firstName);
  const explicitLastName = normalizeNamePart(input.lastName);

  if (explicitFirstName && explicitLastName) {
    return {
      firstName: explicitFirstName,
      lastName: explicitLastName,
      displayName: `${explicitFirstName} ${explicitLastName}`,
    };
  }

  const displayName = normalizeNamePart(input.displayName);
  const parts = displayName.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
      displayName,
    };
  }

  throw new Error("First and last name are required.");
}

async function nextAccountNumber(ctx: QueryCtx | MutationCtx, reserved: Set<string>) {
  const accounts = await ctx.db.query("provisionedAccounts").collect();
  let maxAccountNumber = 100000;

  for (const account of accounts) {
    const parsed = Number(account.accountNumber);

    if (Number.isInteger(parsed)) {
      maxAccountNumber = Math.max(maxAccountNumber, parsed);
    }
  }

  for (let offset = 1; offset <= 9999; offset += 1) {
    const candidate = String(maxAccountNumber + offset);

    if (reserved.has(candidate)) {
      continue;
    }

    const existing = await ctx.db
      .query("provisionedAccounts")
      .withIndex("by_account_number", (q) => q.eq("accountNumber", candidate))
      .first();

    if (!existing) {
      reserved.add(candidate);
      return candidate;
    }
  }

  throw new Error("Could not assign a unique account ID.");
}

async function uniqueUsername(ctx: QueryCtx | MutationCtx, displayName: string, reserved: Set<string>) {
  const base = usernameBase(displayName);

  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const candidate = `${base}${String(suffix).padStart(3, "0")}`;

    if (reserved.has(candidate)) {
      continue;
    }

    const existing = await ctx.db
      .query("provisionedAccounts")
      .withIndex("by_username", (q) => q.eq("username", candidate))
      .first();

    if (!existing) {
      reserved.add(candidate);
      return candidate;
    }
  }

  throw new Error("Could not generate a unique username for that name.");
}

function profilePatchForAccount(account: {
  accountLabel: AccountLabel;
  displayName: string;
  graduationYear?: number;
}) {
  if (account.accountLabel === "admin") {
    return { role: "admin" as const, studentGroup: undefined, primaryProgram: undefined };
  }

  if (account.accountLabel === "mentor") {
    return { role: "mentor" as const, studentGroup: undefined, primaryProgram: undefined };
  }

  if (account.accountLabel === "guest") {
    return { role: "guest" as const, studentGroup: undefined, primaryProgram: undefined };
  }

  if (account.accountLabel === "kiosk") {
    return { role: "kiosk" as const, studentGroup: undefined, primaryProgram: undefined };
  }

  const is9271 = account.accountLabel === "jv_9271";

  return {
    role: "student" as const,
    primaryProgram: is9271 ? "frc_9271" as const : "frc_5199" as const,
    studentGroup: is9271 ? "9271 Student" : "5199 Student",
    graduationYear: account.graduationYear,
  };
}

function normalizeChosenUsername(value: string) {
  return value.trim().toLowerCase();
}

function validateChosenUsername(username: string) {
  if (!usernamePattern.test(username)) {
    throw new Error(
      "Username must be 3-32 characters and use lowercase letters, numbers, periods, underscores, or hyphens.",
    );
  }
}

function isStudentLabel(accountLabel: AccountLabel) {
  return accountLabel === "varsity_5199" || accountLabel === "jv_9271";
}

function programForAccountLabel(accountLabel: AccountLabel) {
  return accountLabel === "jv_9271" ? "frc_9271" as const : "frc_5199" as const;
}

async function currentAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("Only an admin can manage provisioned accounts.");
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (profile?.role !== "admin" || profile.status !== "active") {
    throw new Error("Only an admin can manage provisioned accounts.");
  }

  return profile;
}

async function requireAdminOrFirstAdminBootstrap(
  ctx: MutationCtx,
  accountLabel: AccountLabel,
) {
  const provisionedAdmins = await ctx.db
    .query("provisionedAccounts")
    .withIndex("by_account_label", (q) => q.eq("accountLabel", "admin"))
    .collect();

  if (
    accountLabel === "admin" &&
    !provisionedAdmins.some(
      (account) => account.accountLabel === "admin" && account.status !== "inactive",
    )
  ) {
    return undefined;
  }

  return (await currentAdmin(ctx)).userId;
}

async function insertCredentialLink(
  ctx: MutationCtx,
  args: {
    provisionedAccountId: Id<"provisionedAccounts">;
    tokenHash: string;
    purpose: Doc<"credentialLinks">["purpose"];
    expiresAt: number;
    createdBy?: Id<"users">;
  },
) {
  const existing = await ctx.db
    .query("credentialLinks")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
    .first();

  if (existing) {
    throw new Error("Credential link token collision. Generate a new link.");
  }

  return await ctx.db.insert("credentialLinks", {
    provisionedAccountId: args.provisionedAccountId,
    tokenHash: args.tokenHash,
    purpose: args.purpose,
    expiresAt: args.expiresAt,
    createdBy: args.createdBy,
    createdAt: Date.now(),
  });
}

export const listProvisionedAccountsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await currentAdmin(ctx);

    const accounts = await ctx.db.query("provisionedAccounts").collect();
    const accountsWithLinks = await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        credentialLinks: await ctx.db
          .query("credentialLinks")
          .withIndex("by_account_created", (q) => q.eq("provisionedAccountId", account._id))
          .order("desc")
          .take(5),
      })),
    );

    return accountsWithLinks.sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

export const getCredentialLinkPreview = query({
  args: {
    tokenHash: v.string(),
    purpose: credentialLinkPurposeValidator,
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("credentialLinks")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (
      !link ||
      link.purpose !== args.purpose ||
      link.consumedAt ||
      link.revokedAt ||
      link.expiresAt <= Date.now()
    ) {
      return null;
    }

    const account = await ctx.db.get(link.provisionedAccountId);

    if (!account) {
      return null;
    }

    return {
      username: account.username,
      displayName: account.displayName,
      firstName: account.firstName,
      lastName: account.lastName,
      accountNumber: account.accountNumber,
      purpose: link.purpose,
      expiresAt: link.expiresAt,
    };
  },
});

export const createProvisionedAccount = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    accountLabel: accountLabelValidator,
    graduationYear: v.optional(v.number()),
    setupTokenHash: v.string(),
    setupExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const name = namePartsFromInput(args);

    const createdBy = await requireAdminOrFirstAdminBootstrap(ctx, args.accountLabel);
    const username = await uniqueUsername(ctx, name.displayName, new Set());
    const accountNumber = await nextAccountNumber(ctx, new Set());
    const now = Date.now();
    const accountId = await ctx.db.insert("provisionedAccounts", {
      username,
      displayName: name.displayName,
      firstName: name.firstName,
      lastName: name.lastName,
      accountNumber,
      accountLabel: args.accountLabel,
      graduationYear: args.graduationYear,
      status: "pending_setup",
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
    const credentialLinkId = await insertCredentialLink(ctx, {
      provisionedAccountId: accountId,
      tokenHash: args.setupTokenHash,
      purpose: "initial_setup",
      expiresAt: args.setupExpiresAt,
      createdBy,
    });

    return {
      accountId,
      credentialLinkId,
      username,
      displayName: name.displayName,
      firstName: name.firstName,
      lastName: name.lastName,
      accountNumber,
    };
  },
});

export const bulkCreateProvisionedAccounts = mutation({
  args: {
    accounts: v.array(
      v.object({
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        displayName: v.optional(v.string()),
        accountLabel: accountLabelValidator,
        graduationYear: v.optional(v.number()),
        setupTokenHash: v.string(),
        setupExpiresAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.accounts.length === 0) {
      throw new Error("Add at least one account to import.");
    }

    const createdBy = await currentAdmin(ctx);
    const reserved = new Set<string>();
    const reservedAccountNumbers = new Set<string>();
    const created = [];

    for (const input of args.accounts) {
      const name = namePartsFromInput(input);

      const username = await uniqueUsername(ctx, name.displayName, reserved);
      const accountNumber = await nextAccountNumber(ctx, reservedAccountNumbers);
      const now = Date.now();
      const accountId = await ctx.db.insert("provisionedAccounts", {
        username,
        displayName: name.displayName,
        firstName: name.firstName,
        lastName: name.lastName,
        accountNumber,
        accountLabel: input.accountLabel,
        graduationYear: input.graduationYear,
        status: "pending_setup",
        createdBy: createdBy.userId,
        createdAt: now,
        updatedAt: now,
      });
      const credentialLinkId = await insertCredentialLink(ctx, {
        provisionedAccountId: accountId,
        tokenHash: input.setupTokenHash,
        purpose: "initial_setup",
        expiresAt: input.setupExpiresAt,
        createdBy: createdBy.userId,
      });

      created.push({
        accountId,
        credentialLinkId,
        username,
        displayName: name.displayName,
        firstName: name.firstName,
        lastName: name.lastName,
        accountNumber,
      });
    }

    return created;
  },
});

export const createCredentialLink = mutation({
  args: {
    provisionedAccountId: v.id("provisionedAccounts"),
    purpose: credentialLinkPurposeValidator,
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await currentAdmin(ctx);
    const account = await ctx.db.get(args.provisionedAccountId);

    if (!account) {
      throw new Error("Provisioned account not found.");
    }

    if (args.purpose === "initial_setup" && account.userId) {
      throw new Error("This account has already completed setup.");
    }

    if (args.purpose === "password_reset" && !account.userId) {
      throw new Error("This account has not completed setup yet.");
    }

    const credentialLinkId = await insertCredentialLink(ctx, {
      provisionedAccountId: args.provisionedAccountId,
      tokenHash: args.tokenHash,
      purpose: args.purpose,
      expiresAt: args.expiresAt,
      createdBy: admin.userId,
    });

    return { credentialLinkId, username: account.username };
  },
});

export const updateProvisionedAccount = mutation({
  args: {
    provisionedAccountId: v.id("provisionedAccounts"),
    displayName: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    accountLabel: v.optional(accountLabelValidator),
    graduationYear: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    await currentAdmin(ctx);
    const account = await ctx.db.get(args.provisionedAccountId);

    if (!account) {
      throw new Error("Provisioned account not found.");
    }

    const hasNamePatch =
      args.displayName !== undefined ||
      args.firstName !== undefined ||
      args.lastName !== undefined;
    const namePatch = hasNamePatch
      ? namePartsFromInput({
          firstName: args.firstName ?? account.firstName,
          lastName: args.lastName ?? account.lastName,
          displayName: args.displayName ?? account.displayName,
        })
      : null;
    const patch = {
      ...(namePatch
        ? {
            displayName: namePatch.displayName,
            firstName: namePatch.firstName,
            lastName: namePatch.lastName,
          }
        : {}),
      ...(args.accountLabel ? { accountLabel: args.accountLabel } : {}),
      ...(args.graduationYear !== undefined
        ? { graduationYear: args.graduationYear ?? undefined }
        : {}),
      updatedAt: Date.now(),
    };

    await ctx.db.patch(args.provisionedAccountId, patch);

    const nextAccount = {
      ...account,
      ...patch,
      displayName: patch.displayName ?? account.displayName,
      firstName: patch.firstName ?? account.firstName,
      lastName: patch.lastName ?? account.lastName,
      accountLabel: patch.accountLabel ?? account.accountLabel,
      graduationYear: patch.graduationYear ?? account.graduationYear,
    };
    const profileId = account.profileId ??
      (account.userId
        ? (await ctx.db
            .query("profiles")
            .withIndex("by_user", (q) => q.eq("userId", account.userId!))
            .first())?._id
        : undefined);

    if (profileId) {
      await ctx.db.patch(profileId, {
        displayName: nextAccount.displayName,
        firstName: nextAccount.firstName,
        lastName: nextAccount.lastName,
        accountNumber: nextAccount.accountNumber,
        ...profilePatchForAccount(nextAccount),
        updatedAt: Date.now(),
      });
    }

    return args.provisionedAccountId;
  },
});

export const assignMissingAccountNumbers = mutation({
  args: {},
  handler: async (ctx) => {
    await currentAdmin(ctx);

    const accounts = await ctx.db.query("provisionedAccounts").collect();
    const reserved = new Set(
      accounts
        .map((account) => account.accountNumber)
        .filter((accountNumber): accountNumber is string => !!accountNumber),
    );
    let assignedCount = 0;

    for (const account of accounts) {
      if (account.accountNumber) {
        continue;
      }

      const accountNumber = await nextAccountNumber(ctx, reserved);

      await ctx.db.patch(account._id, {
        accountNumber,
        updatedAt: Date.now(),
      });

      if (account.profileId) {
        await ctx.db.patch(account.profileId, {
          accountNumber,
          updatedAt: Date.now(),
        });
      }

      assignedCount += 1;
    }

    return { assignedCount };
  },
});

export const deactivateGraduationYear = mutation({
  args: {
    graduationYear: v.number(),
    program: v.optional(programValidator),
  },
  handler: async (ctx, args) => {
    await currentAdmin(ctx);
    const accounts = await ctx.db
      .query("provisionedAccounts")
      .withIndex("by_graduation_year", (q) => q.eq("graduationYear", args.graduationYear))
      .collect();
    let deactivatedCount = 0;

    for (const account of accounts) {
      if (
        account.status === "inactive" ||
        account.graduationYear !== args.graduationYear ||
        !isStudentLabel(account.accountLabel) ||
        (args.program && programForAccountLabel(account.accountLabel) !== args.program)
      ) {
        continue;
      }

      await ctx.db.patch(account._id, {
        status: "inactive",
        updatedAt: Date.now(),
      });

      if (account.profileId) {
        await ctx.db.patch(account.profileId, {
          status: "inactive",
          updatedAt: Date.now(),
        });
      }

      deactivatedCount += 1;
    }

    return { deactivatedCount };
  },
});

export const revokeCredentialLink = mutation({
  args: {
    credentialLinkId: v.id("credentialLinks"),
  },
  handler: async (ctx, args) => {
    await currentAdmin(ctx);
    const link = await ctx.db.get(args.credentialLinkId);

    if (!link) {
      return args.credentialLinkId;
    }

    await ctx.db.patch(args.credentialLinkId, {
      revokedAt: Date.now(),
    });

    return args.credentialLinkId;
  },
});

export const deactivateAccount = mutation({
  args: {
    provisionedAccountId: v.id("provisionedAccounts"),
  },
  handler: async (ctx, args) => {
    await currentAdmin(ctx);
    const account = await ctx.db.get(args.provisionedAccountId);

    if (!account) {
      throw new Error("Provisioned account not found.");
    }

    await ctx.db.patch(args.provisionedAccountId, {
      status: "inactive",
      updatedAt: Date.now(),
    });

    if (account.profileId) {
      await ctx.db.patch(account.profileId, {
        status: "inactive",
        updatedAt: Date.now(),
      });
    }

    return args.provisionedAccountId;
  },
});

export const reactivateAccount = mutation({
  args: {
    provisionedAccountId: v.id("provisionedAccounts"),
  },
  handler: async (ctx, args) => {
    await currentAdmin(ctx);
    const account = await ctx.db.get(args.provisionedAccountId);

    if (!account) {
      throw new Error("Provisioned account not found.");
    }

    const status = account.userId ? "active" : "pending_setup";

    await ctx.db.patch(args.provisionedAccountId, {
      status,
      updatedAt: Date.now(),
    });

    if (account.profileId) {
      await ctx.db.patch(account.profileId, {
        status: status === "active" ? "active" : "inactive",
        updatedAt: Date.now(),
      });
    }

    return args.provisionedAccountId;
  },
});

export const consumeCredentialLink = internalMutation({
  args: {
    tokenHash: v.string(),
    purpose: credentialLinkPurposeValidator,
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("credentialLinks")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (
      !link ||
      link.purpose !== args.purpose ||
      link.consumedAt ||
      link.revokedAt ||
      link.expiresAt <= Date.now()
    ) {
      throw new Error("This credential link is invalid or expired.");
    }

    const account = await ctx.db.get(link.provisionedAccountId);

    if (!account) {
      throw new Error("Provisioned account not found.");
    }

    if (account.status === "inactive") {
      throw new Error("This account is inactive.");
    }

    if (args.purpose === "initial_setup" && account.userId) {
      throw new Error("This account has already completed setup.");
    }

    if (args.purpose === "password_reset" && !account.userId) {
      throw new Error("This account has not completed setup yet.");
    }

    await ctx.db.patch(link._id, {
      consumedAt: Date.now(),
    });

    return {
      linkId: link._id,
      accountId: account._id,
      username: account.username,
      displayName: account.displayName,
      firstName: account.firstName,
      lastName: account.lastName,
      accountNumber: account.accountNumber,
      accountLabel: account.accountLabel,
      userId: account.userId,
      graduationYear: account.graduationYear,
    };
  },
});

export const updateProvisionedAccountCredentials = internalMutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    currentUsername: v.string(),
    nextUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUsername = normalizeChosenUsername(args.currentUsername);
    const nextUsername = normalizeChosenUsername(args.nextUsername);

    validateChosenUsername(nextUsername);

    const account = await ctx.db
      .query("provisionedAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!account || account.status !== "active") {
      throw new Error("Your provisioned team account was not found.");
    }

    if (account.username !== currentUsername) {
      throw new Error("Your current username no longer matches this account.");
    }

    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", args.provider).eq("providerAccountId", currentUsername),
      )
      .unique();

    if (!authAccount || authAccount.userId !== args.userId) {
      throw new Error("Your sign-in account was not found.");
    }

    if (nextUsername !== currentUsername) {
      const existingProvisionedAccount = await ctx.db
        .query("provisionedAccounts")
        .withIndex("by_username", (q) => q.eq("username", nextUsername))
        .first();

      if (existingProvisionedAccount && existingProvisionedAccount._id !== account._id) {
        throw new Error("That username is already taken.");
      }

      const existingAuthAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", args.provider).eq("providerAccountId", nextUsername),
        )
        .first();

      if (existingAuthAccount && existingAuthAccount._id !== authAccount._id) {
        throw new Error("That username is already taken.");
      }

      await ctx.db.patch(account._id, {
        username: nextUsername,
        updatedAt: Date.now(),
      });
      await ctx.db.patch(authAccount._id, {
        providerAccountId: nextUsername,
      });
    }

    return { username: nextUsername };
  },
});

export const completeInitialSetup = internalMutation({
  args: {
    provisionedAccountId: v.id("provisionedAccounts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.provisionedAccountId);

    if (!account) {
      throw new Error("Provisioned account not found.");
    }

    const now = Date.now();
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const profilePatch = {
      userId: args.userId,
      displayName: account.displayName,
      firstName: account.firstName,
      lastName: account.lastName,
      accountNumber: account.accountNumber,
      status: "active" as const,
      ...profilePatchForAccount(account),
      updatedAt: now,
    };
    const profileId = existingProfile
      ? existingProfile._id
      : await ctx.db.insert("profiles", {
          ...profilePatch,
          createdAt: now,
        });

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, profilePatch);
    }

    await ctx.db.patch(args.provisionedAccountId, {
      userId: args.userId,
      profileId,
      status: "active",
      updatedAt: now,
    });

    return profileId;
  },
});

export const validateUsernameSignIn = internalQuery({
  args: {
    username: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("provisionedAccounts")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();

    if (!account || account.userId !== args.userId || account.status === "pending_setup") {
      throw new Error("This account has not completed setup.");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      throw new Error("This team profile was not found.");
    }

    return true;
  },
});
