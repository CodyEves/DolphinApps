// Interview scheduling.
//
// Mentors plan interview slots on /interviews and students read the posted
// schedule on /interviews/schedule. Neither needs a login:
//   - Editing takes the shared mentor key (Convex env var INTERVIEW_KEY),
//     which rides along in the mentor link (/interviews#key=...), or a
//     signed-in admin / mentor / instructor account.
//   - The public page only ever sees the last *published* snapshot, so
//     mentors can rearrange the draft without students watching it change.

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

const MAX_NAME = 80;
const MAX_TEXT = 1000;
const MAX_SLOTS_PER_ADD = 120;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The round this season's form fed. Created on first open of the board. */
export const DEFAULT_ROUND = {
  slug: "5199-2026",
  program: "frc_5199" as const,
  title: "Team 5199 interviews, 2026–27",
  dates: [
    "2026-11-09",
    "2026-11-16",
    "2026-11-18",
    "2026-11-30",
    "2026-12-02",
    "2026-12-07",
    "2026-12-09",
  ],
};

// ---------------------------------------------------------------------------
// Who is editing?
// ---------------------------------------------------------------------------

function cleanText(value: string | undefined, max = MAX_TEXT) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function keyMatches(key: string | undefined) {
  const expected = process.env.INTERVIEW_KEY?.trim();

  if (!expected || !key) {
    return false;
  }

  const given = key.trim();

  if (given.length !== expected.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < given.length; index += 1) {
    diff |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return diff === 0;
}

async function signedInMentorName(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (
    !profile ||
    profile.status !== "active" ||
    !["admin", "mentor", "instructor"].includes(profile.role)
  ) {
    return null;
  }

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name || profile.displayName || "Mentor";
}

const editorArgs = {
  key: v.optional(v.string()),
  editorName: v.optional(v.string()),
};

async function requireEditor(ctx: Ctx, args: { key?: string; editorName?: string }) {
  const accountName = await signedInMentorName(ctx);

  if (accountName) {
    return accountName;
  }

  if (!keyMatches(args.key)) {
    throw new Error("This page needs the mentor link. Ask Mr. Eves for it in #mentors.");
  }

  return cleanText(args.editorName, MAX_NAME) ?? "A mentor";
}

async function touchRound(ctx: MutationCtx, roundId: Id<"interviewRounds">, editor: string) {
  await ctx.db.patch(roundId, { lastEditedBy: editor, lastEditedAt: Date.now() });
}

async function requireRound(ctx: Ctx, roundId: Id<"interviewRounds">) {
  const round = await ctx.db.get(roundId);

  if (!round) {
    throw new Error("Interview round not found.");
  }

  return round;
}

function checkDate(date: string) {
  if (!ISO_DATE.test(date)) {
    throw new Error(`"${date}" is not a date.`);
  }
}

function checkMinutes(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0 || value > 24 * 60) {
    throw new Error(`${label} is not a valid time.`);
  }
}

export function publicName(name: string, style: "full" | "initial") {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (style === "full" || parts.length < 2) {
    return parts.join(" ");
  }

  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Tells the page whether to ask for the mentor key. */
export const access = query({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const signedInAs = await signedInMentorName(ctx);

    return {
      signedInAs,
      canEdit: Boolean(signedInAs) || keyMatches(args.key),
      keyConfigured: Boolean(process.env.INTERVIEW_KEY?.trim()),
    };
  },
});

export const checkKey = mutation({
  args: { key: v.string() },
  handler: async (_ctx, args) => ({ ok: keyMatches(args.key) }),
});

/** Everything the mentor board needs. Mentor key required. */
export const board = query({
  args: { slug: v.string(), ...editorArgs },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args);

    const round = await ctx.db
      .query("interviewRounds")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!round) {
      return null;
    }

    const [candidates, slots] = await Promise.all([
      ctx.db
        .query("interviewCandidates")
        .withIndex("by_round", (q) => q.eq("roundId", round._id))
        .collect(),
      ctx.db
        .query("interviewSlots")
        .withIndex("by_round", (q) => q.eq("roundId", round._id))
        .collect(),
    ]);

    candidates.sort((a, b) => a.name.localeCompare(b.name));
    slots.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startMinutes - b.startMinutes ||
        a.room.localeCompare(b.room, undefined, { numeric: true }),
    );

    return { round, candidates, slots };
  },
});

