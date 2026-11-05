// Battery tracking: which battery was in the robot for which match, Beak readings,
// analyzer runs, and lifetime full-cycle counts.
//
// Reading is public (no sign-in). Writing needs one of:
//   - a signed-in, active Dolphin Apps account,
//   - the shared pit PIN (Convex env var BATTERY_PIN) plus a name, or
//   - a Slack user in the workspace (the internal `slack*` mutations below,
//     called from convex/batterySlack.ts after Slack's signature check).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  BATTERY_THRESHOLDS,
  batteryDisplayName,
  batteryMatchLevelValidator,
  batteryPoolValidator,
  batteryState,
  batteryUseKindValidator,
  healthForResistance,
  normalizeResistanceOhms,
  batteryUseLabel,
  type BatteryMatchLevel,
  type BatteryReadingContext,
  type BatteryUseKind,
} from "./lib/batteryDomain";
import { programValidator } from "./lib/validators";
import { slackLinkForSlackUser } from "./lib/slackIdentity";
import { displayNameFor } from "./shopAttendance";

type Ctx = QueryCtx | MutationCtx;
type Writer = { name: string; source: "web" | "slack" };
type Program = Doc<"batteries">["program"];

const MAX_TEXT = 300;
const MAX_NAME = 60;

// ---------------------------------------------------------------------------
// Who is writing?
// ---------------------------------------------------------------------------

function cleanText(value: string | undefined, max = MAX_TEXT) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function pinMatches(pin: string | undefined) {
  const expected = process.env.BATTERY_PIN?.trim();

  if (!expected || !pin) {
    return false;
  }

  const given = pin.trim();

  if (given.length !== expected.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < given.length; index += 1) {
    diff |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return diff === 0;
}

async function signedInName(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!profile || profile.status !== "active" || profile.role === "kiosk") {
    return null;
  }

  return displayNameFor(profile, await ctx.db.get(userId));
}

const webWriterArgs = {
  pin: v.optional(v.string()),
  loggerName: v.optional(v.string()),
};

async function requireWebWriter(
  ctx: MutationCtx,
  args: { pin?: string; loggerName?: string },
): Promise<Writer> {
  const accountName = await signedInName(ctx);

  if (accountName) {
    return { name: accountName, source: "web" };
  }

  if (!pinMatches(args.pin)) {
    throw new Error("Enter the pit PIN to log battery data.");
  }

  const name = cleanText(args.loggerName, MAX_NAME);

  if (!name) {
    throw new Error("Enter your name so we know who logged this.");
  }

  return { name, source: "web" };
}

async function slackWriter(ctx: MutationCtx, slackUserId: string, slackUserName?: string): Promise<Writer> {
  const link = await slackLinkForSlackUser(ctx, slackUserId);
  const profile = link ? await ctx.db.get(link.profileId) : null;

  if (profile && profile.status === "active") {
    return { name: displayNameFor(profile, await ctx.db.get(profile.userId)), source: "slack" };
  }

  return { name: cleanText(slackUserName, MAX_NAME) ?? "Slack user", source: "slack" };
}

// ---------------------------------------------------------------------------
// Core operations (shared by web and Slack)
// ---------------------------------------------------------------------------

async function requireBattery(ctx: Ctx, batteryId: Id<"batteries">) {
  const battery = await ctx.db.get(batteryId);

  if (!battery) {
    throw new Error("Battery not found.");
  }

  return battery;
}

function checkCharge(value: number | undefined, required: boolean) {
  if (value === undefined) {
    if (required) throw new Error("Enter the Beak charge %.");
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0 || value > 150) {
    throw new Error("Charge % should be between 0 and 100.");
  }

  return value;
}

function checkResistance(value: number | undefined, required: boolean) {
  if (value === undefined) {
    if (required) throw new Error("Enter the Beak internal resistance.");
    return undefined;
  }

  const ohms = normalizeResistanceOhms(value);

  if (!Number.isFinite(ohms) || ohms <= 0 || ohms > 0.5) {
    throw new Error("Internal resistance looks off. Enter it like the Beak shows it, e.g. 0.012.");
  }

  return ohms;
}

