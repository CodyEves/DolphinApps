import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireActiveProfile } from "./lib/authz";
import { containsProhibitedProfileLanguage } from "./lib/profanity";
import { displayNameFor } from "./shopAttendance";

/**
 * Suggestions on the public SOP book (/SOP). Reading the SOPs needs no login;
 * leaving a suggestion needs an active Dolphin Apps profile. Mentors,
 * instructors and admins review them and export the accepted ones for Claude.
 */

const kindValidator = v.union(v.literal("fix"), v.literal("add"), v.literal("remove"), v.literal("question"));
const statusValidator = v.union(v.literal("open"), v.literal("accepted"), v.literal("rejected"), v.literal("done"));

const SOP_ID = /^RDOS-SOP-[A-Z]+-\d{3}$/;
const MAX_QUOTE = 600;
const MAX_COMMENT = 2000;
const MAX_NOTE = 500;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 30;

type Ctx = QueryCtx | MutationCtx;

function isReviewer(profile: Doc<"profiles"> | null) {
  return Boolean(
    profile &&
      profile.status === "active" &&
      (profile.role === "admin" || profile.role === "mentor" || profile.role === "instructor"),
  );
}

async function viewerProfile(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

async function requireReviewer(ctx: Ctx) {
  const profile = await requireActiveProfile(ctx);

  if (!isReviewer(profile)) {
    throw new Error("Only mentors, instructors and admins can review SOP suggestions.");
  }

  return profile;
}

function clip(value: string, max: number) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function publicShape(row: Doc<"sopSuggestions">, viewerUserId: string | null) {
  return {
    _id: row._id,
    sopId: row.sopId,
    sopTitle: row.sopTitle,
    sopVersion: row.sopVersion,
    anchorId: row.anchorId,
    anchorLabel: row.anchorLabel,
    quote: row.quote,
    kind: row.kind,
    comment: row.comment,
    status: row.status,
    authorName: row.authorName,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    reviewerName: row.reviewerName,
    reviewNote: row.reviewNote,
    mine: viewerUserId !== null && row.authorUserId === viewerUserId,
  };
}

/** Who is looking, for the SOP page: can they suggest, and can they review? */
export const viewerAccess = query({
  args: {},
  handler: async (ctx) => {
    const profile = await viewerProfile(ctx);

    if (!profile) {
      return { signedIn: (await getAuthUserId(ctx)) !== null, canSuggest: false, canReview: false };
    }

    return {
      signedIn: true,
      canSuggest: profile.status === "active" && profile.role !== "kiosk",
      canReview: isReviewer(profile),
    };
  },
});

/** Suggestions still in play on one SOP. Signed-in team members only; the public sees none. */
export const listForSop = query({
  args: { sopId: v.string() },
  handler: async (ctx, args) => {
    const profile = await viewerProfile(ctx);

    if (!profile || profile.status !== "active" || profile.role === "kiosk") {
      return [];
    }

    const rows = await ctx.db
      .query("sopSuggestions")
      .withIndex("by_sop", (q) => q.eq("sopId", args.sopId))
      .order("desc")
      .take(300);

    return rows
      .filter((row) => row.status === "open" || row.status === "accepted")
      .map((row) => publicShape(row, profile.userId));
  },
});

export const submit = mutation({
  args: {
    sopId: v.string(),
    sopTitle: v.string(),
    sopVersion: v.string(),
    anchorId: v.string(),
    anchorLabel: v.string(),
    quote: v.string(),
    kind: kindValidator,
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);

    if (profile.role === "kiosk") {
      throw new Error("The shop display can't leave suggestions.");
    }

    if (!SOP_ID.test(args.sopId)) {
      throw new Error("That SOP wasn't recognized.");
    }

    const comment = args.comment.trim();

    if (comment.length < 3) {
      throw new Error("Write what should change.");
    }

    if (comment.length > MAX_COMMENT) {
      throw new Error(`Keep suggestions under ${MAX_COMMENT} characters. Split long ones up.`);
    }

    if (containsProhibitedProfileLanguage(comment)) {
      throw new Error("That suggestion has language that isn't allowed. Reword it and try again.");
    }

    const now = Date.now();
    const recent = await ctx.db
      .query("sopSuggestions")
      .withIndex("by_author", (q) => q.eq("authorUserId", profile.userId))
      .order("desc")
      .take(RATE_LIMIT);

    if (recent.length >= RATE_LIMIT && recent[RATE_LIMIT - 1].createdAt > now - RATE_WINDOW_MS) {
      throw new Error("That's a lot of suggestions in a few minutes. Take a short break and try again.");
    }

    const user = await ctx.db.get(profile.userId);

    return await ctx.db.insert("sopSuggestions", {
      sopId: args.sopId,
      sopTitle: clip(args.sopTitle, 160),
      sopVersion: clip(args.sopVersion, 20),
      anchorId: clip(args.anchorId, 120),
      anchorLabel: clip(args.anchorLabel, 200),
      quote: clip(args.quote, MAX_QUOTE),
      kind: args.kind,
      comment,
      status: "open",
      authorUserId: profile.userId,
      authorName: displayNameFor(profile, user),
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** The author can take back a suggestion nobody has reviewed yet. */
export const withdraw = mutation({
  args: { suggestionId: v.id("sopSuggestions") },
  handler: async (ctx, args) => {
    const profile = await requireActiveProfile(ctx);
    const row = await ctx.db.get(args.suggestionId);

    if (!row) {
      return;
    }

    if (row.authorUserId !== profile.userId && !isReviewer(profile)) {
      throw new Error("You can only withdraw your own suggestions.");
    }

    if (row.status !== "open") {
      throw new Error("This suggestion has already been reviewed.");
    }

    await ctx.db.delete(row._id);
  },
});

/** The mentor log. Newest first; filter by status or leave it out for everything. */
export const listAll = query({
  args: { status: v.optional(statusValidator) },
  handler: async (ctx, args) => {
    const profile = await viewerProfile(ctx);

    if (!isReviewer(profile)) {
      return null;
    }

    const status = args.status;
    const rows = status
      ? await ctx.db
          .query("sopSuggestions")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(1000)
      : await ctx.db.query("sopSuggestions").order("desc").take(1000);

    return rows.map((row) => publicShape(row, profile!.userId));
  },
});

/** How many suggestions are waiting, for the review tab. Reviewers only. */
export const openCount = query({
  args: {},
  handler: async (ctx) => {
    const profile = await viewerProfile(ctx);

    if (!isReviewer(profile)) {
      return null;
    }

    const rows = await ctx.db
      .query("sopSuggestions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(500);

    return rows.length;
  },
});

export const setStatus = mutation({
  args: {
    suggestionIds: v.array(v.id("sopSuggestions")),
    status: statusValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireReviewer(ctx);
    const user = await ctx.db.get(profile.userId);
    const reviewerName = displayNameFor(profile, user);
    const note = args.note?.trim();

    if (args.suggestionIds.length > 500) {
      throw new Error("Update at most 500 suggestions at once.");
    }

    const now = Date.now();

    for (const id of args.suggestionIds) {
      const row = await ctx.db.get(id);

      if (!row) {
        continue;
      }

      await ctx.db.patch(id, {
        status: args.status,
        reviewedAt: args.status === "open" ? undefined : now,
        reviewedBy: args.status === "open" ? undefined : profile.userId,
        reviewerName: args.status === "open" ? undefined : reviewerName,
        ...(note !== undefined ? { reviewNote: note ? clip(note, MAX_NOTE) : undefined } : {}),
        updatedAt: now,
      });
    }
  },
});
