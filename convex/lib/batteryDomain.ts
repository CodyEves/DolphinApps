// Shared battery rules used by the Convex functions, the Slack app, and the web UI.
// Keep this file free of Convex server imports so the browser bundle can use it too.
import { v } from "convex/values";

export const batteryPoolValidator = v.union(v.literal("competition"), v.literal("practice"));
export type BatteryPool = "competition" | "practice";

export const batteryUseKindValidator = v.union(v.literal("practice"), v.literal("match"));
export type BatteryUseKind = "practice" | "match";

export const batteryMatchLevelValidator = v.union(
  v.literal("practice"),
  v.literal("qualification"),
  v.literal("playoff"),
);
export type BatteryMatchLevel = "practice" | "qualification" | "playoff";

export const batteryLogSourceValidator = v.union(v.literal("web"), v.literal("slack"));

export const batteryReadingContextValidator = v.union(
  v.literal("check"),
  v.literal("use_start"),
  v.literal("use_end"),
  v.literal("analyzer"),
);
export type BatteryReadingContext = "check" | "use_start" | "use_end" | "analyzer";

/** Health thresholds. Tune these once you have a season of your own data. */
export const BATTERY_THRESHOLDS = {
  /** Internal resistance above this is worth watching. */
  watchResistanceOhms: 0.015,
  /** Internal resistance above this should be practice-only. */
  badResistanceOhms: 0.02,
  /** Analyzer capacity below this is worth watching. */
  watchCapacityAh: 15,
  /** A Beak charge reading at or above this counts as "charged". */
  readyChargePercent: 95,
} as const;

export const POOL_LABELS: Record<BatteryPool, string> = {
  competition: "Competition",
  practice: "Practice",
};

export const MATCH_LEVEL_LABELS: Record<BatteryMatchLevel, string> = {
  practice: "Practice match",
  qualification: "Qual",
  playoff: "Playoff",
};

const MATCH_LEVEL_SHORT: Record<BatteryMatchLevel, string> = {
  practice: "P",
  qualification: "Q",
  playoff: "E",
};

/** "Q14", "P3", "E5", or "Practice" — the label used in logs and Slack. */
export function batteryUseLabel(use: {
  kind: BatteryUseKind;
  matchLevel?: BatteryMatchLevel;
  matchNumber?: number;
}) {
  if (use.kind === "practice") {
    return "Practice";
  }

  const level = use.matchLevel ?? "qualification";
  const prefix = MATCH_LEVEL_SHORT[level];

  return use.matchNumber !== undefined ? `${prefix}${use.matchNumber}` : MATCH_LEVEL_LABELS[level];
}

export function batteryDisplayName(battery: { name: string; nickname?: string }) {
  return battery.nickname ? `${battery.name} "${battery.nickname}"` : battery.name;
}

export type BatteryHealth = "good" | "watch" | "bad" | "unknown";

export function healthForResistance(ohms: number | undefined): BatteryHealth {
  if (ohms === undefined) {
    return "unknown";
  }

  if (ohms > BATTERY_THRESHOLDS.badResistanceOhms) {
    return "bad";
  }

  if (ohms > BATTERY_THRESHOLDS.watchResistanceOhms) {
    return "watch";
  }

  return "good";
}

export type BatteryState = "retired" | "in_robot" | "ready" | "needs_charge" | "unknown";

export function batteryState(battery: {
  retired: boolean;
  openUseId?: unknown;
  needsChargeSince?: number;
  lastChargePercent?: number;
}): BatteryState {
  if (battery.retired) return "retired";
  if (battery.openUseId) return "in_robot";
  if (battery.needsChargeSince) return "needs_charge";
  if (battery.lastChargePercent === undefined) return "unknown";

  return battery.lastChargePercent >= BATTERY_THRESHOLDS.readyChargePercent ? "ready" : "needs_charge";
}

export const STATE_LABELS: Record<BatteryState, string> = {
  retired: "Retired",
  in_robot: "In robot",
  ready: "Charged",
  needs_charge: "Needs charge",
  unknown: "No reading yet",
};

/**
 * The Beak shows internal resistance in ohms (e.g. 0.012). People sometimes type
 * milliohms (12) instead, so treat anything 1 or above as mΩ.
 */
export function normalizeResistanceOhms(value: number) {
  return value >= 1 ? value / 1000 : value;
}

export function formatResistance(ohms: number | undefined) {
  return ohms === undefined ? "—" : `${(ohms * 1000).toFixed(1)} mΩ`;
}

export function formatPercent(percent: number | undefined) {
  return percent === undefined ? "—" : `${Math.round(percent)}%`;
}

/** Parses a loose number from a form field. Returns undefined for blank input. */
export function parseOptionalNumber(raw: string | null | undefined) {
  const trimmed = (raw ?? "").replace(/[^0-9.-]/g, "").trim();

  if (!trimmed) {
    return undefined;
  }

  const value = Number(trimmed);

  return Number.isFinite(value) ? value : undefined;
}