async function recordReading(
  ctx: MutationCtx,
  battery: Doc<"batteries">,
  writer: Writer,
  reading: {
    context: BatteryReadingContext;
    chargePercent?: number;
    resistanceOhms?: number;
    useId?: Id<"batteryUses">;
    takenAt: number;
  },
) {
  if (reading.chargePercent === undefined && reading.resistanceOhms === undefined) {
    return {};
  }

  await ctx.db.insert("batteryReadings", {
    batteryId: battery._id,
    context: reading.context,
    takenAt: reading.takenAt,
    chargePercent: reading.chargePercent,
    resistanceOhms: reading.resistanceOhms,
    useId: reading.useId,
    loggedBy: writer.name,
  });

  const charged =
    reading.context !== "use_end" &&
    reading.chargePercent !== undefined &&
    reading.chargePercent >= BATTERY_THRESHOLDS.readyChargePercent;

  // Keep the battery's "latest reading" fields current for the list view.
  return {
    ...(charged ? { needsChargeSince: undefined } : {}),
    ...(reading.chargePercent !== undefined ? { lastChargePercent: reading.chargePercent } : {}),
    ...(reading.resistanceOhms !== undefined ? { lastResistanceOhms: reading.resistanceOhms } : {}),
    lastReadingAt: reading.takenAt,
  };
}

const startUseFields = {
  batteryId: v.id("batteries"),
  kind: batteryUseKindValidator,
  matchLevel: v.optional(batteryMatchLevelValidator),
  matchNumber: v.optional(v.number()),
  eventCode: v.optional(v.string()),
  notes: v.optional(v.string()),
  chargePercent: v.optional(v.number()),
  resistanceOhms: v.optional(v.number()),
};

type StartUseArgs = {
  batteryId: Id<"batteries">;
  kind: BatteryUseKind;
  matchLevel?: BatteryMatchLevel;
  matchNumber?: number;
  eventCode?: string;
  notes?: string;
  chargePercent?: number;
  resistanceOhms?: number;
};

async function startUse(ctx: MutationCtx, writer: Writer, args: StartUseArgs) {
  const battery = await requireBattery(ctx, args.batteryId);

  if (battery.retired) {
    throw new Error(`${battery.name} is retired.`);
  }

  if (battery.openUseId) {
    throw new Error(`${battery.name} is already in the robot. Log it out first.`);
  }

  const chargePercent = checkCharge(args.chargePercent, true);
  const resistanceOhms = checkResistance(args.resistanceOhms, true);
  let matchLevel: BatteryMatchLevel | undefined;
  let matchNumber: number | undefined;

  if (args.kind === "match") {
    matchLevel = args.matchLevel ?? "qualification";

    if (args.matchNumber === undefined || !Number.isInteger(args.matchNumber) || args.matchNumber < 1) {
      throw new Error("Enter the match number.");
    }

    matchNumber = args.matchNumber;
  }

  const now = Date.now();
  const useId = await ctx.db.insert("batteryUses", {
    batteryId: battery._id,
    program: battery.program,
    kind: args.kind,
    matchLevel,
    matchNumber,
    eventCode: cleanText(args.eventCode, 40)?.toLowerCase(),
    notes: cleanText(args.notes),
    startedAt: now,
    startChargePercent: chargePercent,
    startResistanceOhms: resistanceOhms,
    loggedBy: writer.name,
    source: writer.source,
    createdAt: now,
  });
  const latest = await recordReading(ctx, battery, writer, {
    context: "use_start",
    chargePercent,
    resistanceOhms,
    useId,
    takenAt: now,
  });

  await ctx.db.patch(battery._id, { ...latest, openUseId: useId, updatedAt: now });

  return {
    useId,
    batteryName: batteryDisplayName(battery),
    label: batteryUseLabel({ kind: args.kind, matchLevel, matchNumber }),
    health: healthForResistance(resistanceOhms),
  };
}

