import { getAuthUserId } from "@convex-dev/auth/server";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requirePartsTeamAccess, teamNumberForSeason } from "./programs";

type Ctx = QueryCtx | MutationCtx;
type Role = Doc<"profiles">["role"];

export async function requireProfile(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!profile || profile.status !== "active") {
    throw new Error("Your team profile is not active.");
  }

  return profile;
}

export function requireRole(profile: Doc<"profiles">, roles: Role[]) {
  if (!roles.includes(profile.role)) {
    throw new Error("You do not have permission to do that.");
  }
}

export function canApproveOrders(profile: Doc<"profiles">) {
  return profile.role === "mentor" || profile.role === "instructor" || profile.role === "admin";
}

export async function requireSeasonAccess(ctx: Ctx, profile: Doc<"profiles">, seasonId: Doc<"seasons">["_id"]) {
  const season = await ctx.db.get(seasonId);

  if (!season) {
    throw new Error("Season not found.");
  }

  requirePartsTeamAccess(profile, teamNumberForSeason(season));
  return season;
}
