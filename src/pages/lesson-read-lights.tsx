import { ExternalLink, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Goals, Lab, Takeaway } from "@/components/learning/lab-ui";
import { LessonShell, SkillCheckChapter } from "@/components/learning/lesson-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Light codes come from the vendor references:
 *   CTRE Talon FX hardware reference (Phoenix 6 status LEDs)
 *   REV Power Distribution Hub status LED patterns (firmware 21.1.7+)
 * Codes can change with firmware, so the lesson keeps pointing students back to the docs.
 */

type LedColor = "off" | "red" | "green" | "orange" | "blue" | "cyan" | "magenta" | "yellow";

/** Two frames of [LED A, LED B]; the LEDs flip between frame 0 and frame 1. */
type TalonPattern = { frames: [[LedColor, LedColor], [LedColor, LedColor]]; periodMs: number };

const TALON: Record<string, { label: string; pattern: TalonPattern; meaning: string; fix: string; enabled: boolean }> = {
  off: {
    label: "LEDs off",
    pattern: { frames: [["off", "off"], ["off", "off"]], periodMs: 500 },
    meaning: "No power",
    fix: "Check the red and black power leads, the PDH channel, and its breaker.",
    enabled: false,
  },
  noCan: {
    label: "Alternating red",
    pattern: { frames: [["red", "off"], ["off", "red"]], periodMs: 450 },
    meaning: "No CAN or PWM signal",
    fix: "Check the yellow and green CAN wires and that the robot controller is on.",
    enabled: false,
  },
  noPhoenix: {
    label: "Alternating orange",
    pattern: { frames: [["orange", "off"], ["off", "orange"]], periodMs: 450 },
    meaning: "CAN is fine, but no robot program using Phoenix is running",
    fix: "Deploy robot code that uses Phoenix, or check the connection to this device.",
    enabled: false,
  },
  disabledOk: {
    label: "Both orange, blinking together",
    pattern: { frames: [["orange", "orange"], ["off", "off"]], periodMs: 450 },
    meaning: "All good, robot disabled",
    fix: "Nothing to fix. If the robot is enabled, check that code is sending this motor a command.",
    enabled: false,
  },
  neutral: {
    label: "Both solid orange",
    pattern: { frames: [["orange", "orange"], ["orange", "orange"]], periodMs: 500 },
    meaning: "Enabled, output is neutral (0%)",
    fix: "Nothing to fix. The motor is enabled but told to stop.",
    enabled: true,
  },
  forward: {
    label: "Both green, blinking together",
    pattern: { frames: [["green", "green"], ["off", "off"]], periodMs: 220 },
    meaning: "Driving forward (faster blink = more output)",
    fix: "Nothing to fix.",
    enabled: true,
  },
  reverse: {
    label: "Both red, blinking together",
    pattern: { frames: [["red", "red"], ["off", "off"]], periodMs: 220 },
    meaning: "Driving in reverse (faster blink = more output)",
    fix: "Nothing to fix, unless it should be going forward: check the inverted setting.",
    enabled: true,
  },
  limit: {
    label: "One side red, other off",
    pattern: { frames: [["red", "off"], ["off", "off"]], periodMs: 300 },
    meaning: "Stopped by a forward or reverse limit (the side shows which)",
    fix: "Check the limit switch or soft limit. A stuck limit switch looks like this.",
    enabled: true,
  },
  thermal: {
    label: "One side orange, other off",
    pattern: { frames: [["orange", "off"], ["off", "off"]], periodMs: 600 },
    meaning: "Thermal cutoff: the motor is too hot",
    fix: "Let it cool. Set a stator current limit and check for a mechanism that is binding or stalled.",
    enabled: true,
  },
  bootloader: {
    label: "One LED alternating green and orange",
    pattern: { frames: [["green", "off"], ["orange", "off"]], periodMs: 400 },
    meaning: "Bootloader: firmware is missing or updating",
    fix: "Field-upgrade the firmware in Phoenix Tuner X.",
    enabled: false,
  },
  damaged: {
    label: "Alternating red and orange",
    pattern: { frames: [["red", "orange"], ["orange", "red"]], periodMs: 400 },
    meaning: "Damaged hardware",
    fix: "Run Self Test in Phoenix Tuner X, then contact CTRE.",
    enabled: false,
  },
};

