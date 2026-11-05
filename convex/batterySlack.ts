// Slack side of battery tracking: the /battery command, its modals, and the
// Batteries section on the Home tab. Anyone in the Slack workspace can log;
// Slack's request signature is the gate (see convex/lib/slack.ts).
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { BatterySummary } from "./batteries";
import {
  BATTERY_THRESHOLDS,
  STATE_LABELS,
  formatPercent,
  formatResistance,
  parseOptionalNumber,
  type BatteryMatchLevel,
  type BatteryUseKind,
} from "./lib/batteryDomain";
import { escapeMrkdwn, friendlyAttendanceError, jsonResponse, siteUrl, slackApi, verifySlackRequest } from "./lib/slack";

type Program = "frc_5199" | "frc_9271";
type Block = Record<string, unknown>;

export const ACTION_BATTERY_INTO = "battery_into";
export const ACTION_BATTERY_OUT = "battery_out";
export const ACTION_BATTERY_CHECK = "battery_check";
export const ACTION_BATTERY_ANALYZER = "battery_analyzer";
const ACTION_BATTERY_OPEN = "battery_open_web";

const MODAL_INTO = "battery_into_modal";
const MODAL_OUT = "battery_out_modal";
const MODAL_CHECK = "battery_check_modal";
const MODAL_ANALYZER = "battery_analyzer_modal";

const B_BATTERY = "battery_block";
const B_USE = "use_block";
const B_MATCH = "match_number_block";
const B_EVENT = "event_block";
const B_CHARGE = "charge_block";
const B_IR = "ir_block";
const B_CAPACITY = "capacity_block";
const B_NOTES = "notes_block";
const B_CYCLE = "cycle_block";
const B_RAN_AT = "ran_at_block";
const INPUT = "value";

const USE_OPTIONS: { value: string; text: string; kind: BatteryUseKind; matchLevel?: BatteryMatchLevel }[] = [
  { value: "practice", text: "Practice / testing", kind: "practice" },
  { value: "match_practice", text: "Practice match", kind: "match", matchLevel: "practice" },
  { value: "match_qualification", text: "Qualification match", kind: "match", matchLevel: "qualification" },
  { value: "match_playoff", text: "Playoff match", kind: "match", matchLevel: "playoff" },
];

// ---------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------

const mrkdwn = (text: string) => ({ type: "mrkdwn", text });
const plain = (text: string) => ({ type: "plain_text", text: text.slice(0, 150), emoji: true });

function batteriesUrl(path = "") {
  try {
    return `${siteUrl()}/batteries${path}`;
  } catch {
    return undefined;
  }
}

function stateEmoji(battery: BatterySummary) {
  if (battery.retired) return ":black_circle:";
  if (battery.health === "bad") return ":red_circle:";
  if (battery.state === "in_robot") return ":robot_face:";
  if (battery.health === "watch") return ":warning:";
  if (battery.state === "ready") return ":large_green_circle:";
  if (battery.state === "needs_charge") return ":zap:";
  return ":white_circle:";
}

function batteryLine(battery: BatterySummary) {
  const status =
    battery.state === "in_robot" && battery.openUse
      ? `In robot (${battery.openUse.label})`
      : battery.state === "ready"
        ? `Charged ${formatPercent(battery.lastChargePercent)}`
        : STATE_LABELS[battery.state];

  return [
    `${stateEmoji(battery)} *${escapeMrkdwn(battery.displayName)}*`,
    status,
    formatResistance(battery.lastResistanceOhms),
    `${battery.cycleCount} cycles`,
  ].join(" · ");
}

function batteryOption(battery: BatterySummary) {
  const detail = [`${battery.cycleCount} cycles`, formatResistance(battery.lastResistanceOhms)].join(" · ");

  return {
    text: plain(`${battery.displayName} — ${detail}`.slice(0, 75)),
    value: battery._id,
  };
}

function batterySelect(batteries: BatterySummary[], label: string, selectedId?: string) {
  const options = batteries.slice(0, 100).map(batteryOption);
  const initial = options.find((option) => option.value === selectedId) ?? (options.length === 1 ? options[0] : undefined);

  return {
    type: "input",
    block_id: B_BATTERY,
    label: plain(label),
    element: {
      type: "static_select",
      action_id: INPUT,
      placeholder: plain("Pick a battery"),
      options,
      ...(initial ? { initial_option: initial } : {}),
    },
  };
}

