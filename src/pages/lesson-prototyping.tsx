import { Check, Copy, Play, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Choice, Goals, Lab, LineChart, Readouts, Slider, Takeaway } from "@/components/learning/lab-ui";
import { LessonShell, SkillCheckChapter, Sorter } from "@/components/learning/lesson-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/*
 * A pretend intake prototype. The true success rate is hidden from students;
 * every trial is a coin flip against it, so results are noisy like real testing.
 */

type Wheel = "stealth" | "compliant" | "flex";

const WHEELS: Record<Wheel, { label: string; best: number; peak: number }> = {
  stealth: { label: "Stealth wheels", best: 0.45, peak: 0.86 },
  compliant: { label: "Compliant wheels", best: 0.75, peak: 0.94 },
  flex: { label: "Flex wheels", best: 0.6, peak: 0.9 },
};

type Setup = { wheel: Wheel; compression: number; speed: number };

function trueRate({ wheel, compression, speed }: Setup) {
  const { best, peak } = WHEELS[wheel];
  const grip = Math.exp(-(((compression - best) / 0.32) ** 2));
  const speedFit = Math.max(0, 1 - ((speed - 65) / 55) ** 2);

  return Math.min(0.98, Math.max(0.02, peak * grip * (0.35 + 0.65 * speedFit)));
}

function runTrials(rate: number, count: number) {
  let made = 0;

  for (let i = 0; i < count; i += 1) {
    if (Math.random() < rate) {
      made += 1;
    }
  }

  return made;
}

const fmtIn = (value: number) => `${value.toFixed(2)} in`;
const pct = (value: number) => `${Math.round(value * 100)}%`;

// ---- Chapter 1 -----------------------------------------------------------

type QuestionKind = "good" | "vague" | "notTest";

function ChapterQuestion() {
  return (
    <>
      <p>
        A prototype is an experiment, not a first draft of the robot. It exists to answer one question you can't answer on paper. If you
        can't say what the question is, you aren't ready to cut material.
      </p>
      <p>
        A good prototype question names one thing you'll change and one thing you'll measure. Sort each question below.
      </p>
      <Lab title="Is it a prototype question?">
        <Sorter<QuestionKind>
          buckets={[
            { value: "good", label: "Good question" },
            { value: "vague", label: "Too vague" },
            { value: "notTest", label: "Doesn't need a prototype" },
          ]}
          items={[
            {
              text: "How much compression lets our intake grab the game piece most reliably?",
              answer: "good",
              why: "One variable (compression) and one measurement (how often it grabs).",
            },
            { text: "Will our intake work?", answer: "vague", why: "Work how? Nothing is being changed or measured." },
            {
              text: "What gear ratio does the elevator need to reach the top in under a second?",
              answer: "notTest",
              why: "You can calculate this. Use a calculator like ReCalc first and save prototype time for things math can't answer.",
            },
            {
              text: "Does a 2 in or a 4 in wheel launch the piece farther at the same speed?",
              answer: "good",
              why: "One variable (wheel size), one measurement (distance), everything else held the same.",
            },
            { text: "Can we make the shooter better?", answer: "vague", why: "Better at what? Pick one measurable thing: range, accuracy, or cycle time." },
            {
              text: "Which polycarbonate thickness survives 20 hits against the wall?",
              answer: "good",
              why: "One variable (thickness) and a clear pass/fail test.",
            },
          ]}
        />
      </Lab>
      <Takeaway>One prototype, one question. Change one thing, measure one thing.</Takeaway>
    </>
  );
}

// ---- Chapter 2 -----------------------------------------------------------

type Run = { setup: Setup; made: number; trials: number; changed: string[] };

function diff(a: Setup, b: Setup) {
  const changed: string[] = [];

  if (a.wheel !== b.wheel) changed.push("wheel");
  if (Math.abs(a.compression - b.compression) > 0.001) changed.push("compression");
  if (a.speed !== b.speed) changed.push("speed");

  return changed;
}