/** The posted schedule. No key, no login. */
export const publicSchedule = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const round = await ctx.db
      .query("interviewRounds")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!round) {
      return null;
    }

    return {
      title: round.title,
      published: round.published ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// Round setup
// ---------------------------------------------------------------------------

export const ensureRound = mutation({
  args: { slug: v.string(), ...editorArgs },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    const existing = await ctx.db
      .query("interviewRounds")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      return existing._id;
    }

    if (args.slug !== DEFAULT_ROUND.slug) {
      throw new Error("Unknown interview round.");
    }

    return await ctx.db.insert("interviewRounds", {
      ...DEFAULT_ROUND,
      publicNameStyle: "full",
      panels: [],
      lastEditedBy: editor,
      lastEditedAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const updateRound = mutation({
  args: {
    roundId: v.id("interviewRounds"),
    title: v.optional(v.string()),
    dates: v.optional(v.array(v.string())),
    location: v.optional(v.string()),
    publicMessage: v.optional(v.string()),
    publicNameStyle: v.optional(v.union(v.literal("full"), v.literal("initial"))),
    ...editorArgs,
  },
  handler: async (ctx, { roundId, key, editorName, ...changes }) => {
    const editor = await requireEditor(ctx, { key, editorName });
    await requireRound(ctx, roundId);
    const patch: Partial<Doc<"interviewRounds">> = {};

    if (changes.title !== undefined) {
      patch.title = cleanText(changes.title, MAX_NAME) ?? "Interviews";
    }

    if (changes.dates !== undefined) {
      changes.dates.forEach(checkDate);
      patch.dates = [...new Set(changes.dates)].sort();
    }

    if (changes.location !== undefined) {
      patch.location = cleanText(changes.location, 200);
    }

    if (changes.publicMessage !== undefined) {
      patch.publicMessage = cleanText(changes.publicMessage);
    }

    if (changes.publicNameStyle !== undefined) {
      patch.publicNameStyle = changes.publicNameStyle;
    }

    await ctx.db.patch(roundId, patch);
    await touchRound(ctx, roundId, editor);
  },
});

export const setPanelInterviewers = mutation({
  args: {
    roundId: v.id("interviewRounds"),
    date: v.string(),
    room: v.string(),
    interviewers: v.string(),
    ...editorArgs,
  },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    const round = await requireRound(ctx, args.roundId);
    const interviewers = cleanText(args.interviewers, 200) ?? "";
    const panels = round.panels.filter(
      (panel) => !(panel.date === args.date && panel.room === args.room),
    );

    if (interviewers) {
      panels.push({ date: args.date, room: args.room, interviewers });
    }

    await ctx.db.patch(args.roundId, { panels });
    await touchRound(ctx, args.roundId, editor);
  },
});

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

const importRow = v.object({
  name: v.string(),
  email: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
  dates: v.array(v.string()),
  note: v.optional(v.string()),
});

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

/** Adds new form responses and refreshes changed ones. Safe to run on the same CSV twice. */
export const importResponses = mutation({
  args: { roundId: v.id("interviewRounds"), rows: v.array(importRow), ...editorArgs },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    const round = await requireRound(ctx, args.roundId);
    const validDates = new Set(round.dates);
    const existing = await ctx.db
      .query("interviewCandidates")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();
    const now = Date.now();
    let added = 0;
    let updated = 0;
    let unchanged = 0;

    for (const row of args.rows.slice(0, 500)) {
      const name = cleanText(row.name, MAX_NAME);

      if (!name) {
        continue;
      }

      const email = cleanText(row.email, 200)?.toLowerCase();
      const dates = [...new Set(row.dates.filter((date) => validDates.has(date)))].sort();
      const note = cleanText(row.note, 500);
      const match =
        (email && existing.find((candidate) => candidate.email === email)) ||
        existing.find((candidate) => normalizeName(candidate.name) === normalizeName(name));

      if (!match) {
        const id = await ctx.db.insert("interviewCandidates", {
          roundId: args.roundId,
          name,
          email,
          availableDates: dates,
          availabilityNote: note,
          withdrawn: false,
          source: "form",
          submittedAt: row.submittedAt,
          createdAt: now,
          updatedAt: now,
        });
        const inserted = await ctx.db.get(id);

        if (inserted) {
          existing.push(inserted);
        }

        added += 1;
        continue;
      }

      // Only a newer form response replaces availability (someone resubmitted).
      const isNewer =
        row.submittedAt !== undefined &&
        (match.submittedAt === undefined || row.submittedAt > match.submittedAt);

      if (!isNewer) {
        unchanged += 1;
        continue;
      }

      await ctx.db.patch(match._id, {
        availableDates: dates,
        availabilityNote: note,
        email: match.email ?? email,
        submittedAt: row.submittedAt,
        updatedAt: now,
      });
      updated += 1;
    }

    await touchRound(ctx, args.roundId, editor);
    return { added, updated, unchanged };
  },
});

export const addCandidate = mutation({
  args: {
    roundId: v.id("interviewRounds"),
    name: v.string(),
    email: v.optional(v.string()),
    availableDates: v.array(v.string()),
    ...editorArgs,
  },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    const round = await requireRound(ctx, args.roundId);
    const name = cleanText(args.name, MAX_NAME);

    if (!name) {
      throw new Error("Enter the student's name.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("interviewCandidates", {
      roundId: args.roundId,
      name,
      email: cleanText(args.email, 200)?.toLowerCase(),
      availableDates: args.availableDates.filter((date) => round.dates.includes(date)).sort(),
      withdrawn: false,
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });
    await touchRound(ctx, args.roundId, editor);
    return id;
  },
});

async function clearCandidateSlots(ctx: MutationCtx, candidateId: Id<"interviewCandidates">) {
  const slots = await ctx.db
    .query("interviewSlots")
    .withIndex("by_candidate", (q) => q.eq("candidateId", candidateId))
    .collect();

  for (const slot of slots) {
    await ctx.db.patch(slot._id, { candidateId: undefined, updatedAt: Date.now() });
  }
}

export const updateCandidate = mutation({
  args: {
    candidateId: v.id("interviewCandidates"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    availableDates: v.optional(v.array(v.string())),
    availabilityNote: v.optional(v.string()),
    mentorNote: v.optional(v.string()),
    withdrawn: v.optional(v.boolean()),
    ...editorArgs,
  },
  handler: async (ctx, { candidateId, key, editorName, ...changes }) => {
    const editor = await requireEditor(ctx, { key, editorName });
    const candidate = await ctx.db.get(candidateId);

    if (!candidate) {
      throw new Error("Student not found.");
    }

    const round = await requireRound(ctx, candidate.roundId);
    const patch: Partial<Doc<"interviewCandidates">> = { updatedAt: Date.now() };

    if (changes.name !== undefined) {
      const name = cleanText(changes.name, MAX_NAME);

      if (!name) {
        throw new Error("Name can't be blank.");
      }

      patch.name = name;
    }

    if (changes.email !== undefined) {
      patch.email = cleanText(changes.email, 200)?.toLowerCase();
    }

    if (changes.availableDates !== undefined) {
      patch.availableDates = [
        ...new Set(changes.availableDates.filter((date) => round.dates.includes(date))),
      ].sort();
    }

    if (changes.availabilityNote !== undefined) {
      patch.availabilityNote = cleanText(changes.availabilityNote, 500);
    }

    if (changes.mentorNote !== undefined) {
      patch.mentorNote = cleanText(changes.mentorNote);
    }

    if (changes.withdrawn !== undefined) {
      patch.withdrawn = changes.withdrawn;

      if (changes.withdrawn) {
        await clearCandidateSlots(ctx, candidateId);
      }
    }

    await ctx.db.patch(candidateId, patch);
    await touchRound(ctx, candidate.roundId, editor);
  },
});

export const deleteCandidate = mutation({
  args: { candidateId: v.id("interviewCandidates"), ...editorArgs },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    const candidate = await ctx.db.get(args.candidateId);

    if (!candidate) {
      return;
    }

    await clearCandidateSlots(ctx, args.candidateId);
    await ctx.db.delete(args.candidateId);
    await touchRound(ctx, candidate.roundId, editor);
  },
});

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/** Makes back-to-back slots from start to end in each room. Skips ones that already exist. */
export const addSlots = mutation({
  args: {
    roundId: v.id("interviewRounds"),
    date: v.string(),
    startMinutes: v.number(),
    endMinutes: v.number(),
    durationMinutes: v.number(),
    rooms: v.array(v.string()),
    ...editorArgs,
  },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    await requireRound(ctx, args.roundId);
    checkDate(args.date);
    checkMinutes(args.startMinutes, "Start");
    checkMinutes(args.endMinutes, "End");

    if (!Number.isInteger(args.durationMinutes) || args.durationMinutes < 5 || args.durationMinutes > 120) {
      throw new Error("Slot length must be between 5 and 120 minutes.");
    }

    if (args.endMinutes - args.startMinutes < args.durationMinutes) {
      throw new Error("The end time has to be at least one slot after the start.");
    }

    const rooms = [...new Set(args.rooms.map((room) => cleanText(room, 40)).filter(Boolean))] as string[];

    if (rooms.length === 0) {
      throw new Error("Add at least one room or panel.");
    }

    const existing = await ctx.db
      .query("interviewSlots")
      .withIndex("by_round_date", (q) => q.eq("roundId", args.roundId).eq("date", args.date))
      .collect();
    const taken = new Set(existing.map((slot) => `${slot.room}@${slot.startMinutes}`));
    let created = 0;

    for (
      let start = args.startMinutes;
      start + args.durationMinutes <= args.endMinutes;
      start += args.durationMinutes
    ) {
      for (const room of rooms) {
        if (taken.has(`${room}@${start}`)) {
          continue;
        }

        if (created >= MAX_SLOTS_PER_ADD) {
          throw new Error(`That's more than ${MAX_SLOTS_PER_ADD} slots at once. Use a shorter block.`);
        }

        await ctx.db.insert("interviewSlots", {
          roundId: args.roundId,
          date: args.date,
          startMinutes: start,
          durationMinutes: args.durationMinutes,
          room,
          updatedAt: Date.now(),
        });
        created += 1;
      }
    }

    await touchRound(ctx, args.roundId, editor);
    return { created };
  },
});

