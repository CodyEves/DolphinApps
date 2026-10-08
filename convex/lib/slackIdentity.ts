import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Error codes thrown during "Sign in with Slack". Convex Auth swallows OAuth
 * callback errors and redirects home without a code, so the sign-in page shows
 * a generic "couldn't match your Slack account" message. The codes are still
 * useful in the Convex logs.
 */
export const SLACK_SIGNIN_WRONG_WORKSPACE = "SLACK_SIGNIN_WRONG_WORKSPACE";
export const SLACK_SIGNIN_NO_MATCH = "SLACK_SIGNIN_NO_MATCH";
export const SLACK_SIGNIN_INACTIVE = "SLACK_SIGNIN_INACTIVE";
export const SLACK_SIGNIN_NOT_CONFIGURED = "SLACK_SIGNIN_NOT_CONFIGURED";
export const SLACK_SIGNIN_STAFF_NOT_TRUSTED = "SLACK_SIGNIN_STAFF_NOT_TRUSTED";

/**
 * Staff accounts can approve sign-offs, edit attendance, and manage people.
 * Anyone signed in can click a "Connect my account" URL, so a student could
 * trick a mentor into linking the student's Slack account to the mentor's
 * Dolphin account. Staff Slack sign-in therefore needs a link an admin has
 * explicitly marked trusted (`bunx convex run slackAdmin:trustStaffLink`).
 */
export const STAFF_ROLES = new Set<Doc<"profiles">["role"]>(["admin", "mentor", "instructor"]);

export type SlackOidcProfile = {
  slackUserId: string;
  slackTeamId?: string;
  name?: string;
  image?: string;
};

export async function slackLinkForSlackUser(ctx: QueryCtx | MutationCtx, slackUserId: string) {
  return await ctx.db
    .query("slackAccountLinks")
    .withIndex("by_slack_user", (q) => q.eq("slackUserId", slackUserId))
    .first();
}

export async function upsertSlackLink(
  ctx: MutationCtx,
  args: {
    slackUserId: string;
    slackTeamId?: string;
    slackUserName?: string;
    profile: Doc<"profiles">;
  },
) {
  const now = Date.now();
  const existingBySlack = await slackLinkForSlackUser(ctx, args.slackUserId);

  if (existingBySlack) {
    const movedAccounts = existingBySlack.userId !== args.profile.userId;

    await ctx.db.patch(existingBySlack._id, {
      slackTeamId: args.slackTeamId ?? existingBySlack.slackTeamId,
      slackUserName: args.slackUserName ?? existingBySlack.slackUserName,
      userId: args.profile.userId,
      profileId: args.profile._id,
      // A link that moves to a different Dolphin account loses staff trust.
      ...(movedAccounts ? { trustedForStaffSignIn: false } : {}),
      updatedAt: now,
    });

    return existingBySlack._id;
  }

  return await ctx.db.insert("slackAccountLinks", {
    slackUserId: args.slackUserId,
    slackTeamId: args.slackTeamId,
    slackUserName: args.slackUserName,
    userId: args.profile.userId,
    profileId: args.profile._id,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Maps a Slack identity onto an existing, admin-provisioned Dolphin account.
 * Never creates a new user, and never guesses: the Slack user must already be
 * linked (via "Connect my account", `/shop` linking, or the admin backfill).
 * Staff additionally need an admin-trusted link.
 */
export async function resolveSlackSignIn(ctx: MutationCtx, profile: SlackOidcProfile) {
  const expectedTeamId = process.env.SLACK_TEAM_ID;

  // Fail closed: without a workspace lock, any Slack workspace could sign in.
  if (!expectedTeamId) {
    throw new Error(SLACK_SIGNIN_NOT_CONFIGURED);
  }

  if (profile.slackTeamId !== expectedTeamId) {
    throw new Error(SLACK_SIGNIN_WRONG_WORKSPACE);
  }

  const link = await slackLinkForSlackUser(ctx, profile.slackUserId);
  const dolphinProfile = link ? await ctx.db.get(link.profileId) : null;

  if (!link || !dolphinProfile) {
    throw new Error(SLACK_SIGNIN_NO_MATCH);
  }

  if (dolphinProfile.status !== "active" || dolphinProfile.role === "kiosk") {
    throw new Error(SLACK_SIGNIN_INACTIVE);
  }

  if (STAFF_ROLES.has(dolphinProfile.role) && !link.trustedForStaffSignIn) {
    throw new Error(SLACK_SIGNIN_STAFF_NOT_TRUSTED);
  }

  // Keep the stored Slack name/team fresh.
  await ctx.db.patch(link._id, {
    slackTeamId: profile.slackTeamId,
    ...(profile.name ? { slackUserName: profile.name } : {}),
    updatedAt: Date.now(),
  });

  return dolphinProfile.userId;
}