type TalonCode = keyof typeof TALON;

const ledClass: Record<LedColor, string> = {
  off: "bg-zinc-800 dark:bg-zinc-900",
  red: "bg-red-500 shadow-[0_0_10px_2px] shadow-red-500/70",
  green: "bg-green-500 shadow-[0_0_10px_2px] shadow-green-500/70",
  orange: "bg-orange-500 shadow-[0_0_10px_2px] shadow-orange-500/70",
  blue: "bg-blue-500 shadow-[0_0_10px_2px] shadow-blue-500/70",
  cyan: "bg-cyan-400 shadow-[0_0_10px_2px] shadow-cyan-400/70",
  magenta: "bg-fuchsia-500 shadow-[0_0_10px_2px] shadow-fuchsia-500/70",
  yellow: "bg-yellow-400 shadow-[0_0_10px_2px] shadow-yellow-400/70",
};

function useBlink(periodMs: number) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setFrame((current) => (current === 0 ? 1 : 0)), periodMs);

    return () => window.clearInterval(timer);
  }, [periodMs]);

  return frame;
}

function Led({ color, size = "size-4" }: { color: LedColor; size?: string }) {
  return <span className={cn("inline-block rounded-full border border-black/30 transition-colors duration-75", size, ledClass[color])} />;
}

/** A Talon FX drawn as a dark box with its two status LEDs. */
function TalonFx({ code, label }: { code: TalonCode; label?: string }) {
  const { frames, periodMs } = TALON[code].pattern;
  const frame = useBlink(periodMs);
  const [a, b] = frames[frame];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex h-14 w-20 items-center justify-center gap-3 rounded-md border border-zinc-600 bg-zinc-900 shadow-inner" role="img" aria-label={`${label ?? "Talon FX"}: ${TALON[code].label}`}>
        <Led color={a} />
        <Led color={b} />
      </div>
      {label && <span className="text-xs font-medium">{label}</span>}
    </div>
  );
}

// ---- PDH -----------------------------------------------------------------

type PdhPattern = { frames: [LedColor, LedColor]; periodMs: number };

const PDH_STATUS: Record<string, { label: string; pattern: PdhPattern; meaning: string }> = {
  noComms: { label: "Solid blue", pattern: { frames: ["blue", "blue"], periodMs: 500 }, meaning: "Powered on, but not talking to the robot controller" },
  ok: { label: "Solid green", pattern: { frames: ["green", "green"], periodMs: 500 }, meaning: "Talking to the robot controller. All good." },
  keepAlive: { label: "Blinking magenta", pattern: { frames: ["magenta", "off"], periodMs: 400 }, meaning: "Keep-alive timeout: messages from the controller stopped" },
  hardwareClient: { label: "Solid cyan", pattern: { frames: ["cyan", "cyan"], periodMs: 500 }, meaning: "Connected to the REV Hardware Client" },
  lowBattery: { label: "Blinking orange and blue", pattern: { frames: ["orange", "blue"], periodMs: 400 }, meaning: "Low battery" },
  canFault: { label: "Blinking orange and yellow", pattern: { frames: ["orange", "yellow"], periodMs: 400 }, meaning: "CAN fault" },
  hardwareFault: { label: "Blinking orange and cyan", pattern: { frames: ["orange", "cyan"], periodMs: 400 }, meaning: "Hardware fault" },
  overCurrent: { label: "Blinking orange and magenta", pattern: { frames: ["orange", "magenta"], periodMs: 400 }, meaning: "Total current over the device limit" },
};

type PdhCode = keyof typeof PDH_STATUS;
type ChannelState = "ok" | "tripped" | "sticky";

const CHANNEL: Record<ChannelState, { label: string; meaning: string }> = {
  ok: { label: "Off", meaning: "Channel has voltage. Working normally." },
  tripped: { label: "Solid red", meaning: "No voltage and an active fault: the breaker is tripped or missing." },
  sticky: { label: "Blinking red", meaning: "A sticky fault: the breaker tripped earlier. It stays lit until faults are cleared." },
};