function numberInput(blockId: string, label: string, opts: { optional?: boolean; hint?: string; decimal?: boolean; placeholder?: string }) {
  return {
    type: "input",
    block_id: blockId,
    optional: opts.optional ?? false,
    label: plain(label),
    ...(opts.hint ? { hint: plain(opts.hint) } : {}),
    element: {
      type: "number_input",
      action_id: INPUT,
      is_decimal_allowed: opts.decimal ?? true,
      ...(opts.placeholder ? { placeholder: plain(opts.placeholder) } : {}),
    },
  };
}

function textInput(blockId: string, label: string, opts: { initial?: string; hint?: string; placeholder?: string; multiline?: boolean }) {
  return {
    type: "input",
    block_id: blockId,
    optional: true,
    label: plain(label),
    ...(opts.hint ? { hint: plain(opts.hint) } : {}),
    element: {
      type: "plain_text_input",
      action_id: INPUT,
      multiline: opts.multiline ?? false,
      max_length: opts.multiline ? 300 : 40,
      ...(opts.initial ? { initial_value: opts.initial } : {}),
      ...(opts.placeholder ? { placeholder: plain(opts.placeholder) } : {}),
    },
  };
}

const chargeInput = (optional: boolean) =>
  numberInput(B_CHARGE, "Beak charge %", { optional, placeholder: "e.g. 99" });

const irInput = (optional: boolean) =>
  numberInput(B_IR, "Beak internal resistance (Ω)", {
    optional,
    hint: "Type it the way the Beak shows it, e.g. 0.012",
    placeholder: "0.012",
  });

function messageModal(title: string, text: string) {
  return {
    type: "modal",
    title: plain(title.slice(0, 24)),
    close: plain("Done"),
    blocks: [{ type: "section", text: mrkdwn(text) }],
  };
}

function actionButtons(program: Program): Block {
  const elements: Block[] = [
    { type: "button", action_id: ACTION_BATTERY_INTO, style: "primary", text: plain("Into robot"), value: program },
    { type: "button", action_id: ACTION_BATTERY_OUT, text: plain("Out of robot"), value: program },
    { type: "button", action_id: ACTION_BATTERY_CHECK, text: plain("Beak check"), value: program },
    { type: "button", action_id: ACTION_BATTERY_ANALYZER, text: plain("Analyzer run"), value: program },
  ];
  const url = batteriesUrl();

  if (url) {
    elements.push({ type: "button", action_id: ACTION_BATTERY_OPEN, text: plain("Open battery page"), url });
  }

  return { type: "actions", elements };
}