export const removeSlots = mutation({
  args: { slotIds: v.array(v.id("interviewSlots")), ...editorArgs },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    let roundId: Id<"interviewRounds"> | null = null;

    for (const slotId of args.slotIds.slice(0, 300)) {
      const slot = await ctx.db.get(slotId);

      if (slot) {
        roundId = slot.roundId;
        await ctx.db.delete(slotId);
      }
    }

    if (roundId) {
      await touchRound(ctx, roundId, editor);
    }
  },
});

/** Puts a student in a slot (moving them out of any other slot), or clears it. */
export const assignSlot = mutation({
  args: {
    slotId: v.id("interviewSlots"),
    candidateId: v.optional(v.id("interviewCandidates")),
    ...editorArgs,
  },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    const slot = await ctx.db.get(args.slotId);

    if (!slot) {
      throw new Error("That slot was removed.");
    }

    if (args.candidateId) {
      const candidate = await ctx.db.get(args.candidateId);

      if (!candidate || candidate.roundId !== slot.roundId) {
        throw new Error("Student not found.");
      }

      if (candidate.withdrawn) {
        throw new Error(`${candidate.name} is marked as withdrawn.`);
      }

      await clearCandidateSlots(ctx, args.candidateId);
    }

    await ctx.db.patch(args.slotId, { candidateId: args.candidateId, updatedAt: Date.now() });
    await touchRound(ctx, slot.roundId, editor);
  },
});

