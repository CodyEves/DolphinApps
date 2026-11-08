import { useState } from "react";

import { Choice, Goals, Lab, Readouts, Slider, Takeaway } from "@/components/learning/lab-ui";
import { LessonShell, SkillCheckChapter, Sorter } from "@/components/learning/lesson-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * "Tide Turn" is a made-up game so students can practise kickoff analysis
 * without spoiling (or guessing at) the real 2027 game.
 */

const AUTO_S = 15;
const TELEOP_S = 135;

type ActionKey = "leave" | "autoPiece" | "low" | "high" | "buoy" | "hang";

const ACTIONS: Record<ActionKey, { label: string; points: number; seconds: number; when: string; repeat: boolean }> = {
  leave: { label: "Leave the starting zone in auto", points: 3, seconds: 2, when: "Auto", repeat: false },
  autoPiece: { label: "Score the preloaded shell in auto", points: 6, seconds: 4, when: "Auto", repeat: false },
  low: { label: "Drop a shell in the low tray", points: 2, seconds: 6, when: "Teleop", repeat: true },
  high: { label: "Shoot a shell into the high net", points: 5, seconds: 11, when: "Teleop", repeat: true },
  buoy: { label: "Push a buoy across the line", points: 4, seconds: 14, when: "Teleop", repeat: true },
  hang: { label: "Hang from the low rung", points: 12, seconds: 8, when: "Endgame", repeat: false },
};

function ChapterRules() {
  return (
    <>
      <p>
        On Kickoff day the game manual drops and every team has the same few hours to understand it. The teams that do best don't jump
        to robot ideas. They first figure out exactly how points are scored and how long each one takes.
      </p>
      <p>
        To practise, here is a made-up game called <span className="font-semibold">Tide Turn</span>. Read the scoring table as if it were the
        real manual. You'll use it for the rest of the lesson.
      </p>
      <Lab title="Tide Turn scoring" caption={`Matches have a ${AUTO_S} s autonomous period, then ${TELEOP_S} s of teleop. The last 20 s of teleop are the endgame.`}>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 text-right font-medium">Points</th>
                <th className="px-3 py-2 text-right font-medium">Time for a typical robot</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(ACTIONS) as ActionKey[]).map((key) => (
                <tr key={key} className="border-t">
                  <td className="px-3 py-2">{ACTIONS[key].label}</td>
                  <td className="px-3 py-2">{ACTIONS[key].when}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ACTIONS[key].points}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {ACTIONS[key].seconds} s{ACTIONS[key].repeat ? " per cycle" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Lab>
      <p>
        Before going on, write a one-paragraph game summary in your own words: how a match starts, what scores, and how it ends. If you
        can't explain the game in a paragraph, you don't understand it well enough to design for it yet.
      </p>
      <Takeaway>Read the scoring rules twice before anyone says the word "mechanism."</Takeaway>
    </>
  );
}

function ChapterRank() {
  const [order, setOrder] = useState<ActionKey[]>([]);
  const repeatable: ActionKey[] = ["low", "high", "buoy"];
  const pps = (key: ActionKey) => ACTIONS[key].points / ACTIONS[key].seconds;
  const correctOrder = [...repeatable].sort((a, b) => pps(b) - pps(a));
  const done = order.length === repeatable.length;
  const correct = done && order.every((key, index) => key === correctOrder[index]);

  function pick(key: ActionKey) {
    if (order.includes(key) || done) {
      return;
    }

    setOrder((current) => [...current, key]);
  }

  return (
    <>
      <p>
        The number that matters for anything you can repeat is <span className="font-semibold">points per second</span>: points divided by
        the seconds it takes, including driving to get the next game piece. A big number of points can be a trap if it takes forever.
      </p>
      <Lab title="Rank the teleop actions">
        <p className="text-sm">Click the three repeatable actions from most points per second to least. Do the math first.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {repeatable.map((key) => {
            const position = order.indexOf(key);

            return (
              <Button
                key={key}
                type="button"
                variant={position >= 0 ? "default" : "outline"}
                className="h-auto flex-col items-start gap-1 py-3 text-left whitespace-normal"
                onClick={() => pick(key)}
              >
                <span className="text-xs opacity-80">{position >= 0 ? `Rank ${position + 1}` : "Not ranked"}</span>
                <span className="font-semibold">{ACTIONS[key].label}</span>
                <span className="text-xs opacity-80 tabular-nums">
                  {ACTIONS[key].points} pts · {ACTIONS[key].seconds} s
                </span>
              </Button>
            );
          })}
        </div>
        {done && (
          <div key={order.join()} className={cn("space-y-3", correct ? "animate-rise" : "animate-shake")} aria-live="polite">
            <p className="text-sm">
              <span className={cn("font-semibold", correct ? "text-success" : "text-destructive")}>{correct ? "Right. " : "Not quite. "}</span>
              The high net earns {pps("high").toFixed(2)} points per second, the low tray {pps("low").toFixed(2)}, and buoys only{" "}
              {pps("buoy").toFixed(2)}. Buoys are worth twice as much as a low shell but take more than twice as long.
            </p>
            <Readouts
              items={correctOrder.map((key) => ({ label: ACTIONS[key].label.split(" ").slice(0, 4).join(" "), value: `${pps(key).toFixed(2)} pts/s` }))}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setOrder([])}>
              Try again
            </Button>
          </div>
        )}
      </Lab>
      <p>
        One-time actions like the hang work differently. Hanging is 12 points for 8 seconds, or 1.5 points per second, far better than
        anything else. But you only get to do it once, and it needs its own mechanism.
      </p>
      <Takeaway>For repeatable actions, rank by points per second. For one-time actions, ask what you give up to do them.</Takeaway>
    </>
  );
}

