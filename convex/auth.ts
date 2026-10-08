import {
  convexAuth,
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import Slack from "@auth/core/providers/slack";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { Scrypt } from "lucia";

import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { resolveSlackSignIn } from "./lib/slackIdentity";

const provider = "password";

function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function readPassword(value: unknown) {
  const password = String(value ?? "");

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  return password;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type SlackClaims = Record<string, unknown> & {
  sub?: string;
  name?: string;
  picture?: string;
};

function stringClaim(claims: SlackClaims, key: string) {
  const value = claims[key];

  return typeof value === "string" && value ? value : undefined;
}

// Fields we allow onto the users table when we create/patch a users row ourselves.
function usersTableFields(profile: Record<string, unknown>) {
  const fields: { name?: string; email?: string; image?: string } = {};

  if (typeof profile.name === "string") fields.name = profile.name;
  if (typeof profile.email === "string") fields.email = profile.email;
  if (typeof profile.image === "string") fields.image = profile.image;

  return fields;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  callbacks: {
    async createOrUpdateUser(genericCtx, args) {
      // Convex Auth hands us a generic ctx; it is the same mutation ctx as ours.
      const ctx = genericCtx as unknown as MutationCtx;

      if (args.provider.id === "slack") {
        const profile = args.profile as Record<string, unknown>;

        return await resolveSlackSignIn(ctx, {
          slackUserId: String(profile.slackUserId ?? ""),
          slackTeamId: typeof profile.slackTeamId === "string" ? profile.slackTeamId : undefined,
          name: typeof profile.name === "string" ? profile.name : undefined,
          image: typeof profile.image === "string" ? profile.image : undefined,
        });
      }

      // Password provider: same behavior Convex Auth has by default for
      // createAccount (we never link password accounts by email).
      if (args.existingUserId) {
        await ctx.db.patch(args.existingUserId, usersTableFields(args.profile));
        return args.existingUserId;
      }

      return await ctx.db.insert("users", usersTableFields(args.profile));
    },
  },
  providers: [
    // "Sign in with Slack" (OpenID Connect). Only maps onto existing Dolphin
    // accounts; see convex/lib/slackIdentity.ts.
    Slack({
      clientId: process.env.AUTH_SLACK_ID,
      clientSecret: process.env.AUTH_SLACK_SECRET,
      authorization: {
        params: {
          scope: "openid profile",
          // Pre-selects our workspace on Slack's consent screen.
          ...(process.env.SLACK_TEAM_ID ? { team: process.env.SLACK_TEAM_ID } : {}),
        },
      },
      profile(claims: SlackClaims) {
        const slackUserId = stringClaim(claims, "https://slack.com/user_id") ?? claims.sub ?? "";

        return {
          id: slackUserId,
          slackUserId,
          slackTeamId: stringClaim(claims, "https://slack.com/team_id"),
          name: claims.name,
          image: claims.picture,
        };
      },
    }),
    ConvexCredentials({
      id: provider,
      authorize: async (params, ctx) => {
        const flow = String(params.flow ?? "signIn");

        if (flow === "signIn") {
          const username = normalizeUsername(params.username);
          const password = String(params.password ?? "");

          if (!username || !password) {
            throw new Error("Enter your username and password.");
          }

          const retrieved = await retrieveAccount(ctx, {
            provider,
            account: { id: username, secret: password },
          });

          await ctx.runQuery(internal.access.validateUsernameSignIn, {
            username,
            userId: retrieved.user._id,
          });
          await ctx.runMutation(internal.access.syncProfileForUsernameSignIn, {
            username,
            userId: retrieved.user._id,
          });

          return { userId: retrieved.user._id };
        }

        if (flow === "setup") {
          const password = readPassword(params.password);
          const token = String(params.token ?? "");

          if (!token) {
            throw new Error("Setup link is missing.");
          }

          const account = await ctx.runMutation(internal.access.consumeCredentialLink, {
            tokenHash: await sha256Hex(token),
            purpose: "initial_setup",
          });
          const created = await createAccount(ctx, {
            provider,
            account: { id: account.username, secret: password },
            profile: { name: account.displayName },
            shouldLinkViaEmail: false,
            shouldLinkViaPhone: false,
          });

          await ctx.runMutation(internal.access.completeInitialSetup, {
            provisionedAccountId: account.accountId,
            userId: created.user._id,
          });

          return { userId: created.user._id };
        }

        if (flow === "reset") {
          const password = readPassword(params.password);
          const token = String(params.token ?? "");

          if (!token) {
            throw new Error("Reset link is missing.");
          }

          const account = await ctx.runMutation(internal.access.consumeCredentialLink, {
            tokenHash: await sha256Hex(token),
            purpose: "password_reset",
          });

          if (!account.userId) {
            throw new Error("This account has not completed setup yet.");
          }

          await modifyAccountCredentials(ctx, {
            provider,
            account: { id: account.username, secret: password },
          });
          await invalidateSessions(ctx, { userId: account.userId });

          return { userId: account.userId };
        }

        if (flow === "profileSecurity") {
          const currentUsername = normalizeUsername(params.currentUsername);
          const nextUsername = normalizeUsername(params.username);
          const currentPassword = String(params.currentPassword ?? "");
          const nextPasswordValue = String(params.password ?? "");
          const nextPassword = nextPasswordValue ? readPassword(nextPasswordValue) : null;

          if (!currentUsername || !nextUsername || !currentPassword) {
            throw new Error("Enter your current username, new username, and current password.");
          }

          const retrieved = await retrieveAccount(ctx, {
            provider,
            account: { id: currentUsername, secret: currentPassword },
          });
          const updated = await ctx.runMutation(
            internal.access.updateProvisionedAccountCredentials,
            {
              userId: retrieved.user._id,
              provider,
              currentUsername,
              nextUsername,
            },
          );

          if (nextPassword) {
            await modifyAccountCredentials(ctx, {
              provider,
              account: { id: updated.username, secret: nextPassword },
            });
          }

          return { userId: retrieved.user._id };
        }

        throw new Error("Unsupported authentication flow.");
      },
      crypto: {
        async hashSecret(password) {
          return await new Scrypt().hash(password);
        },
        async verifySecret(password, hash) {
          return await new Scrypt().verify(hash, password);
        },
      },
    }),
  ],
});