async function endUse(
  ctx: MutationCtx,
  writer: Writer,
  args: { batteryId: Id<"batteries">; chargePercent?: number; resistanceOhms?: number },
) {
  const battery = await requireBattery(ctx, args.batteryId);
  const use = battery.openUseId ? await ctx.db.get(battery.openUseId) : null;

  if (!use) {
    throw new Error(`${battery.name} isn't logged into the robot.`);
  }

  const chargePercent = checkCharge(args.chargePercent, false);
  const resistanceOhms = checkResistance(args.resistanceOhms, false);
  const now = Date.now();

  await ctx.db.patch(use._id, {
    endedAt: now,
    endChargePercent: chargePercent,
    endResistanceOhms: resistanceOhms,
    endedBy: writer.name,
  });

  const latest = await recordReading(ctx, battery, writer, {
    context: "use_end",
    chargePercent,
    resistanceOhms,
    useId: use._id,
    takenAt: now,
  });

  // A robot use counts as one full charge/discharge cycle once it comes out.
  await ctx.db.patch(battery._id, {
    ...latest,
    // Just came off the robot: it needs charging until a charged reading is logged.
    needsChargeSince: now,
    openUseId: undefined,
    cycleCount: battery.cycleCount + 1,
    matchCount: battery.matchCount + (use.kind === "match" ? 1 : 0),
    practiceCount: battery.practiceCount + (use.kind === "practice" ? 1 : 0),
    updatedAt: now,
  });

  return {
    batteryName: batteryDisplayName(battery),
    label: batteryUseLabel(use),
    minutes: Math.max(0, Math.round((now - use.startedAt) / 60000)),
    cycleCount: battery.cycleCount + 1,
  };
}

async function logCheck(
  ctx: MutationCtx,
  writer: Writer,
  args: { batteryId: Id<"batteries">; chargePercent?: number; resistanceOhms?: number },
) {
  const battery = await requireBattery(ctx, args.batteryId);
  const chargePercent = checkCharge(args.chargePercent, true);
  const resistanceOhms = checkResistance(args.resistanceOhms, false);
  const now = Date.now();
  const latest = await recordReading(ctx, battery, writer, {
    context: "check",
    chargePercent,
    resistanceOhms,
    takenAt: now,
  });

  await ctx.db.patch(battery._id, { ...latest, updatedAt: now });

  return { batteryName: batteryDisplayName(battery), health: healthForResistance(resistanceOhms) };
}

const analyzerFields = {
  batteryId: v.id("batteries"),
  ranAt: v.optional(v.number()),
  capacityAh: v.optional(v.number()),
  resistanceOhms: v.optional(v.number()),
  dischargeAmps: v.optional(v.number()),
  notes: v.optional(v.string()),
  countsAsCycle: v.optional(v.boolean()),
  fileStorageId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
};

async function logAnalyzerRun(
  ctx: MutationCtx,
  writer: Writer,
  args: {
    batteryId: Id<"batteries">;
    ranAt?: number;
    capacityAh?: number;
    resistanceOhms?: number;
    dischargeAmps?: number;
    notes?: string;
    countsAsCycle?: boolean;
    fileStorageId?: Id<"_storage">;
    fileName?: string;
  },
) {
  const battery = await requireBattery(ctx, args.batteryId);

  if (args.capacityAh !== undefined && (!Number.isFinite(args.capacityAh) || args.capacityAh <= 0 || args.capacityAh > 40)) {
    throw new Error("Capacity should be in amp-hours, e.g. 17.2.");
  }

  if (args.capacityAh === undefined && args.resistanceOhms === undefined && !args.fileStorageId) {
    throw new Error("Enter the capacity, the IR, or attach the analyzer result.");
  }

  const resistanceOhms = checkResistance(args.resistanceOhms, false);
  const now = Date.now();
  const ranAt = args.ranAt && args.ranAt <= now + 60_000 ? args.ranAt : now;
  const countsAsCycle = args.countsAsCycle ?? true;

  const runId = await ctx.db.insert("batteryAnalyzerRuns", {
    batteryId: battery._id,
    program: battery.program,
    ranAt,
    capacityAh: args.capacityAh,
    resistanceOhms,
    dischargeAmps: args.dischargeAmps,
    notes: cleanText(args.notes),
    fileStorageId: args.fileStorageId,
    fileName: cleanText(args.fileName, 120),
    countsAsCycle,
    loggedBy: writer.name,
    source: writer.source,
    createdAt: now,
  });
  const latest =
    resistanceOhms !== undefined
      ? await recordReading(ctx, battery, writer, { context: "analyzer", resistanceOhms, takenAt: ranAt })
      : {};

  await ctx.db.patch(battery._id, {
    ...latest,
    cycleCount: battery.cycleCount + (countsAsCycle ? 1 : 0),
    analyzerCount: battery.analyzerCount + 1,
    updatedAt: now,
  });

  return { runId, batteryName: batteryDisplayName(battery) };
}