/** The Batteries section of the Home tab (also used by `/battery list`). */
export function batteryHomeBlocks(batteries: BatterySummary[], program: Program = "frc_5199"): Block[] {
  const active = batteries.filter((battery) => !battery.retired);
  const team = program === "frc_9271" ? "9271" : "5199";

  if (active.length === 0) {
    return [
      { type: "section", text: mrkdwn(`*:battery: Batteries · ${team}*\n_No batteries set up yet._`) },
    ];
  }

  const competition = active.filter((battery) => battery.pool === "competition");
  const practice = active.filter((battery) => battery.pool === "practice");
  const blocks: Block[] = [{ type: "section", text: mrkdwn(`*:battery: Batteries · ${team}*`) }];

  if (competition.length > 0) {
    blocks.push({ type: "section", text: mrkdwn(["_Competition_", ...competition.map(batteryLine)].join("\n")) });
  }

  if (practice.length > 0) {
    blocks.push({ type: "section", text: mrkdwn(["_Practice_", ...practice.map(batteryLine)].join("\n")) });
  }

  blocks.push(actionButtons(program));

  return blocks;
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

async function loadBatteries(ctx: ActionCtx, program: Program): Promise<BatterySummary[]> {
  return await ctx.runQuery(internal.batteries.slackList, { program });
}

async function buildModal(ctx: ActionCtx, kind: string, program: Program, batteryId?: string) {
  const batteries = (await loadBatteries(ctx, program)).filter((battery) => !battery.retired);
  const metadata = JSON.stringify({ program });

  if (batteries.length === 0) {
    return messageModal("No batteries", "No batteries are set up yet. Add them on the battery page first.");
  }

  if (kind === ACTION_BATTERY_INTO) {
    const available = batteries.filter((battery) => battery.state !== "in_robot");
    const lastEvent = await ctx.runQuery(internal.batteries.slackLastEventCode, { program });

    if (available.length === 0) {
      return messageModal("All in use", "Every battery is already logged into the robot. Log one out first.");
    }

    return {
      type: "modal",
      callback_id: MODAL_INTO,
      private_metadata: metadata,
      title: plain("Battery into robot"),
      submit: plain("Log it"),
      close: plain("Cancel"),
      blocks: [
        batterySelect(available, "Battery", batteryId),
        {
          type: "input",
          block_id: B_USE,
          label: plain("What's it for?"),
          element: {
            type: "static_select",
            action_id: INPUT,
            options: USE_OPTIONS.map((option) => ({ text: plain(option.text), value: option.value })),
            initial_option: { text: plain(USE_OPTIONS[0].text), value: USE_OPTIONS[0].value },
          },
        },
        numberInput(B_MATCH, "Match number", { optional: true, decimal: false, hint: "Required for matches." }),
        textInput(B_EVENT, "Event code", {
          initial: lastEvent ?? undefined,
          placeholder: "e.g. 2026casj",
          hint: "For matches, so the robot logs line up later.",
        }),
        { type: "divider" },
        { type: "context", elements: [mrkdwn(":mag: *Put the Beak on the battery* and enter what it reads.")] },
        chargeInput(false),
        irInput(false),
        textInput(B_NOTES, "Notes", { multiline: true }),
      ],
    };
  }

  if (kind === ACTION_BATTERY_OUT) {
    const inRobot = batteries.filter((battery) => battery.state === "in_robot");

    if (inRobot.length === 0) {
      return messageModal("Nothing in robot", "No batteries are logged into the robot right now.");
    }

    return {
      type: "modal",
      callback_id: MODAL_OUT,
      private_metadata: metadata,
      title: plain("Battery out of robot"),
      submit: plain("Log it"),
      close: plain("Cancel"),
      blocks: [
        batterySelect(inRobot, "Battery", batteryId),
        { type: "context", elements: [mrkdwn("This counts as *one full cycle*. A Beak reading is optional but helpful.")] },
        chargeInput(true),
        irInput(true),
      ],
    };
  }

  if (kind === ACTION_BATTERY_CHECK) {
    return {
      type: "modal",
      callback_id: MODAL_CHECK,
      private_metadata: metadata,
      title: plain("Beak check"),
      submit: plain("Save"),
      close: plain("Cancel"),
      blocks: [
        batterySelect(batteries, "Battery", batteryId),
        { type: "context", elements: [mrkdwn("Log a reading off the charger. Doesn't count as a cycle.")] },
        chargeInput(false),
        irInput(true),
      ],
    };
  }

  return {
    type: "modal",
    callback_id: MODAL_ANALYZER,
    private_metadata: metadata,
    title: plain("Analyzer run"),
    submit: plain("Save"),
    close: plain("Cancel"),
    blocks: [
      batterySelect(batteries, "Battery", batteryId),
      {
        type: "input",
        block_id: B_RAN_AT,
        label: plain("When did it finish?"),
        element: { type: "datetimepicker", action_id: INPUT, initial_date_time: Math.floor(Date.now() / 1000) },
      },
      numberInput(B_CAPACITY, "Measured capacity (Ah)", { optional: true, placeholder: "e.g. 17.4" }),
      irInput(true),
      {
        type: "input",
        block_id: B_CYCLE,
        optional: true,
        label: plain("Cycle count"),
        element: {
          type: "checkboxes",
          action_id: INPUT,
          options: [{ text: plain("Count this run as a full cycle"), value: "yes" }],
          initial_options: [{ text: plain("Count this run as a full cycle"), value: "yes" }],
        },
      },
      textInput(B_NOTES, "Notes", { multiline: true }),
      { type: "context", elements: [mrkdwn("Want to attach the analyzer graph? Use the battery page on the web.")] },
    ],
  };
}

async function openModal(ctx: ActionCtx, triggerId: string, kind: string, program: Program, batteryId?: string) {
  const view = await buildModal(ctx, kind, program, batteryId);
  const result = await slackApi("views.open", { trigger_id: triggerId, view });

  if (!result.ok) {
    console.error("views.open (battery) failed", result.error, result);
  }
}

// ---------------------------------------------------------------------------
// Interactions (called from convex/slackEvents.ts)
// ---------------------------------------------------------------------------

type StateValues = Record<
  string,
  Record<
    string,
    {
      value?: string | null;
      selected_option?: { value?: string } | null;
      selected_options?: { value?: string }[] | null;
      selected_date_time?: number | null;
    }
  >
>;

export type BatteryInteractionPayload = {
  type?: string;
  trigger_id?: string;
  user?: { id?: string; name?: string; username?: string };
  actions?: { action_id?: string; value?: string }[];
  view?: { callback_id?: string; private_metadata?: string; state?: { values?: StateValues } };
};

const BATTERY_ACTIONS = new Set([ACTION_BATTERY_INTO, ACTION_BATTERY_OUT, ACTION_BATTERY_CHECK, ACTION_BATTERY_ANALYZER]);
const BATTERY_MODALS = new Set([MODAL_INTO, MODAL_OUT, MODAL_CHECK, MODAL_ANALYZER]);

function programFrom(value: string | undefined): Program {
  return value === "frc_9271" ? "frc_9271" : "frc_5199";
}

function errors(blockErrors: Record<string, string>) {
  return jsonResponse({ response_action: "errors", errors: blockErrors });
}

function blockForError(message: string) {
  if (/charge/i.test(message)) return B_CHARGE;
  if (/resistance|IR/i.test(message)) return B_IR;
  if (/match number/i.test(message)) return B_MATCH;
  if (/capacity|analyzer result/i.test(message)) return B_CAPACITY;
  return B_BATTERY;
}

function irWarning(ohms: number | undefined) {
  if (ohms === undefined) return "";
  const value = ohms >= 1 ? ohms / 1000 : ohms;

  if (value > BATTERY_THRESHOLDS.badResistanceOhms) {
    return `\n:red_circle: IR is high (${formatResistance(value)}). Consider making this a practice-only battery.`;
  }

  if (value > BATTERY_THRESHOLDS.watchResistanceOhms) {
    return `\n:warning: IR is getting high (${formatResistance(value)}). Keep an eye on it.`;
  }

  return "";
}

/**
 * Handles battery buttons and modal submissions. Returns a Response when the
 * payload was a battery interaction, or null so the caller handles it.
 */
export async function handleBatteryInteraction(
  ctx: ActionCtx,
  payload: BatteryInteractionPayload,
): Promise<Response | null> {
  const slackUserId = payload.user?.id;

  if (!slackUserId) {
    return null;
  }

  const slackUserName = payload.user?.name ?? payload.user?.username;

  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];

    if (action?.action_id === ACTION_BATTERY_OPEN) {
      return new Response(null, { status: 200 });
    }

    if (!action?.action_id || !BATTERY_ACTIONS.has(action.action_id)) {
      return null;
    }

    if (payload.trigger_id) {
      // Button value is "program" or "program:batteryId".
      const [program, batteryId] = (action.value ?? "").split(":");
      await openModal(ctx, payload.trigger_id, action.action_id, programFrom(program), batteryId);
    }

    return new Response(null, { status: 200 });
  }

  const callbackId = payload.view?.callback_id;

  if (payload.type !== "view_submission" || !callbackId || !BATTERY_MODALS.has(callbackId)) {
    return null;
  }

  const values = payload.view?.state?.values ?? {};
  const field = (block: string) => values[block]?.[INPUT];
  const text = (block: string) => field(block)?.value?.trim() || undefined;
  const number = (block: string) => parseOptionalNumber(field(block)?.value);
  const batteryId = field(B_BATTERY)?.selected_option?.value as Id<"batteries"> | undefined;
  if (!batteryId) {
    return errors({ [B_BATTERY]: "Pick a battery." });
  }

  const who = { slackUserId, slackUserName };
  let title: string;
  let message: string;
  let channelText = "";

  try {
    if (callbackId === MODAL_INTO) {
      const use = USE_OPTIONS.find((option) => option.value === field(B_USE)?.selected_option?.value) ?? USE_OPTIONS[0];
      const matchNumber = number(B_MATCH);

      if (use.kind === "match" && matchNumber === undefined) {
        return errors({ [B_MATCH]: "Enter the match number." });
      }

      const resistance = number(B_IR);
      const result = await ctx.runMutation(internal.batteries.slackStartUse, {
        ...who,
        batteryId,
        kind: use.kind,
        matchLevel: use.matchLevel,
        matchNumber: use.kind === "match" ? matchNumber : undefined,
        eventCode: text(B_EVENT),
        notes: text(B_NOTES),
        chargePercent: number(B_CHARGE),
        resistanceOhms: resistance,
      });

      title = "Into robot";
      message = `*${escapeMrkdwn(result.batteryName)}* is in the robot for *${result.label}*.${irWarning(resistance)}`;
      channelText = `:robot_face: ${result.batteryName} → robot for ${result.label} · ${formatPercent(number(B_CHARGE))} · ${formatResistance(resistance !== undefined && resistance >= 1 ? resistance / 1000 : resistance)}`;
    } else if (callbackId === MODAL_OUT) {
      const result = await ctx.runMutation(internal.batteries.slackEndUse, {
        ...who,
        batteryId,
        chargePercent: number(B_CHARGE),
        resistanceOhms: number(B_IR),
      });

      title = "Out of robot";
      message = `*${escapeMrkdwn(result.batteryName)}* is out after ${result.label} (${result.minutes} min). Lifetime: *${result.cycleCount} cycles*.\nPut it on a charger.`;
      channelText = `:battery: ${result.batteryName} out after ${result.label} · now ${result.cycleCount} cycles`;
    } else if (callbackId === MODAL_CHECK) {
      const resistance = number(B_IR);
      const result = await ctx.runMutation(internal.batteries.slackLogCheck, {
        ...who,
        batteryId,
        chargePercent: number(B_CHARGE),
        resistanceOhms: resistance,
      });

      title = "Reading saved";
      message = `Saved the Beak reading for *${escapeMrkdwn(result.batteryName)}*.${irWarning(resistance)}`;
    } else {
      const ranAtSeconds = field(B_RAN_AT)?.selected_date_time;
      const countsAsCycle = (field(B_CYCLE)?.selected_options ?? []).some((option) => option.value === "yes");
      const result = await ctx.runMutation(internal.batteries.slackLogAnalyzerRun, {
        ...who,
        batteryId,
        ranAt: typeof ranAtSeconds === "number" ? ranAtSeconds * 1000 : undefined,
        capacityAh: number(B_CAPACITY),
        resistanceOhms: number(B_IR),
        notes: text(B_NOTES),
        countsAsCycle,
      });

      title = "Analyzer run saved";
      message = `Saved the analyzer run for *${escapeMrkdwn(result.batteryName)}*.${countsAsCycle ? " Added one cycle." : ""}`;
      channelText = `:test_tube: Analyzer run logged for ${result.batteryName}${number(B_CAPACITY) ? ` · ${number(B_CAPACITY)} Ah` : ""}`;
    }
  } catch (error) {
    const friendly = friendlyAttendanceError(error);
    return errors({ [blockForError(friendly)]: friendly });
  }

  await ctx.scheduler.runAfter(0, internal.slackHome.publishHome, { slackUserId });

  if (channelText) {
    await ctx.scheduler.runAfter(0, internal.batterySlack.postToBatteryChannel, {
      text: `${channelText} · logged by <@${slackUserId}>`,
    });
  }

  return jsonResponse({ response_action: "update", view: messageModal(title, message) });
}