type Shell = "low" | "high" | "none";

function ChapterEstimate() {
  const [shell, setShell] = useState<Shell>("high");
  const [cycle, setCycle] = useState(11);
  const [accuracy, setAccuracy] = useState(85);
  const [hang, setHang] = useState(true);
  const [hangSuccess, setHangSuccess] = useState(80);
  const [autoScore, setAutoScore] = useState(true);

  const points = shell === "none" ? 0 : ACTIONS[shell].points;
  const hit = shell === "low" ? 0.97 : accuracy / 100;
  const teleopTime = TELEOP_S - (hang ? ACTIONS.hang.seconds + 2 : 0);
  const cycles = shell === "none" ? 0 : Math.floor(teleopTime / cycle);
  const autoPts = ACTIONS.leave.points + (autoScore ? ACTIONS.autoPiece.points * 0.85 : 0);
  const teleopPts = cycles * points * hit;
  const endPts = hang ? ACTIONS.hang.points * (hangSuccess / 100) : 0;
  const total = autoPts + teleopPts + endPts;

  // Same robot speed and hang plan, but dropping into the low tray instead.
  const lowCycles = Math.floor(teleopTime / Math.max(4, cycle - 5));
  const lowTotal = autoPts + lowCycles * ACTIONS.low.points * 0.97 + endPts;
  const lowBeatsHigh = shell === "high" && total < lowTotal;

  return (
    <>
      <p>
        Now estimate what a whole match is worth. Real estimates include how often things work. A shot that goes in 60% of the time is
        worth 60% of its points, on average.
      </p>
      <Lab title="Match score estimator" caption="Assumes the low tray is a short drive (5 s quicker per cycle than the high net) and lands 97% of the time. Auto scoring is assumed to work 85% of the time.">
        <div className="grid gap-5 md:grid-cols-2">
          <Choice<Shell>
            label="Teleop shells go into"
            value={shell}
            options={[
              { value: "high", label: "High net" },
              { value: "low", label: "Low tray" },
              { value: "none", label: "Nothing" },
            ]}
            onChange={(value) => {
              setShell(value);
              setCycle(value === "low" ? 6 : 11);
            }}
          />
          <Choice<"yes" | "no">
            label="Score the preload in auto"
            value={autoScore ? "yes" : "no"}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "Just leave" },
            ]}
            onChange={(value) => setAutoScore(value === "yes")}
          />
          {shell !== "none" && (
            <Slider id="ge-cycle" label="Seconds per cycle" value={cycle} min={4} max={20} onChange={setCycle} format={(value) => `${value} s`} />
          )}
          {shell === "high" && (
            <Slider id="ge-accuracy" label="High net accuracy" value={accuracy} min={20} max={100} step={5} onChange={setAccuracy} format={(value) => `${value}%`} />
          )}
          <Choice<"yes" | "no">
            label="Hang in endgame"
            value={hang ? "yes" : "no"}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            onChange={(value) => setHang(value === "yes")}
          />
          {hang && (
            <Slider id="ge-hang" label="Hang success rate" value={hangSuccess} min={0} max={100} step={5} onChange={setHangSuccess} format={(value) => `${value}%`} />
          )}
        </div>
        <Readouts
          items={[
            { label: "Auto", value: autoPts.toFixed(1) },
            { label: "Teleop", value: teleopPts.toFixed(1), note: `${cycles} cycles` },
            { label: "Endgame", value: endPts.toFixed(1) },
            { label: "Expected total", value: total.toFixed(0), tone: total >= 75 ? "good" : total >= 50 ? "warn" : "bad" },
          ]}
        />
        {shell === "high" && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            The same robot dropping in the low tray instead would expect about {lowTotal.toFixed(0)} points.
          </p>
        )}
        <Goals
          goals={[
            { label: "Find a plan that expects 75 points or more", met: total >= 75 },
            { label: "Find a high net accuracy where the low tray would be the better plan", met: lowBeatsHigh },
          ]}
        />
      </Lab>
      <p>
        This is why the "easy" option often wins in week one. A simple, reliable robot can outscore an ambitious one that misses. The
        better plan depends on how good your team can actually make each mechanism by competition.
      </p>
      <Takeaway>Expected points = points × how often it works. Be honest about how often it will work.</Takeaway>
    </>
  );
}