export const updateSlotNote = mutation({
  args: { slotId: v.id("interviewSlots"), note: v.string(), ...editorArgs },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    const slot = await ctx.db.get(args.slotId);

    if (!slot) {
      throw new Error("That slot was removed.");
    }

    await ctx.db.patch(args.slotId, { note: cleanText(args.note, 120), updatedAt: Date.now() });
    await touchRound(ctx, slot.roundId, editor);
  },
});

/**
 * Fills open slots with unscheduled students, hardest-to-place first: a
 * student free on one day gets that day before someone free on all seven.
 * Within a student's days it takes the earliest open slot.
 */
export const autoFill = mutation({
  args: {
    roundId: v.id("interviewRounds"),
    /** Only fill these days. Empty or missing means every day. */
    dates: v.optional(v.array(v.string())),
    ...editorArgs,
  },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    await requireRound(ctx, args.roundId);
    const [candidates, slots] = await Promise.all([
      ctx.db
        .query("interviewCandidates")
        .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
        .collect(),
      ctx.db
        .query("interviewSlots")
        .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
        .collect(),
    ]);
    const onlyDates = args.dates && args.dates.length > 0 ? new Set(args.dates) : null;
    const scheduled = new Set(slots.map((slot) => slot.candidateId).filter(Boolean));
    const open = slots
      .filter((slot) => !slot.candidateId && (!onlyDates || onlyDates.has(slot.date)))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startMinutes - b.startMinutes ||
          a.room.localeCompare(b.room, undefined, { numeric: true }),
      );
    const openDates = new Set(open.map((slot) => slot.date));
    const waiting = candidates
      .filter((candidate) => !candidate.withdrawn && !scheduled.has(candidate._id))
      .map((candidate) => ({
        candidate,
        options: candidate.availableDates.filter((date) => openDates.has(date)).length,
      }))
      .sort(
        (a, b) =>
          a.options - b.options ||
          (a.candidate.submittedAt ?? Infinity) - (b.candidate.submittedAt ?? Infinity),
      );
    const used = new Set<Id<"interviewSlots">>();
    let assigned = 0;
    const unplaced: string[] = [];

    for (const { candidate } of waiting) {
      const days = new Set(candidate.availableDates);
      const slot = open.find((option) => !used.has(option._id) && days.has(option.date));

      if (!slot) {
        unplaced.push(candidate.name);
        continue;
      }

      used.add(slot._id);
      await ctx.db.patch(slot._id, { candidateId: candidate._id, updatedAt: Date.now() });
      assigned += 1;
    }

    await touchRound(ctx, args.roundId, editor);
    return { assigned, unplaced };
  },
});