function ChapterOneVariable() {
  const [setup, setSetup] = useState<Setup>({ wheel: "stealth", compression: 0.25, speed: 50 });
  const [runs, setRuns] = useState<Run[]>([]);
  const last = runs.at(-1);
  const pending = last ? diff(last.setup, setup) : [];
  const fairRuns = runs.filter((run) => run.changed.length <= 1);
  const bestFair = fairRuns.reduce<Run | null>((best, run) => (!best || run.made > best.made ? run : best), null);
  const cleanSweep = runs.length >= 4 && runs.slice(1).every((run) => run.changed.length === 1 && run.changed[0] === "compression");
  const foundGood = !!bestFair && bestFair.made / bestFair.trials >= 0.8;

  function run() {
    const trials = 10;
    const made = runTrials(trueRate(setup), trials);
    setRuns((current) => [...current, { setup, made, trials, changed: last ? diff(last.setup, setup) : [] }]);
  }

  return (
    <>
      <p>
        Here's a test intake. You can change the wheel type, how much the wheels squeeze the game piece (compression), and roller speed.
        Each run feeds 10 game pieces and counts how many it grabs.
      </p>
      <p>
        The trap: if you change two things between runs and the result improves, you can't tell which change did it. Scientists call that
        a confounded result.
      </p>

      <Lab title="Intake test rig" caption="The rig's real behavior is hidden, and every run is a little random, just like real testing.">
        <div className="grid gap-5 md:grid-cols-3">
          <Choice<Wheel>
            label="Wheel"
            value={setup.wheel}
            options={(Object.keys(WHEELS) as Wheel[]).map((value) => ({ value, label: WHEELS[value].label.replace(" wheels", "") }))}
            onChange={(wheel) => setSetup((current) => ({ ...current, wheel }))}
          />
          <Slider
            id="proto-compression"
            label="Compression"
            value={setup.compression}
            min={0}
            max={1.25}
            step={0.125}
            format={fmtIn}
            onChange={(compression) => setSetup((current) => ({ ...current, compression }))}
          />
          <Slider
            id="proto-speed"
            label="Roller speed"
            value={setup.speed}
            min={20}
            max={100}
            step={10}
            format={(value) => `${value}%`}
            onChange={(speed) => setSetup((current) => ({ ...current, speed }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="cta" onClick={run}>
            <Play />
            Run 10 trials
          </Button>
          {runs.length > 0 && (
            <Button type="button" variant="ghost" onClick={() => setRuns([])}>
              <RotateCcw />
              Clear log
            </Button>
          )}
          {pending.length > 1 && (
            <p className="animate-rise text-sm text-warning" aria-live="polite">
              You've changed {pending.join(" and ")} since the last run. This next result will be confounded.
            </p>
          )}
        </div>

        {runs.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Run</th>
                  <th className="px-3 py-2 font-medium">Wheel</th>
                  <th className="px-3 py-2 font-medium">Compression</th>
                  <th className="px-3 py-2 font-medium">Speed</th>
                  <th className="px-3 py-2 font-medium">Grabbed</th>
                  <th className="px-3 py-2 font-medium">Changed</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((item, index) => (
                  <tr key={index} className={cn("border-t", index === runs.length - 1 && "animate-rise")}>
                    <td className="px-3 py-2 tabular-nums">{index + 1}</td>
                    <td className="px-3 py-2">{WHEELS[item.setup.wheel].label.replace(" wheels", "")}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtIn(item.setup.compression)}</td>
                    <td className="px-3 py-2 tabular-nums">{item.setup.speed}%</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      {item.made} / {item.trials}
                    </td>
                    <td className={cn("px-3 py-2", item.changed.length > 1 && "font-medium text-warning")}>
                      {index === 0 ? "Baseline" : item.changed.length === 0 ? "Nothing (repeat)" : item.changed.join(", ")}
                      {item.changed.length > 1 && " · confounded"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Goals
          goals={[
            { label: "Sweep compression: 4 or more runs where only compression changes", met: cleanSweep },
            { label: "Find a setup that grabs 8 or more out of 10 using fair runs", met: foundGood },
          ]}
        />
      </Lab>
      <Takeaway>Change one variable per run. A repeat run with nothing changed is useful too: it shows you how noisy the test is.</Takeaway>
    </>
  );
}

// ---- Chapter 3 -----------------------------------------------------------

function ChapterTrials() {
  const [trials, setTrials] = useState(3);
  const [result, setResult] = useState<{ trials: number; right: number; wrong: number; ties: number } | null>(null);
  const rateA = 0.7;
  const rateB = 0.8;

  function simulate() {
    let right = 0;
    let wrong = 0;
    let ties = 0;

    for (let i = 0; i < 1000; i += 1) {
      const a = runTrials(rateA, trials);
      const b = runTrials(rateB, trials);

      if (b > a) right += 1;
      else if (a > b) wrong += 1;
      else ties += 1;
    }

    setResult({ trials, right, wrong, ties });
  }

  const sweep = [1, 3, 5, 10, 20, 40].map((n) => {
    // Exact probability that B beats A with n trials each (binomial).
    const pmf = (rate: number) => {
      const out: number[] = [];
      let coef = 1;

      for (let k = 0; k <= n; k += 1) {
        out.push(coef * rate ** k * (1 - rate) ** (n - k));
        coef = (coef * (n - k)) / (k + 1);
      }

      return out;
    };
    const a = pmf(rateA);
    const b = pmf(rateB);
    let win = 0;

    for (let i = 0; i <= n; i += 1) {
      for (let j = i + 1; j <= n; j += 1) {
        win += a[i] * b[j];
      }
    }

    return { x: n, y: win * 100 };
  });

  return (
    <>
      <p>
        Two intake setups: setup A really grabs 70% of the time and setup B really grabs 80%. B is better. But you don't get to see those
        numbers; you only see your trials. How many trials do you need before the test reliably tells you B is better?
      </p>

      <Lab title="How many trials is enough?">
        <Slider id="trials-n" label="Trials per setup" value={trials} min={1} max={40} onChange={setTrials} />
        <Button type="button" variant="cta" onClick={simulate}>
          <Play />
          Run the comparison 1,000 times
        </Button>
        {result && (
          <div key={`${result.trials}-${result.right}`} className="animate-rise">
            <Readouts
              items={[
                { label: "Picked B (right)", value: pct(result.right / 1000), tone: result.right / 1000 >= 0.8 ? "good" : "warn" },
                { label: "Picked A (wrong)", value: pct(result.wrong / 1000), tone: result.wrong / 1000 > 0.15 ? "bad" : "neutral" },
                { label: "Tie, can't tell", value: pct(result.ties / 1000) },
                { label: "Trials each", value: String(result.trials) },
              ]}
            />
          </div>
        )}
        <LineChart
          ariaLabel="Chance the test correctly shows B is better, by trials per setup"
          xLabel="Trials per setup"
          yLabel="Shows B wins (%)"
          xDomain={[0, 40]}
          yDomain={[0, 100]}
          series={[{ label: "Chance the test shows B is better", points: sweep, strokeClass: "stroke-primary" }]}
          vLine={{ x: trials, label: `${trials} trials` }}
        />
        <Goals
          goals={[
            { label: "Try 1 trial and see how often the test gets it wrong", met: result?.trials === 1 },
            { label: "Find a trial count where B wins at least 80% of the time", met: !!result && result.right / 1000 >= 0.8 },
          ]}
        />
      </Lab>
      <p>
        With one trial each, you pick the wrong setup surprisingly often. Small differences need many trials. Big differences (say 30%
        versus 90%) show up with just a few.
      </p>
      <Takeaway>Run at least 5 trials per setting, more when the setups are close. Record every trial, even the weird ones.</Takeaway>
    </>
  );
}

// ---- Chapter 4 -----------------------------------------------------------

const DATA: { x: number; made: number }[] = [
  { x: 0.25, made: 4 },
  { x: 0.5, made: 11 },
  { x: 0.75, made: 18 },
  { x: 1.0, made: 17 },
  { x: 1.25, made: 9 },
];

type Verdict = "supported" | "notSupported";

function ChapterDecide() {
  const [pick, setPick] = useState<number | null>(null);
  const good = pick === 0.75 || pick === 1.0;

  return (
    <>
      <p>
        A team tested compliant wheels at five compression settings, 20 trials each, with everything else held the same. Here's their
        data.
      </p>
      <Lab title="From data to decision">
        <LineChart
          ariaLabel="Success rate by compression"
          xLabel="Compression (in)"
          yLabel="Grabbed (%)"
          xDomain={[0, 1.5]}
          yDomain={[0, 100]}
          series={[{ label: "Grabbed out of 20", points: DATA.map((row) => ({ x: row.x, y: (row.made / 20) * 100 })), strokeClass: "stroke-primary" }]}
          marker={pick !== null ? { x: pick, y: ((DATA.find((row) => row.x === pick)?.made ?? 0) / 20) * 100, label: "Your pick" } : undefined}
        />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Which compression should go on the robot?</legend>
          <div className="flex flex-wrap gap-2">
            {DATA.map((row) => (
              <Button key={row.x} type="button" size="sm" variant={pick === row.x ? "default" : "outline"} onClick={() => setPick(row.x)}>
                {fmtIn(row.x)} · {row.made}/20
              </Button>
            ))}
          </div>
        </fieldset>
        {pick !== null && (
          <p key={pick} className={cn("text-sm", good ? "animate-rise" : "animate-shake")} aria-live="polite">
            <span className={cn("font-semibold", good ? "text-success" : "text-destructive")}>{good ? "Good call. " : "Look again. "}</span>
            {good
              ? "0.75 and 1.0 in are within one trial of each other, so the data can't separate them. Pick one, then build in adjustment around it. Many teams lean toward the lower one because it puts less load on the motor."
              : "The 0.75 to 1.0 in range clearly beats the rest. Choose from that range."}
          </p>
        )}
      </Lab>

      <p>Now decide which conclusions this data actually supports.</p>
      <Lab title="What can you claim?">
        <Sorter<Verdict>
          buckets={[
            { value: "supported", label: "Supported" },
            { value: "notSupported", label: "Not supported" },
          ]}
          items={[
            { text: "Around 0.75–1.0 in of compression works best for these wheels.", answer: "supported", why: "Both settings clearly beat the others." },
            { text: "1.0 in is better than 0.75 in.", answer: "notSupported", why: "18 versus 17 out of 20 is well within normal noise." },
            {
              text: "Compliant wheels are better than stealth wheels.",
              answer: "notSupported",
              why: "Stealth wheels weren't tested. Only compression changed.",
            },
            {
              text: "Too much compression hurts, not just too little.",
              answer: "supported",
              why: "Success drops from 17 to 9 between 1.0 and 1.25 in.",
            },
            {
              text: "This intake will grab 90% of the time in a match.",
              answer: "notSupported",
              why: "Bench tests are friendlier than matches: pieces arrive at odd angles while the robot is moving. Test that separately.",
            },
          ]}
        />
      </Lab>
      <Takeaway>Your conclusion can only be as big as your test. Say what the data shows, and what it doesn't.</Takeaway>
    </>
  );
}

// ---- Chapter 5 -----------------------------------------------------------

const CARD_FIELDS = [
  { key: "question", label: "Question", placeholder: "What compression grabs the game piece most reliably?" },
  { key: "variable", label: "What we change (one thing)", placeholder: "Compression: 0.25, 0.5, 0.75, 1.0, 1.25 in" },
  { key: "same", label: "What stays the same", placeholder: "Wheel type, roller speed, motor, how the piece is fed" },
  { key: "measure", label: "What we measure", placeholder: "Pieces grabbed out of 10 at each setting" },
  { key: "success", label: "What counts as success", placeholder: "At least 9 out of 10" },
] as const;

type CardKey = (typeof CARD_FIELDS)[number]["key"];

function ChapterTestCard() {
  const [card, setCard] = useState<Record<CardKey, string>>({ question: "", variable: "", same: "", measure: "", success: "" });
  const [copied, setCopied] = useState(false);
  const filled = CARD_FIELDS.filter((field) => card[field.key].trim().length > 0).length;

  async function copy() {
    const text = [
      "PROTOTYPE TEST CARD",
      ...CARD_FIELDS.map((field) => `${field.label}: ${card[field.key].trim() || "—"}`),
      "",
      "Results (one row per setting):",
      "Setting | Trials | Successes | Notes",
      "",
      "Decision:",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <p>
        Before anyone cuts material, fill in a test card. It takes five minutes and keeps the whole group testing the same thing. Write
        one for a prototype you might actually build this season. The examples are greyed out in each box.
      </p>
      <Lab title="Prototype test card" caption="Nothing here is saved. Copy it into your notebook or team doc when you're done.">
        <div className="grid gap-4">
          {CARD_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label htmlFor={`card-${field.key}`} className="text-sm font-medium">
                {field.label}
              </label>
              {field.key === "question" ? (
                <Textarea
                  id={`card-${field.key}`}
                  rows={2}
                  value={card[field.key]}
                  placeholder={field.placeholder}
                  onChange={(event) => setCard((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              ) : (
                <Input
                  id={`card-${field.key}`}
                  value={card[field.key]}
                  placeholder={field.placeholder}
                  onChange={(event) => setCard((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="cta" onClick={copy} disabled={filled === 0}>
            {copied ? <Check className="animate-pop" /> : <Copy />}
            {copied ? "Copied" : "Copy test card"}
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">{filled} of 5 filled in</span>
        </div>
      </Lab>
      <p>
        When the test is done, add a results table and one sentence of decision: what you'll build, and what you still don't know. Then
        show it to a mentor. Planning and reporting a test card are mentor-checked skills in Learning.
      </p>
      <Takeaway>Question, variable, what stays the same, measurement, success. Write them down before you build.</Takeaway>
    </>
  );
}

export function PrototypingLessonPage() {
  return (
    <LessonShell
      title="Prototype like a scientist"
      chapters={[
        { id: "question", title: "Start with a question", minutes: 5, render: () => <ChapterQuestion /> },
        { id: "variable", title: "Change one thing at a time", minutes: 8, render: () => <ChapterOneVariable /> },
        { id: "trials", title: "How many trials is enough?", minutes: 6, render: () => <ChapterTrials /> },
        { id: "decide", title: "From data to decision", minutes: 6, render: () => <ChapterDecide /> },
        { id: "card", title: "Write a test card", minutes: 6, render: () => <ChapterTestCard /> },
        { id: "check", title: "Check your understanding", minutes: 4, render: () => <SkillCheckChapter seedKey="mech-run-trials" /> },
      ]}
    />
  );
}