type ReqKind = "requirement" | "mechanism";

function ChapterRequirements() {
  return (
    <>
      <p>
        After ranking actions, the group picks a strategy and writes it down as <span className="font-semibold">requirements</span>: what the
        robot must do, measured, without saying how. Mechanisms come later, and prototyping decides between them.
      </p>
      <p>
        Writing "we'll build a flywheel shooter" too early locks you in before you've tested anything. Writing "scores in the high net from
        the starting line at 80% accuracy" leaves room for the best idea to win.
      </p>
      <Lab title="Requirement or mechanism?">
        <Sorter<ReqKind>
          buckets={[
            { value: "requirement", label: "Requirement" },
            { value: "mechanism", label: "Mechanism (too early)" },
          ]}
          items={[
            { text: "Completes a high-net cycle in 10 seconds or less", answer: "requirement", why: "It says what and how well, not how." },
            { text: "Uses a two-wheel flywheel shooter", answer: "mechanism", why: "That's a solution. Prototype it against other shooters first." },
            { text: "Hangs from the low rung in under 6 seconds, 9 times out of 10", answer: "requirement", why: "Measurable and leaves the design open." },
            { text: "Has a telescoping arm", answer: "mechanism", why: "A design choice. What does the arm need to reach, and how fast?" },
            { text: "Picks up shells from the floor while driving", answer: "requirement", why: "Describes the job. Many intakes could do it." },
            { text: "Fits under the 18 in tide gate", answer: "requirement", why: "A size constraint from the rules. Every design must meet it." },
          ]}
        />
      </Lab>
      <Takeaway>Strategy → requirements → mechanisms. Don't skip a step.</Takeaway>
    </>
  );
}

export function GameBreakdownLessonPage() {
  return (
    <LessonShell
      title="Break down a game"
      chapters={[
        { id: "rules", title: "Read the scoring first", minutes: 6, render: () => <ChapterRules /> },
        { id: "rank", title: "Points per second", minutes: 6, render: () => <ChapterRank /> },
        { id: "estimate", title: "Estimate a match", minutes: 8, render: () => <ChapterEstimate /> },
        { id: "requirements", title: "Requirements before mechanisms", minutes: 5, render: () => <ChapterRequirements /> },
        { id: "check", title: "Check your understanding", minutes: 4, render: () => <SkillCheckChapter seedKey="mech-rank-actions" /> },
      ]}
    />
  );
}
