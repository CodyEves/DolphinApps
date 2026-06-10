import {
  convexAuth,
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { Scrypt } from "lucia";

import { internal } from "./_generated/api";

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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
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