/** Re-derives the "latest reading" fields after a reading is deleted. */
async function refreshLatestReading(ctx: MutationCtx, batteryId: Id<"batteries">) {
  const readings = await ctx.db
    .query("batteryReadings")
    .withIndex("by_battery_taken", (q) => q.eq("batteryId", batteryId))
    .order("desc")
    .take(50);
  const lastCharge = readings.find((reading) => reading.chargePercent !== undefined);
  const lastResistance = readings.find((reading) => reading.resistanceOhms !== undefined);

  await ctx.db.patch(batteryId, {
    lastChargePercent: lastCharge?.chargePercent,
    lastResistanceOhms: lastResistance?.resistanceOhms,
    lastReadingAt: readings[0]?.takenAt,
  });
}

async function deleteReadingsForUse(ctx: MutationCtx, use: Doc<"batteryUses">) {
  const readings = await ctx.db
    .query("batteryReadings")
    .withIndex("by_battery_taken", (q) => q.eq("batteryId", use.batteryId).gte("takenAt", use.startedAt))
    .collect();

  for (const reading of readings) {
    if (reading.useId === use._id) {
      await ctx.db.delete(reading._id);
    }
  }
}

// ---------------------------------------------------------------------------
// Public queries (no sign-in required)
// ---------------------------------------------------------------------------

function summarize(battery: Doc<"batteries">, openUse: Doc<"batteryUses"> | null) {
  return {
    _id: battery._id,
    program: battery.program,
    name: battery.name,
    nickname: battery.nickname,
    displayName: batteryDisplayName(battery),
    pool: battery.pool,
    retired: battery.retired,
    sortOrder: battery.sortOrder,
    cycleCount: battery.cycleCount,
    matchCount: battery.matchCount,
    practiceCount: battery.practiceCount,
    analyzerCount: battery.analyzerCount,
    lastChargePercent: battery.lastChargePercent,
    lastResistanceOhms: battery.lastResistanceOhms,
    lastReadingAt: battery.lastReadingAt,
    state: batteryState(battery),
    health: healthForResistance(battery.lastResistanceOhms),
    openUse: openUse
      ? { _id: openUse._id, label: batteryUseLabel(openUse), startedAt: openUse.startedAt, eventCode: openUse.eventCode }
      : null,
  };
}

export type BatterySummary = ReturnType<typeof summarize>;

