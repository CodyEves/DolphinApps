// Admin tools for the Slack app. Only people with Convex deploy access can run
// these (CLI or Convex dashboard → Functions → slackAdmin).
//
// 1) Link students/leads whose Slack full name exactly matches their Dolphin
//    profile name. Dry run first; it changes nothing:
//      bunx convex run slackAdmin:backfillLinks '{"dryRun": true}'
//      bunx convex run slackAdmin:backfillLinks '{"dryRun": false}'
//
// 2) Let a mentor/admin use Sign in with Slack. They first click "Connect my
//    account" in the Slack Home tab, then an admin confirms the Slack name and
//    trusts it:
//      bunx convex run slackAdmin:listStaffLinks
//      bunx convex run slackAdmin:trustStaffLink '{"username": "cody.e"}'
//      bunx convex run slackAdmin:untrustStaffLink '{"username": "cody.e"}'
//
// Needs bot scope users:read.

import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { slackApiGet } from "./lib/slack";
import { STAFF_ROLES, slackLinkForSlackUser, upsertSlackLink } from "./lib/slackIdentity";
import { displayNameFor } from "./shopAttendance";

const memberValidator = v.object({
  slackUserId: v.string(),
  slackTeamId: v.optional(v.string()),
  realName: v.optional(v.string()),
  displayName: v.optional(v.string()),
});

type SlackMember = {
  id: string;
  team_id?: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_app_user?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  real_name?: string;
  profile?: { real_name?: string; display_name?: string };
};

function normalizeName(value: string | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function profileNames(profile: Doc<"profiles">) {
  const names = new Set<string>();
  const full = normalizeName(`${profile.firstName ?? ""} ${profile.lastName ?? ""}`);

  if (full) names.add(full);
  if (profile.displayName) names.add(normalizeName(profile.displayName));

  return names;
}

// ---------------------------------------------------------------------------
// Backfill by exact name (students and leads only)
// ---------------------------------------------------------------------------

export const applyBackfill = internalMutation({
  args: {
    members: v.array(memberValidator),
    dryRun: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Anyone can edit their Slack name, so only student/lead profiles are ever
    // matched by name. Staff link themselves and get trusted by an admin.
    const studentProfiles = (
      await ctx.db
        .query("profiles")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect()
    ).filter((profile) => profile.role === "student" || profile.role === "lead");
    const linkedUserIds = new Set<Id<"users">>(
      (await ctx.db.query("slackAccountLinks").collect()).map((link) => link.userId),
    );

    // Count how many Slack members claim each name, so duplicates are skipped.
    const slackNameCounts = new Map<string, number>();

    for (const member of args.members) {
      for (const name of new Set([normalizeName(member.realName), normalizeName(member.displayName)])) {
        if (name) slackNameCounts.set(name, (slackNameCounts.get(name) ?? 0) + 1);
      }
    }

    const linked: string[] = [];
    const conflicts: string[] = [];
    let alreadyLinked = 0;
    let noMatch = 0;

    for (const member of args.members) {
      const slackLabel = member.realName || member.displayName || member.slackUserId;

      if (await slackLinkForSlackUser(ctx, member.slackUserId)) {
        alreadyLinked += 1;
        continue;
      }

      const wanted = new Set([normalizeName(member.realName), normalizeName(member.displayName)]);
      wanted.delete("");
      const candidates = studentProfiles.filter((profile) =>
        [...profileNames(profile)].some((name) => wanted.has(name)),
      );

      if (candidates.length === 0) {
        noMatch += 1;
        continue;
      }

      if (candidates.length > 1) {
        conflicts.push(`${slackLabel}: ${candidates.length} Dolphin profiles share that name`);
        continue;
      }

      if ([...wanted].some((name) => (slackNameCounts.get(name) ?? 0) > 1)) {
        conflicts.push(`${slackLabel}: more than one Slack user has that name`);
        continue;
      }

      const match = candidates[0];

      if (linkedUserIds.has(match.userId)) {
        conflicts.push(`${slackLabel}: that Dolphin account is already linked to another Slack user`);
        continue;
      }

      linked.push(`${slackLabel} → ${displayNameFor(match, await ctx.db.get(match.userId))}`);
      linkedUserIds.add(match.userId);

      if (!args.dryRun) {
        await upsertSlackLink(ctx, {
          slackUserId: member.slackUserId,
          slackTeamId: member.slackTeamId,
          slackUserName: member.realName || member.displayName,
          profile: match,
        });
        await ctx.scheduler.runAfter(0, internal.slackHome.publishHome, {
          slackUserId: member.slackUserId,
        });
      }
    }

    const stillUnlinked: string[] = [];

    for (const profile of studentProfiles) {
      if (!linkedUserIds.has(profile.userId)) {
        stillUnlinked.push(displayNameFor(profile, await ctx.db.get(profile.userId)));
      }
    }

    return {
      dryRun: args.dryRun,
      slackMembersChecked: args.members.length,
      alreadyLinked,
      linked,
      conflicts,
      slackMembersWithNoMatch: noMatch,
      studentsStillUnlinked: stillUnlinked.sort(),
    };
  },
});

export const backfillLinks = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const members: {
      slackUserId: string;
      slackTeamId?: string;
      realName?: string;
      displayName?: string;
    }[] = [];
    let cursor = "";

    do {
      const page = await slackApiGet("users.list", {
        limit: "200",
        ...(cursor ? { cursor } : {}),
      });

      if (!page.ok) {
        throw new Error(`users.list failed: ${page.error}. Check the bot has users:read.`);
      }

      for (const member of (page.members as SlackMember[] | undefined) ?? []) {
        // Skip bots and Slack guests (single/multi-channel guests).
        if (
          member.deleted ||
          member.is_bot ||
          member.is_app_user ||
          member.is_restricted ||
          member.is_ultra_restricted ||
          member.id === "USLACKBOT"
        ) {
          continue;
        }

        members.push({
          slackUserId: member.id,
          slackTeamId: member.team_id,
          realName: member.profile?.real_name || member.real_name || undefined,
          displayName: member.profile?.display_name || undefined,
        });
      }

      cursor =
        (page.response_metadata as { next_cursor?: string } | undefined)?.next_cursor ?? "";
    } while (cursor);

    const report: {
      dryRun: boolean;
      slackMembersChecked: number;
      alreadyLinked: number;
      linked: string[];
      conflicts: string[];
      slackMembersWithNoMatch: number;
      studentsStillUnlinked: string[];
    } = await ctx.runMutation(internal.slackAdmin.applyBackfill, {
      members,
      dryRun: args.dryRun ?? true,
    });

    return report;
  },
});