function Pdh({ status, channels }: { status: PdhCode; channels: ChannelState[] }) {
  const { frames, periodMs } = PDH_STATUS[status].pattern;
  const frame = useBlink(periodMs);
  const blinkFrame = useBlink(500);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="rounded-md border border-zinc-600 bg-zinc-900 p-3" role="img" aria-label={`PDH: ${PDH_STATUS[status].label}`}>
        <div className="mb-2 flex items-center justify-between gap-6">
          <span className="text-[10px] font-semibold text-zinc-400">STATUS</span>
          <Led color={frames[frame]} />
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {channels.map((state, index) => (
            <div key={index} className="flex flex-col items-center gap-0.5">
              <Led size="size-2.5" color={state === "tripped" ? "red" : state === "sticky" && blinkFrame === 0 ? "red" : "off"} />
              <span className="text-[9px] text-zinc-400 tabular-nums">{index}</span>
            </div>
          ))}
        </div>
      </div>
      <span className="text-xs font-medium">PDH</span>
    </div>
  );
}

// ---- Chapters ------------------------------------------------------------

function ChapterWhy() {
  const [code, setCode] = useState<TalonCode>("disabledOk");
  const entry = TALON[code];

  return (
    <>
      <p>
        When a robot won't move, the fastest place to look is not the laptop. Every motor controller, the PDH, and the robot controller
        has status lights that tell you three things right away: does it have power, can it talk on CAN, and is it being told to do
        anything.
      </p>
      <p>
        A Talon FX (the controller built into a Kraken) has two LEDs. Whether they blink together, take turns, or stay solid is the code.
        Pick a situation below and watch what the lights do.
      </p>

      <Lab title="Talon FX light explorer" caption="Patterns from CTRE's Talon FX hardware reference. Real blink speeds vary slightly.">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="grid gap-1">
            {(Object.keys(TALON) as TalonCode[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCode(key)}
                aria-pressed={code === key}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                  code === key ? "bg-accent font-semibold" : "hover:bg-accent/60",
                )}
              >
                <span>{TALON[key].meaning}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{TALON[key].enabled ? "Enabled" : "Disabled"}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-6">
            <TalonFx code={code} />
            <p className="max-w-48 text-center text-sm font-semibold">{entry.label}</p>
          </div>
        </div>
        <p className="rounded-md bg-muted/50 p-3 text-sm">
          <span className="font-semibold">What to do: </span>
          {entry.fix}
        </p>
      </Lab>

      <p>
        Notice the pattern in the patterns. Red taking turns means no signal at all. Orange taking turns means the wiring is fine but
        no code is running. Orange blinking together is the one you want to see on a disabled robot.
      </p>
      <Takeaway>Taking turns means a problem upstream. Blinking together means the device is healthy and waiting.</Takeaway>
    </>
  );
}

const QUIZ_CODES: TalonCode[] = ["noCan", "noPhoenix", "disabledOk", "neutral", "forward", "reverse", "thermal", "off", "limit"];

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }

  return copy;
}

function newRound(previous?: TalonCode) {
  const pool = QUIZ_CODES.filter((code) => code !== previous);
  const answer = pool[Math.floor(Math.random() * pool.length)];
  const options = shuffle([answer, ...shuffle(QUIZ_CODES.filter((code) => code !== answer)).slice(0, 3)]);

  return { answer, options };
}