export const clearAssignments = mutation({
  args: { roundId: v.id("interviewRounds"), date: v.string(), ...editorArgs },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    const slots = await ctx.db
      .query("interviewSlots")
      .withIndex("by_round_date", (q) => q.eq("roundId", args.roundId).eq("date", args.date))
      .collect();

    for (const slot of slots) {
      if (slot.candidateId) {
        await ctx.db.patch(slot._id, { candidateId: undefined, updatedAt: Date.now() });
      }
    }

    await touchRound(ctx, args.roundId, editor);
  },
});

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export const publish = mutation({
  args: { roundId: v.id("interviewRounds"), ...editorArgs },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    const round = await requireRound(ctx, args.roundId);
    const slots = await ctx.db
      .query("interviewSlots")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();
    const posted = [];

    for (const slot of slots) {
      if (!slot.candidateId) {
        continue;
      }

      const candidate = await ctx.db.get(slot.candidateId);

      if (!candidate || candidate.withdrawn) {
        continue;
      }

      posted.push({
        date: slot.date,
        startMinutes: slot.startMinutes,
        durationMinutes: slot.durationMinutes,
        room: slot.room,
        name: publicName(candidate.name, round.publicNameStyle),
        note: slot.note,
      });
    }

    posted.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startMinutes - b.startMinutes ||
        a.room.localeCompare(b.room, undefined, { numeric: true }),
    );

    await ctx.db.patch(args.roundId, {
      published: {
        at: Date.now(),
        by: editor,
        location: round.location,
        message: round.publicMessage,
        slots: posted,
      },
    });
    await touchRound(ctx, args.roundId, editor);
    return { posted: posted.length };
  },
});

export const unpublish = mutation({
  args: { roundId: v.id("interviewRounds"), ...editorArgs },
  handler: async (ctx, args) => {
    const editor = await requireEditor(ctx, args);
    await requireRound(ctx, args.roundId);
    await ctx.db.patch(args.roundId, { published: undefined });
    await touchRound(ctx, args.roundId, editor);
  },
});