/** Optional running log in a channel. Set SLACK_BATTERY_CHANNEL_ID to turn it on. */
export const postToBatteryChannel = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, args) => {
    const channel = process.env.SLACK_BATTERY_CHANNEL_ID;

    if (!channel || !process.env.SLACK_BOT_TOKEN) {
      return { sent: false };
    }

    const result = await slackApi("chat.postMessage", { channel, text: args.text });

    return { sent: result.ok };
  },
});

// ---------------------------------------------------------------------------
// Slash command: POST /slack/battery
// ---------------------------------------------------------------------------

function ephemeral(body: { text: string; blocks?: Block[] }) {
  return jsonResponse({ response_type: "ephemeral", ...body });
}

const HELP =
  "*/battery* — battery tracking\n" +
  "• `/battery` — fleet status with buttons\n" +
  "• `/battery in` · `/battery out` · `/battery check` · `/battery analyzer` — open a form\n" +
  "• `/battery comp 3` — one battery's stats and last analyzer run\n" +
  "Add `9271` to any of these for the 9271 fleet.";

export const batteryCommand = httpAction(async (ctx, request) => {
  const rawBody = await request.text();

  if (!(await verifySlackRequest(request, rawBody))) {
    return ephemeral({ text: "Slack request verification failed." });
  }

  const params = new URLSearchParams(rawBody);
  const triggerId = params.get("trigger_id") ?? "";
  const words = (params.get("text") ?? "").trim().split(/\s+/).filter(Boolean);
  const program: Program = words.includes("9271") ? "frc_9271" : "frc_5199";
  const rest = words.filter((word) => word !== "9271" && word !== "5199");
  const verb = (rest[0] ?? "").toLowerCase();
  const modalVerbs: Record<string, string> = {
    in: ACTION_BATTERY_INTO,
    into: ACTION_BATTERY_INTO,
    out: ACTION_BATTERY_OUT,
    check: ACTION_BATTERY_CHECK,
    beak: ACTION_BATTERY_CHECK,
    analyzer: ACTION_BATTERY_ANALYZER,
    analyser: ACTION_BATTERY_ANALYZER,
  };

  if (verb === "help") {
    return ephemeral({ text: HELP });
  }

  if (modalVerbs[verb] && triggerId) {
    await openModal(ctx, triggerId, modalVerbs[verb], program);
    return new Response(null, { status: 200 });
  }

  if (!verb || verb === "list" || verb === "status") {
    const batteries = await loadBatteries(ctx, program);
    return ephemeral({ text: "Battery status", blocks: batteryHomeBlocks(batteries, program) });
  }

  const card = await ctx.runQuery(internal.batteries.slackBatteryCard, { program, search: rest.join(" ") });

  if (!card) {
    return ephemeral({ text: `I couldn't find a battery called "${rest.join(" ")}".\n\n${HELP}` });
  }

  const { battery, latestRun } = card;
  const lines = [
    `*${escapeMrkdwn(battery.displayName)}* · ${battery.pool === "competition" ? "Competition" : "Practice"}`,
    `${stateEmoji(battery)} ${battery.openUse ? `In robot (${battery.openUse.label})` : STATE_LABELS[battery.state]}`,
    `*Cycles:* ${battery.cycleCount}  ·  *Matches:* ${battery.matchCount}  ·  *Practice:* ${battery.practiceCount}`,
    `*Last Beak:* ${formatPercent(battery.lastChargePercent)} · ${formatResistance(battery.lastResistanceOhms)}`,
    latestRun
      ? `*Last analyzer run:* <!date^${Math.floor(latestRun.ranAt / 1000)}^{date_short}|${new Date(latestRun.ranAt).toDateString()}> · ${
          latestRun.capacityAh !== undefined ? `${latestRun.capacityAh} Ah` : "no capacity"
        } · ${formatResistance(latestRun.resistanceOhms)}`
      : "*Last analyzer run:* _none yet_",
  ];
  const value = `${program}:${battery._id}`;
  const buttons: Block[] = [
    battery.state === "in_robot"
      ? { type: "button", action_id: ACTION_BATTERY_OUT, style: "primary", text: plain("Out of robot"), value }
      : { type: "button", action_id: ACTION_BATTERY_INTO, style: "primary", text: plain("Into robot"), value },
    { type: "button", action_id: ACTION_BATTERY_CHECK, text: plain("Beak check"), value },
    { type: "button", action_id: ACTION_BATTERY_ANALYZER, text: plain("Analyzer run"), value },
  ];
  const url = batteriesUrl(`/${battery._id}`);

  if (url) {
    buttons.push({ type: "button", action_id: ACTION_BATTERY_OPEN, text: plain("Full history"), url });
  }

  return ephemeral({
    text: battery.displayName,
    blocks: [
      { type: "section", text: mrkdwn(lines.join("\n")) },
      { type: "actions", elements: buttons },
    ],
  });
});