function ChapterNameThatBlink() {
  const [round, setRound] = useState(() => newRound());
  const [picked, setPicked] = useState<TalonCode | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const correct = picked === round.answer;

  function pick(code: TalonCode) {
    if (picked) {
      return;
    }

    setPicked(code);

    if (code === round.answer) {
      setStreak((current) => {
        const next = current + 1;
        setBest((value) => Math.max(value, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  }

  function next() {
    setRound(newRound(round.answer));
    setPicked(null);
  }

  return (
    <>
      <p>
        At competition you won't have a chart. Practice until you can name a code from across the pit. You'll see one Talon FX; pick what
        its lights mean.
      </p>

      <Lab title="Name that blink">
        <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-6">
          <TalonFx code={round.answer} key={round.answer + String(streak)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {round.options.map((code) => {
            const isAnswer = code === round.answer;

            return (
              <Button
                key={code}
                type="button"
                variant="outline"
                className={cn(
                  "h-auto justify-start py-2.5 text-left whitespace-normal",
                  picked && isAnswer && "border-success bg-emerald-50 text-foreground dark:bg-emerald-950/40",
                  picked === code && !isAnswer && "animate-shake border-destructive bg-rose-50 dark:bg-rose-950/40",
                )}
                onClick={() => pick(code)}
                disabled={!!picked && !isAnswer && picked !== code}
              >
                {TALON[code].meaning}
              </Button>
            );
          })}
        </div>
        {picked && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3 text-sm" aria-live="polite">
            <p>
              <span className={cn("font-semibold", correct ? "text-success" : "text-destructive")}>{correct ? "Right. " : "Not quite. "}</span>
              {TALON[round.answer].label}: {TALON[round.answer].meaning.toLowerCase()}.
            </p>
            <Button type="button" variant="cta" size="sm" onClick={next}>
              Next light
            </Button>
          </div>
        )}
        <Goals goals={[{ label: `Name 5 in a row (streak ${streak}, best ${best})`, met: best >= 5 }]} />
      </Lab>
      <Takeaway>Learn the four you'll see most: alternating red, alternating orange, orange together, and solid orange.</Takeaway>
    </>
  );
}

function ChapterPdh() {
  const [status, setStatus] = useState<PdhCode>("ok");
  const [channels, setChannels] = useState<ChannelState[]>(() => Array.from({ length: 12 }, () => "ok"));

  function cycle(index: number) {
    const order: ChannelState[] = ["ok", "tripped", "sticky"];
    setChannels((current) => current.map((state, i) => (i === index ? order[(order.indexOf(state) + 1) % order.length] : state)));
  }

  return (
    <>
      <p>
        The Power Distribution Hub (PDH) feeds every motor controller through its own breaker. It has one status LED for the whole
        device and a small LED for each channel. A channel LED lights red when that channel has lost power, which points you straight
        at a tripped or missing breaker.
      </p>

      <Lab title="PDH light explorer" caption="Patterns from REV's PDH status LED reference (firmware 21.1.7 and later). The real PDH has 24 channels; 12 are shown.">
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <div className="flex justify-center rounded-lg bg-muted/50 p-5">
            <Pdh status={status} channels={channels} />
          </div>
          <div className="grid gap-1">
            {(Object.keys(PDH_STATUS) as PdhCode[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                aria-pressed={status === key}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                  status === key ? "bg-accent font-semibold" : "hover:bg-accent/60",
                )}
              >
                <span>{PDH_STATUS[key].meaning}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{PDH_STATUS[key].label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Click a channel to change it</p>
          <div className="flex flex-wrap gap-1">
            {channels.map((state, index) => (
              <Button key={index} type="button" size="sm" variant={state === "ok" ? "outline" : "destructive"} onClick={() => cycle(index)} className="w-12 tabular-nums">
                {index}
              </Button>
            ))}
          </div>
          <ul className="grid gap-1 text-sm">
            {(Object.keys(CHANNEL) as ChannelState[]).map((key) => (
              <li key={key}>
                <span className="font-semibold">{CHANNEL[key].label}:</span> {CHANNEL[key].meaning}
              </li>
            ))}
          </ul>
        </div>
      </Lab>
      <Takeaway>A red channel LED on the PDH means look at that channel's breaker before anything else.</Takeaway>
    </>
  );
}

type DeviceId = "pdh" | "t1" | "t2" | "t3" | "t4";

type Scenario = {
  id: string;
  cause: string;
  robotEnabled: boolean;
  pdh: PdhCode;
  channels: ChannelState[];
  talons: Record<Exclude<DeviceId, "pdh">, TalonCode>;
  explain: string;
};

const baseChannels = (): ChannelState[] => Array.from({ length: 12 }, () => "ok");

const SCENARIOS: Scenario[] = [
  {
    id: "can-break",
    cause: "A CAN wire is broken between motor 2 and motor 3",
    robotEnabled: false,
    pdh: "ok",
    channels: baseChannels(),
    talons: { t1: "disabledOk", t2: "disabledOk", t3: "noCan", t4: "noCan" },
    explain: "Motors 1–2 are healthy but 3 and 4 have no CAN signal. Everything past the break goes dark on CAN, so the fault is between 2 and 3.",
  },
  {
    id: "no-code",
    cause: "No robot code using Phoenix is running",
    robotEnabled: false,
    pdh: "ok",
    channels: baseChannels(),
    talons: { t1: "noPhoenix", t2: "noPhoenix", t3: "noPhoenix", t4: "noPhoenix" },
    explain: "Every Talon takes turns in orange: CAN reaches all of them, but no Phoenix program is running. Deploy the code.",
  },
  {
    id: "breaker",
    cause: "Motor 3's breaker is tripped or missing",
    robotEnabled: false,
    pdh: "ok",
    channels: baseChannels().map((state, index) => (index === 3 ? "tripped" : state)),
    talons: { t1: "disabledOk", t2: "disabledOk", t3: "off", t4: "disabledOk" },
    explain: "Motor 3 is completely dark and PDH channel 3 is solid red. No voltage on that channel: check its breaker.",
  },
  {
    id: "thermal",
    cause: "Motor 4 overheated",
    robotEnabled: true,
    pdh: "ok",
    channels: baseChannels(),
    talons: { t1: "forward", t2: "forward", t3: "forward", t4: "thermal" },
    explain: "The robot is enabled and three motors drive forward, but motor 4 shows one side orange: thermal cutoff. Find out why it is working so hard.",
  },
  {
    id: "low-battery",
    cause: "The battery is low",
    robotEnabled: false,
    pdh: "lowBattery",
    channels: baseChannels(),
    talons: { t1: "disabledOk", t2: "disabledOk", t3: "disabledOk", t4: "disabledOk" },
    explain: "Every motor is healthy, but the PDH blinks orange and blue: low battery. Swap it before the match.",
  },
  {
    id: "limit",
    cause: "Motor 2 is held by a limit switch",
    robotEnabled: true,
    pdh: "ok",
    channels: baseChannels(),
    talons: { t1: "neutral", t2: "limit", t3: "neutral", t4: "neutral" },
    explain: "The robot is enabled and the others sit at neutral, but motor 2 shows one side red: a limit is stopping it. Check that switch.",
  },
];

function pickScenario(previous?: string) {
  const pool = SCENARIOS.filter((scenario) => scenario.id !== previous);
  const scenario = pool[Math.floor(Math.random() * pool.length)];

  return { scenario, options: shuffle(SCENARIOS.map((item) => ({ id: item.id, cause: item.cause }))) };
}

function ChapterFindFault() {
  const [round, setRound] = useState(() => pickScenario());
  const { scenario, options } = round;
  const [picked, setPicked] = useState<string | null>(null);
  const [solved, setSolved] = useState<Set<string>>(() => new Set());
  const correct = picked === scenario.id;

  function pick(id: string) {
    if (picked) {
      return;
    }

    setPicked(id);

    if (id === scenario.id) {
      setSolved((current) => new Set(current).add(id));
    }
  }

  function next() {
    setRound(pickScenario(scenario.id));
    setPicked(null);
  }

  return (
    <>
      <p>
        Here is a practice board: a PDH and four Talon FX motor controllers on one CAN chain, in order from the robot controller. Something
        is wrong. Read the lights, then pick the cause.
      </p>

      <Lab title="Find the fault">
        <div className="space-y-3 rounded-lg bg-muted/50 p-5">
          <p className="text-sm">
            Robot is <span className="font-semibold">{scenario.robotEnabled ? "enabled and driving forward" : "disabled"}</span>
          </p>
          <div className="flex flex-wrap items-end justify-center gap-6">
            <Pdh status={scenario.pdh} channels={scenario.channels} />
            <div className="flex flex-wrap items-end gap-4">
              {(["t1", "t2", "t3", "t4"] as const).map((id, index) => (
                <TalonFx key={id + scenario.id} code={scenario.talons[id]} label={`Motor ${index + 1} · ch ${index + 1}`} />
              ))}
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">CAN: controller → PDH → motor 1 → motor 2 → motor 3 → motor 4</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const isAnswer = option.id === scenario.id;

            return (
              <Button
                key={option.id}
                type="button"
                variant="outline"
                className={cn(
                  "h-auto justify-start py-2.5 text-left whitespace-normal",
                  picked && isAnswer && "border-success bg-emerald-50 text-foreground dark:bg-emerald-950/40",
                  picked === option.id && !isAnswer && "animate-shake border-destructive bg-rose-50 dark:bg-rose-950/40",
                )}
                onClick={() => pick(option.id)}
              >
                {option.cause}
              </Button>
            );
          })}
        </div>
        {picked && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3 text-sm" aria-live="polite">
            <p className="min-w-0 flex-1">
              <span className={cn("font-semibold", correct ? "text-success" : "text-destructive")}>{correct ? "Found it. " : "Not this time. "}</span>
              {scenario.explain}
            </p>
            <Button type="button" variant="cta" size="sm" onClick={next}>
              <RotateCcw />
              New fault
            </Button>
          </div>
        )}
        <Goals goals={[{ label: `Diagnose 4 different faults (${solved.size} of 4)`, met: solved.size >= 4 }]} />
      </Lab>
      <Takeaway>Read the whole board before touching anything. Where the lights change along the chain is where the problem is.</Takeaway>
    </>
  );
}

function ChapterDocs() {
  return (
    <>
      <p>
        Light codes change. Vendors update firmware, new devices arrive, and in 2027 the robot controller itself changes to Systemcore,
        with its own lights. Memorize the common Talon FX and PDH codes, but always confirm in the vendor's reference.
      </p>
      <p>Two habits make lights much more useful:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <span className="font-semibold">Mixed or flickering patterns</span> usually mean a device is switching between two codes. The
          most common cause is a loose CAN connection that keeps dropping in and out.
        </li>
        <li>
          <span className="font-semibold">Check lights disabled first, then enabled.</span> Disabled tells you about power, CAN, and code.
          Enabled tells you about direction, limits, and heat.
        </li>
      </ul>
      <ul className="grid gap-2 sm:grid-cols-2">
        {[
          { title: "Talon FX status lights", source: "CTRE", url: "https://v6.docs.ctr-electronics.com/en/stable/docs/hardware-reference/talonfx/" },
          { title: "PDH status LED patterns", source: "REV", url: "https://docs.revrobotics.com/ion-control/pdh/status-led" },
          { title: "Status Light Quick Reference", source: "WPILib", url: "https://docs.wpilib.org/en/latest/docs/hardware/hardware-basics/status-lights-ref.html" },
          { title: "Systemcore introduction", source: "WPILib", url: "https://docs.wpilib.org/en/latest/docs/software/systemcore-info/systemcore-introduction.html" },
        ].map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent"
            >
              <span>
                <span className="block font-medium">{link.title}</span>
                <span className="text-xs text-muted-foreground">{link.source}</span>
              </span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <Takeaway>Lights narrow it down; the vendor docs confirm it. Bookmark these on the pit laptop.</Takeaway>
    </>
  );
}

export function ReadLightsLessonPage() {
  return (
    <LessonShell
      title="Read the lights"
      chapters={[
        { id: "talon", title: "Lights before laptops", minutes: 6, render: () => <ChapterWhy /> },
        { id: "practice", title: "Name that blink", minutes: 5, render: () => <ChapterNameThatBlink /> },
        { id: "pdh", title: "The Power Distribution Hub", minutes: 5, render: () => <ChapterPdh /> },
        { id: "fault", title: "Find the fault", minutes: 8, render: () => <ChapterFindFault /> },
        { id: "docs", title: "When the lights don't match", minutes: 3, render: () => <ChapterDocs /> },
        { id: "check", title: "Check your understanding", minutes: 4, render: () => <SkillCheckChapter seedKey="elec-read-lights" /> },
      ]}
    />
  );
}