async function listForProgram(ctx: Ctx, program: Program) {
  const batteries = await ctx.db
    .query("batteries")
    .withIndex("by_program", (q) => q.eq("program", program))
    .collect();

  const summaries = await Promise.all(
    batteries.map(async (battery) =>
      summarize(battery, battery.openUseId ? await ctx.db.get(battery.openUseId) : null),
    ),
  );

  return summaries.sort(
    (a, b) =>
      Number(a.retired) - Number(b.retired) ||
      (a.pool === b.pool ? 0 : a.pool === "competition" ? -1 : 1) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

export const list = query({
  args: { program: programValidator },
  handler: async (ctx, args) => await listForProgram(ctx, args.program),
});

export const detail = query({
  args: { batteryId: v.id("batteries") },
  handler: async (ctx, args) => {
    const battery = await ctx.db.get(args.batteryId);

    if (!battery) {
      return null;
    }

    const [uses, runs, readings, adjustments] = await Promise.all([
      ctx.db
        .query("batteryUses")
        .withIndex("by_battery_started", (q) => q.eq("batteryId", battery._id))
        .order("desc")
        .take(100),
      ctx.db
        .query("batteryAnalyzerRuns")
        .withIndex("by_battery_ran", (q) => q.eq("batteryId", battery._id))
        .order("desc")
        .take(25),
      ctx.db
        .query("batteryReadings")
        .withIndex("by_battery_taken", (q) => q.eq("batteryId", battery._id))
        .order("desc")
        .take(200),
      ctx.db
        .query("batteryAdjustments")
        .withIndex("by_battery", (q) => q.eq("batteryId", battery._id))
        .order("desc")
        .take(25),
    ]);
    const openUse = battery.openUseId ? await ctx.db.get(battery.openUseId) : null;
    const analyzerRuns = await Promise.all(
      runs.map(async (run) => ({
        ...run,
        fileUrl: run.fileStorageId ? await ctx.storage.getUrl(run.fileStorageId) : null,
      })),
    );

    return {
      battery: {
        ...summarize(battery, openUse),
        manufacturer: battery.manufacturer,
        purchasedOn: battery.purchasedOn,
        notes: battery.notes,
      },
      latestAnalyzerRun: analyzerRuns[0] ?? null,
      analyzerRuns,
      uses: uses.map((use) => ({ ...use, label: batteryUseLabel(use) })),
      readings: readings.reverse(),
      adjustments,
    };
  },
});

/** The event code from the most recent match, to prefill the next log. */
export const lastEventCode = query({
  args: { program: programValidator },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("batteryUses")
      .withIndex("by_program_started", (q) => q.eq("program", args.program))
      .order("desc")
      .take(20);

    return recent.find((use) => use.eventCode)?.eventCode ?? null;
  },
});

/** Every robot use, oldest first, for CSV export / log matching. */
export const exportUses = query({
  args: { program: programValidator },
  handler: async (ctx, args) => {
    const uses = await ctx.db
      .query("batteryUses")
      .withIndex("by_program_started", (q) => q.eq("program", args.program))
      .collect();
    const names = new Map<string, string>();

    for (const use of uses) {
      if (!names.has(use.batteryId)) {
        const battery = await ctx.db.get(use.batteryId);
        names.set(use.batteryId, battery ? batteryDisplayName(battery) : "Deleted battery");
      }
    }

    return uses.map((use) => ({
      battery: names.get(use.batteryId) ?? "",
      label: batteryUseLabel(use),
      kind: use.kind,
      matchLevel: use.matchLevel ?? "",
      matchNumber: use.matchNumber ?? null,
      eventCode: use.eventCode ?? "",
      startedAt: use.startedAt,
      endedAt: use.endedAt ?? null,
      startChargePercent: use.startChargePercent ?? null,
      startResistanceOhms: use.startResistanceOhms ?? null,
      endChargePercent: use.endChargePercent ?? null,
      endResistanceOhms: use.endResistanceOhms ?? null,
      loggedBy: use.loggedBy,
      notes: use.notes ?? "",
    }));
  },
});

/** Tells the web UI whether a PIN is needed (signed-in accounts skip it). */
export const writeAccess = query({
  args: {},
  handler: async (ctx) => {
    const accountName = await signedInName(ctx);

    return {
      signedInAs: accountName,
      pinConfigured: Boolean(process.env.BATTERY_PIN?.trim()),
    };
  },
});

// ---------------------------------------------------------------------------
// Web mutations (PIN or signed-in account)
// ---------------------------------------------------------------------------

export const checkPin = mutation({
  args: { pin: v.string() },
  handler: async (_ctx, args) => ({ ok: pinMatches(args.pin) }),
});

export const startUseWeb = mutation({
  args: { ...webWriterArgs, ...startUseFields },
  handler: async (ctx, { pin, loggerName, ...args }) =>
    await startUse(ctx, await requireWebWriter(ctx, { pin, loggerName }), args),
});

export const endUseWeb = mutation({
  args: {
    ...webWriterArgs,
    batteryId: v.id("batteries"),
    chargePercent: v.optional(v.number()),
    resistanceOhms: v.optional(v.number()),
  },
  handler: async (ctx, { pin, loggerName, ...args }) =>
    await endUse(ctx, await requireWebWriter(ctx, { pin, loggerName }), args),
});

export const logCheckWeb = mutation({
  args: {
    ...webWriterArgs,
    batteryId: v.id("batteries"),
    chargePercent: v.optional(v.number()),
    resistanceOhms: v.optional(v.number()),
  },
  handler: async (ctx, { pin, loggerName, ...args }) =>
    await logCheck(ctx, await requireWebWriter(ctx, { pin, loggerName }), args),
});

export const generateAnalyzerUploadUrl = mutation({
  args: webWriterArgs,
  handler: async (ctx, args) => {
    await requireWebWriter(ctx, args);
    return await ctx.storage.generateUploadUrl();
  },
});

export const logAnalyzerRunWeb = mutation({
  args: { ...webWriterArgs, ...analyzerFields },
  handler: async (ctx, { pin, loggerName, ...args }) =>
    await logAnalyzerRun(ctx, await requireWebWriter(ctx, { pin, loggerName }), args),
});

export const adjustCycles = mutation({
  args: {
    ...webWriterArgs,
    batteryId: v.id("batteries"),
    cycleDelta: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { pin, loggerName, ...args }) => {
    const writer = await requireWebWriter(ctx, { pin, loggerName });
    const battery = await requireBattery(ctx, args.batteryId);
    const reason = cleanText(args.reason);

    if (!Number.isInteger(args.cycleDelta) || args.cycleDelta === 0) {
      throw new Error("Enter a whole number of cycles to add or remove.");
    }

    if (!reason) {
      throw new Error("Add a reason for the change.");
    }

    const now = Date.now();

    await ctx.db.insert("batteryAdjustments", {
      batteryId: battery._id,
      cycleDelta: args.cycleDelta,
      reason,
      loggedBy: writer.name,
      source: writer.source,
      createdAt: now,
    });
    await ctx.db.patch(battery._id, {
      cycleCount: Math.max(0, battery.cycleCount + args.cycleDelta),
      updatedAt: now,
    });
  },
});

const batteryEditFields = {
  name: v.string(),
  nickname: v.optional(v.string()),
  pool: batteryPoolValidator,
  retired: v.optional(v.boolean()),
  manufacturer: v.optional(v.string()),
  purchasedOn: v.optional(v.string()),
  notes: v.optional(v.string()),
};

export const createBattery = mutation({
  args: {
    ...webWriterArgs,
    ...batteryEditFields,
    program: programValidator,
    startingCycles: v.optional(v.number()),
  },
  handler: async (ctx, { pin, loggerName, startingCycles, ...args }) => {
    await requireWebWriter(ctx, { pin, loggerName });
    const name = cleanText(args.name, MAX_NAME);

    if (!name) {
      throw new Error("Give the battery a name.");
    }

    const existing = await ctx.db
      .query("batteries")
      .withIndex("by_program", (q) => q.eq("program", args.program))
      .collect();

    if (existing.some((battery) => battery.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`There's already a battery named ${name}.`);
    }

    const now = Date.now();

    return await ctx.db.insert("batteries", {
      program: args.program,
      name,
      nickname: cleanText(args.nickname, MAX_NAME),
      pool: args.pool,
      retired: args.retired ?? false,
      manufacturer: cleanText(args.manufacturer, MAX_NAME),
      purchasedOn: cleanText(args.purchasedOn, 20),
      notes: cleanText(args.notes),
      sortOrder: existing.length,
      cycleCount: Math.max(0, Math.round(startingCycles ?? 0)),
      matchCount: 0,
      practiceCount: 0,
      analyzerCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateBattery = mutation({
  args: { ...webWriterArgs, ...batteryEditFields, batteryId: v.id("batteries") },
  handler: async (ctx, { pin, loggerName, batteryId, ...args }) => {
    await requireWebWriter(ctx, { pin, loggerName });
    const battery = await requireBattery(ctx, batteryId);
    const name = cleanText(args.name, MAX_NAME);

    if (!name) {
      throw new Error("Give the battery a name.");
    }

    if (args.retired && battery.openUseId) {
      throw new Error("Log the battery out of the robot before retiring it.");
    }

    await ctx.db.patch(battery._id, {
      name,
      nickname: cleanText(args.nickname, MAX_NAME),
      pool: args.pool,
      retired: args.retired ?? battery.retired,
      manufacturer: cleanText(args.manufacturer, MAX_NAME),
      purchasedOn: cleanText(args.purchasedOn, 20),
      notes: cleanText(args.notes),
      updatedAt: Date.now(),
    });
  },
});

/** Removes a mistaken use log and backs out its cycle. */
export const deleteUse = mutation({
  args: { ...webWriterArgs, useId: v.id("batteryUses") },
  handler: async (ctx, { pin, loggerName, useId }) => {
    await requireWebWriter(ctx, { pin, loggerName });
    const use = await ctx.db.get(useId);

    if (!use) {
      return;
    }

    const battery = await requireBattery(ctx, use.batteryId);
    const completed = use.endedAt !== undefined;

    await deleteReadingsForUse(ctx, use);
    await ctx.db.delete(use._id);
    await ctx.db.patch(battery._id, {
      openUseId: battery.openUseId === use._id ? undefined : battery.openUseId,
      cycleCount: Math.max(0, battery.cycleCount - (completed ? 1 : 0)),
      matchCount: Math.max(0, battery.matchCount - (completed && use.kind === "match" ? 1 : 0)),
      practiceCount: Math.max(0, battery.practiceCount - (completed && use.kind === "practice" ? 1 : 0)),
      updatedAt: Date.now(),
    });
    await refreshLatestReading(ctx, battery._id);
  },
});

export const deleteAnalyzerRun = mutation({
  args: { ...webWriterArgs, runId: v.id("batteryAnalyzerRuns") },
  handler: async (ctx, { pin, loggerName, runId }) => {
    await requireWebWriter(ctx, { pin, loggerName });
    const run = await ctx.db.get(runId);

    if (!run) {
      return;
    }

    const battery = await requireBattery(ctx, run.batteryId);
    const readings = await ctx.db
      .query("batteryReadings")
      .withIndex("by_battery_taken", (q) => q.eq("batteryId", run.batteryId).eq("takenAt", run.ranAt))
      .collect();

    for (const reading of readings) {
      if (reading.context === "analyzer") {
        await ctx.db.delete(reading._id);
      }
    }

    if (run.fileStorageId) {
      await ctx.storage.delete(run.fileStorageId);
    }

    await ctx.db.delete(run._id);
    await ctx.db.patch(battery._id, {
      cycleCount: Math.max(0, battery.cycleCount - (run.countsAsCycle ? 1 : 0)),
      analyzerCount: Math.max(0, battery.analyzerCount - 1),
      updatedAt: Date.now(),
    });
    await refreshLatestReading(ctx, battery._id);
  },
});

// ---------------------------------------------------------------------------
// Slack (internal — only reachable through the signed Slack endpoints)
// ---------------------------------------------------------------------------

const slackArgs = { slackUserId: v.string(), slackUserName: v.optional(v.string()) };

export const slackList = internalQuery({
  args: { program: programValidator },
  handler: async (ctx, args) => await listForProgram(ctx, args.program),
});

export const slackLastEventCode = internalQuery({
  args: { program: programValidator },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("batteryUses")
      .withIndex("by_program_started", (q) => q.eq("program", args.program))
      .order("desc")
      .take(20);

    return recent.find((use) => use.eventCode)?.eventCode ?? null;
  },
});

export const slackBatteryCard = internalQuery({
  args: { program: programValidator, search: v.string() },
  handler: async (ctx, args) => {
    const batteries = await listForProgram(ctx, args.program);
    const needle = args.search.trim().toLowerCase().replace(/^#/, "");
    const digits = needle.match(/\d+/)?.[0];
    const match =
      batteries.find((battery) => battery.name.toLowerCase() === needle) ??
      batteries.find((battery) => battery.nickname?.toLowerCase() === needle) ??
      batteries.find(
        (battery) =>
          digits !== undefined &&
          battery.name.match(/\d+/)?.[0] === digits &&
          (needle.startsWith("p") ? battery.pool === "practice" : battery.pool === "competition"),
      ) ??
      batteries.find((battery) => battery.displayName.toLowerCase().includes(needle));

    if (!match) {
      return null;
    }

    const latestRun = await ctx.db
      .query("batteryAnalyzerRuns")
      .withIndex("by_battery_ran", (q) => q.eq("batteryId", match._id))
      .order("desc")
      .first();

    return { battery: match, latestRun };
  },
});

export const slackStartUse = internalMutation({
  args: { ...slackArgs, ...startUseFields },
  handler: async (ctx, { slackUserId, slackUserName, ...args }) =>
    await startUse(ctx, await slackWriter(ctx, slackUserId, slackUserName), args),
});

export const slackEndUse = internalMutation({
  args: {
    ...slackArgs,
    batteryId: v.id("batteries"),
    chargePercent: v.optional(v.number()),
    resistanceOhms: v.optional(v.number()),
  },
  handler: async (ctx, { slackUserId, slackUserName, ...args }) =>
    await endUse(ctx, await slackWriter(ctx, slackUserId, slackUserName), args),
});

export const slackLogCheck = internalMutation({
  args: {
    ...slackArgs,
    batteryId: v.id("batteries"),
    chargePercent: v.optional(v.number()),
    resistanceOhms: v.optional(v.number()),
  },
  handler: async (ctx, { slackUserId, slackUserName, ...args }) =>
    await logCheck(ctx, await slackWriter(ctx, slackUserId, slackUserName), args),
});

export const slackLogAnalyzerRun = internalMutation({
  args: { ...slackArgs, ...analyzerFields },
  handler: async (ctx, { slackUserId, slackUserName, ...args }) =>
    await logAnalyzerRun(ctx, await slackWriter(ctx, slackUserId, slackUserName), args),
});

// ---------------------------------------------------------------------------
// One-time setup
// ---------------------------------------------------------------------------

/**
 * Creates the 5199 fleet (Comp 1–8, Practice 1–4) if no 5199 batteries exist yet.
 *   bunx convex run batteries:seedFleet '{}'
 * Add `--prod` for production. Nicknames can be set afterwards on the website.
 */
export const seedFleet = internalMutation({
  args: {
    program: v.optional(programValidator),
    competitionCount: v.optional(v.number()),
    practiceCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const program = args.program ?? "frc_5199";
    const existing = await ctx.db
      .query("batteries")
      .withIndex("by_program", (q) => q.eq("program", program))
      .first();

    if (existing) {
      return { created: 0, skipped: "Batteries already exist for this team." };
    }

    const now = Date.now();
    const plan = [
      ...Array.from({ length: args.competitionCount ?? 8 }, (_, index) => ({
        name: `Comp ${index + 1}`,
        pool: "competition" as const,
      })),
      ...Array.from({ length: args.practiceCount ?? 4 }, (_, index) => ({
        name: `Practice ${index + 1}`,
        pool: "practice" as const,
      })),
    ];

    for (const [index, item] of plan.entries()) {
      await ctx.db.insert("batteries", {
        program,
        name: item.name,
        pool: item.pool,
        retired: false,
        sortOrder: index,
        cycleCount: 0,
        matchCount: 0,
        practiceCount: 0,
        analyzerCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { created: plan.length };
  },
});