// ---------------------------------------------------------------------------
// Staff trust
// ---------------------------------------------------------------------------

async function staffLinkForUsername(ctx: MutationCtx, username: string) {
  const account = await ctx.db
    .query("provisionedAccounts")
    .withIndex("by_username", (q) => q.eq("username", username.trim().toLowerCase()))
    .first();

  if (!account?.userId) {
    throw new Error(`No set-up Dolphin account with username "${username}".`);
  }

  const links = await ctx.db
    .query("slackAccountLinks")
    .withIndex("by_user", (q) => q.eq("userId", account.userId!))
    .collect();

  if (links.length === 0) {
    throw new Error(
      `${account.displayName} has no Slack link yet. Have them click "Connect my account" in the Slack Home tab first.`,
    );
  }

  if (links.length > 1) {
    throw new Error(
      `${account.displayName} has ${links.length} Slack links (${links
        .map((link) => link.slackUserName ?? link.slackUserId)
        .join(", ")}). Remove the extra ones before trusting.`,
    );
  }

  return { account, link: links[0] };
}

/** Lists Slack links for staff accounts, with whether each is trusted. */
export const listStaffLinks = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = [];

    for (const link of await ctx.db.query("slackAccountLinks").collect()) {
      const profile = await ctx.db.get(link.profileId);

      if (!profile || !STAFF_ROLES.has(profile.role)) {
        continue;
      }

      const account = await ctx.db
        .query("provisionedAccounts")
        .withIndex("by_user", (q) => q.eq("userId", link.userId))
        .first();

      rows.push({
        username: account?.username,
        dolphinName: displayNameFor(profile, await ctx.db.get(profile.userId)),
        role: profile.role,
        slackName: link.slackUserName ?? "(unknown)",
        slackUserId: link.slackUserId,
        trusted: link.trustedForStaffSignIn === true,
      });
    }

    return rows;
  },
});

export const trustStaffLink = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const { account, link } = await staffLinkForUsername(ctx, args.username);

    await ctx.db.patch(link._id, {
      trustedForStaffSignIn: true,
      trustedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return `Trusted: Dolphin "${account.displayName}" ↔ Slack "${link.slackUserName ?? link.slackUserId}". They can now use Sign in with Slack.`;
  },
});

export const untrustStaffLink = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const { account, link } = await staffLinkForUsername(ctx, args.username);

    await ctx.db.patch(link._id, {
      trustedForStaffSignIn: false,
      updatedAt: Date.now(),
    });

    return `Untrusted: ${account.displayName} must use their password again.`;
  },
});
