import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { Choice, Goals, Lab, Readouts, Slider, Takeaway } from "@/components/learning/lab-ui";
import { Sorter } from "@/components/learning/lesson-shell";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Mock kickoff: FRC 2013 ULTIMATE ASCENT.
 * A rulebook cheat sheet plus practice tools for game analysis, design
 * decisions, prototype planning, and master-sketch envelope checks.
 *
 * Rule tags link to the official archived manual. Page numbers come from the
 * kickoff release of the 2013 manual (PDF page = printed page). If a link lands
 * a page off, fix it in PAGE below and every tag updates.
 */

const MANUAL_URL = "https://firstfrc.blob.core.windows.net/frcarchive/2013/2013-game-manual.pdf";
const UPDATES_URL = "https://firstfrc.blob.core.windows.net/frcarchive/2013/2013-team-updates.pdf";
const QA_URL = "https://firstfrc.blob.core.windows.net/frcarchive/2013/2013-q-and-a.pdf";
const FIELD_DWG_URL = "https://firstfrc.blob.core.windows.net/frcarchive/2013/2013-ultimate-ascent-game-specific-drawings.pdf";

/** Manual page for each section or rule we cite. */
const PAGE: Record<string, number> = {
  "1.6": 12,
  "2.2": 14,
  "2.2.1": 14,
  "2.2.2": 15,
  "2.2.3": 16,
  "2.2.5": 18,
  "2.2.6": 21,
  "2.2.7": 21,
  "2.2.10": 23,
  "3.1.1": 24,
  "3.1.2": 25,
  "3.1.4": 26,
  "3.1.5": 26,
  "3.1.5.1": 26,
  "3.1.5.2": 27,
  "3.2": 29,
  "4.1": 39,
  "4.1.6": 47,
  "4.1.7": 53,
  "6.1": 85,
  G02: 29,
  G04: 29,
  G05: 30,
  G06: 30,
  G10: 31,
  G12: 32,
  G13: 32,
  G14: 32,
  G15: 32,
  G16: 33,
  G17: 33,
  G19: 33,
  G20: 34,
  G21: 34,
  G22: 34,
  G23: 34,
  G24: 35,
  G25: 35,
  G27: 36,
  G28: 36,
  G29: 37,
  G30: 37,
  G31: 37,
  G32: 37,
  G33: 38,
  G34: 38,
  G35: 38,
  G37: 39,
  R01: 40,
  R02: 40,
  R03: 41,
  R04: 41,
  R05: 42,
  R06: 42,
  R07: 42,
  R08: 42,
  R10: 43,
  R11: 43,
  R12: 43,
  R16: 45,
  R17: 45,
  R21: 47,
  R22: 47,
  R23: 48,
  R24: 48,
  R25: 50,
  R30: 52,
  R32: 53,
  R33: 54,
  R34: 55,
};

function pageFor(ref: string) {
  const clean = ref.trim().replace(/^Section\s*/i, "").replace(/[A-C]$/, "");

  if (PAGE[clean]) {
    return PAGE[clean];
  }

  // Fall back to the nearest parent section, e.g. 3.1.5.2.1 -> 3.1.5.2.
  let parent = clean;

  while (parent.includes(".")) {
    parent = parent.slice(0, parent.lastIndexOf("."));

    if (PAGE[parent]) {
      return PAGE[parent];
    }
  }

  return undefined;
}

/** One or more rule tags, e.g. <Rule refs="G22, G23" />. Each links to its manual page. */
function Rule({ refs }: { refs: string }) {
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {refs.split(",").map((raw) => {
        const ref = raw.trim();
        const page = pageFor(ref);
        const className =
          "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-px font-mono text-xs font-semibold whitespace-nowrap no-underline";

        if (!page) {
          return (
            <span key={ref} className={cn(className, "bg-muted text-muted-foreground")}>
              {ref}
            </span>
          );
        }

        return (
          <a
            key={ref}
            href={`${MANUAL_URL}#page=${page}`}
            target="_blank"
            rel="noreferrer"
            title={`Open ${/^[GR]\d/.test(ref) ? `rule ${ref}` : `section ${ref}`} in the 2013 Game Manual (page ${page})`}
            className={cn(className, "border-primary/40 bg-accent text-primary hover:bg-primary hover:text-primary-foreground")}
          >
            {ref}
            <ExternalLink className="size-3 opacity-60" aria-hidden />
          </a>
        );
      })}
    </span>
  );
}

// ---- Shared bits ----------------------------------------------------

function Panel({ title, rules, hint, children }: { title: string; rules?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
        {title}
        {rules && <Rule refs={rules} />}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Tile({ value, label, rules }: { value: string; label: ReactNode; rules?: string }) {
  return (
    <div className="rounded-lg bg-muted p-4">
      <p className="font-heading text-2xl font-bold text-primary tabular-nums [font-stretch:87.5%]">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {label} {rules && <Rule refs={rules} />}
      </p>
    </div>
  );
}

function Tiles({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

function Think({ children }: { children: ReactNode }) {
  return (
    <aside className="rounded-lg border-l-4 border-primary bg-accent px-4 py-3 text-sm leading-6">
      <span className="font-semibold">Think about it: </span>
      {children}
    </aside>
  );
}

// ---- Tab: The game --------------------------------------------------

function FieldSketch() {
  // 12 px per foot. Field is 54 x 27 ft. Red drives from the left wall.
  const x0 = 36;
  const y0 = 24;
  const w = 648;
  const h = 324;
  const cx = x0 + w / 2;
  const autoOffset = 108; // 108 in = 9 ft = 108 px
  const pyr = 94; // 94 in base, about 7.8 ft
  const pyrY = y0 + h / 2 - pyr / 2;

  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 720 390" role="img" aria-label="Simplified top-down sketch of the 2013 Ultimate Ascent field" className="w-full min-w-[600px] max-w-[900px]">
        <rect x={x0} y={y0} width={w} height={h} rx={6} className="fill-muted stroke-border" strokeWidth={2} />

        {/* Driver walls */}
        <rect x={x0 - 14} y={y0 + 60} width={14} height={h - 120} className="fill-rose-600 dark:fill-rose-400" />
        <rect x={x0 + w} y={y0 + 60} width={14} height={h - 120} className="fill-sky-600 dark:fill-sky-400" />

        {/* Center + auto lines */}
        <line x1={cx} y1={y0} x2={cx} y2={y0 + h} className="stroke-foreground" strokeWidth={2} strokeDasharray="6 5" />
        <line x1={cx + autoOffset} y1={y0} x2={cx + autoOffset} y2={y0 + h} className="stroke-rose-600 dark:stroke-rose-400" strokeWidth={2.5} />
        <line x1={cx - autoOffset} y1={y0} x2={cx - autoOffset} y2={y0 + h} className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={2.5} />

        {/* Pyramids: each sits in the half where its alliance scores */}
        <g>
          <rect x={cx + autoOffset} y={pyrY} width={pyr} height={pyr} className="fill-rose-600/15 stroke-rose-600 dark:stroke-rose-400" strokeWidth={3} />
          <line x1={cx + autoOffset} y1={pyrY} x2={cx + autoOffset + pyr} y2={pyrY + pyr} className="stroke-rose-600 dark:stroke-rose-400" strokeWidth={1.5} />
          <line x1={cx + autoOffset + pyr} y1={pyrY} x2={cx + autoOffset} y2={pyrY + pyr} className="stroke-rose-600 dark:stroke-rose-400" strokeWidth={1.5} />
          <rect x={cx + autoOffset + pyr / 2 - 12} y={pyrY + pyr / 2 - 12} width={24} height={24} className="fill-card stroke-rose-600 dark:stroke-rose-400" strokeWidth={2} />
        </g>
        <g>
          <rect x={cx - autoOffset - pyr} y={pyrY} width={pyr} height={pyr} className="fill-sky-600/15 stroke-sky-600 dark:stroke-sky-400" strokeWidth={3} />
          <line x1={cx - autoOffset - pyr} y1={pyrY} x2={cx - autoOffset} y2={pyrY + pyr} className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={1.5} />
          <line x1={cx - autoOffset} y1={pyrY} x2={cx - autoOffset - pyr} y2={pyrY + pyr} className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={1.5} />
          <rect x={cx - autoOffset - pyr / 2 - 12} y={pyrY + pyr / 2 - 12} width={24} height={24} className="fill-card stroke-sky-600 dark:stroke-sky-400" strokeWidth={2} />
        </g>

        {/* Goals above each wall: the RED goals hang over the BLUE wall and vice versa */}
        <rect x={x0 + w - 6} y={y0 + 96} width={10} height={40} rx={2} className="fill-rose-600 dark:fill-rose-400" />
        <rect x={x0 + w - 6} y={y0 + 142} width={10} height={40} rx={2} className="fill-rose-700 dark:fill-rose-300" />
        <rect x={x0 + w - 6} y={y0 + 188} width={10} height={40} rx={2} className="fill-rose-600 dark:fill-rose-400" />
        <rect x={x0 - 4} y={y0 + 96} width={10} height={40} rx={2} className="fill-sky-600 dark:fill-sky-400" />
        <rect x={x0 - 4} y={y0 + 142} width={10} height={40} rx={2} className="fill-sky-700 dark:fill-sky-300" />
        <rect x={x0 - 4} y={y0 + 188} width={10} height={40} rx={2} className="fill-sky-600 dark:fill-sky-400" />

        {/* Low goals: in a corner of the opponent's wall */}
        <rect x={x0 + w - 30} y={y0 + h - 30} width={30} height={30} className="fill-rose-600/40 stroke-rose-600 dark:stroke-rose-400" strokeWidth={2} />
        <rect x={x0} y={y0} width={30} height={30} className="fill-sky-600/40 stroke-sky-600 dark:stroke-sky-400" strokeWidth={2} />

        {/* Feeder stations + loading zones */}
        <path d={`M${x0} ${y0 + h - 70} L${x0 + 40} ${y0 + h} L${x0 + 110} ${y0 + h}`} fill="none" className="stroke-rose-600 dark:stroke-rose-400" strokeWidth={5} />
        <path d={`M${x0} ${y0 + h - 100} L${x0 + 140} ${y0 + h}`} className="stroke-rose-600/70 dark:stroke-rose-400/70" strokeWidth={2} strokeDasharray="4 3" />
        <path d={`M${x0 + w} ${y0 + 70} L${x0 + w - 40} ${y0} L${x0 + w - 110} ${y0}`} fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={5} />
        <path d={`M${x0 + w} ${y0 + 100} L${x0 + w - 140} ${y0}`} className="stroke-sky-600/70 dark:stroke-sky-400/70" strokeWidth={2} strokeDasharray="4 3" />
        <line x1={x0 + 30} y1={y0} x2={x0 + 60} y2={y0} className="stroke-rose-600 dark:stroke-rose-400" strokeWidth={5} />
        <line x1={x0 + w - 30} y1={y0 + h} x2={x0 + w - 60} y2={y0 + h} className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={5} />

        <g className="fill-foreground text-[11px] font-semibold">
          <text x={x0 + 4} y={y0 + h / 2 - 4} transform={`rotate(-90 ${x0 - 22} ${y0 + h / 2})`} textAnchor="middle">RED DRIVERS</text>
          <text x={x0 + w + 40} y={y0 + h / 2 - 4} transform={`rotate(90 ${x0 + w + 22} ${y0 + h / 2})`} textAnchor="middle">BLUE DRIVERS</text>
          <text x={cx} y={y0 - 8} textAnchor="middle" className="fill-muted-foreground">CENTER LINE</text>
          <text x={cx + autoOffset + pyr / 2} y={pyrY - 8} textAnchor="middle">RED PYRAMID</text>
          <text x={cx - autoOffset - pyr / 2} y={pyrY - 8} textAnchor="middle">BLUE PYRAMID</text>
          <text x={cx + autoOffset + 4} y={y0 + h - 8} className="fill-rose-700 dark:fill-rose-300">RED AUTO LINE</text>
          <text x={cx - autoOffset + 4} y={y0 + 16} className="fill-sky-700 dark:fill-sky-300">BLUE AUTO LINE</text>
          <text x={x0 + w - 16} y={y0 + 250} textAnchor="end" className="fill-rose-700 dark:fill-rose-300">RED HIGH + MIDDLE GOALS</text>
          <text x={x0 + 16} y={y0 + 84} className="fill-sky-700 dark:fill-sky-300">BLUE HIGH + MIDDLE GOALS</text>
          <text x={x0 + w - 36} y={y0 + h - 12} textAnchor="end" className="fill-rose-700 dark:fill-rose-300">RED LOW GOAL</text>
          <text x={x0 + 36} y={y0 + 20} className="fill-sky-700 dark:fill-sky-300">BLUE LOW GOAL</text>
          <text x={x0 + 100} y={y0 + h - 40} className="fill-rose-700 dark:fill-rose-300">RED FEEDERS</text>
          <text x={x0 + w - 100} y={y0 + 48} textAnchor="end" className="fill-sky-700 dark:fill-sky-300">BLUE FEEDERS</text>
        </g>
        <text x={360} y={378} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          Red loads at its own wall, then crosses the field to shoot at goals over the blue wall. Blue does the mirror image.
        </text>
      </svg>
    </div>
  );
}

function TimelineBar() {
  const parts = [
    { label: "AUTO", sub: "15 s · discs worth double", flex: 15, className: "bg-emerald-700" },
    { label: "TELEOP", sub: "90 s · drivers in control", flex: 90, className: "bg-slate-600" },
    { label: "LAST 30 s", sub: "climb · feeders may toss over", flex: 30, className: "bg-violet-700" },
  ];

  return (
    <div className="overflow-x-auto">
      <div className="flex h-16 min-w-[560px] overflow-hidden rounded-lg text-center text-xs font-bold text-white">
        {parts.map((part) => (
          <div key={part.label} style={{ flex: part.flex }} className={cn("flex flex-col justify-center border-r-2 border-card px-1 last:border-r-0", part.className)}>
            {part.label}
            <span className="font-normal opacity-90">{part.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabGame() {
  return (
    <div className="space-y-6">
      <Panel title="The game in 60 seconds" rules="1.6">
        <p className="max-w-[70ch] text-base leading-7">
          Two alliances of three robots throw flying <span className="font-semibold">DISCS</span> (frisbees) into <span className="font-semibold">GOALS</span>{" "}
          on the far wall. Higher goals are worth more, and every disc scored in the first 15 seconds is worth double. At the end, robots{" "}
          <span className="font-semibold">CLIMB</span> their alliance's <span className="font-semibold">PYRAMID</span> for up to 30 points each.
        </p>
        <Tiles>
          <Tile value="2:15" label="match length · 15 s AUTO + 2:00 TELEOP" rules="3.1.2" />
          <Tile value="1–6 pts" label="per DISC, by goal height and period" rules="3.1.5.1" />
          <Tile value="10/20/30" label="CLIMB points for Level 1/2/3" rules="3.1.5.2" />
          <Tile value="27 × 54 ft" label="carpeted field" rules="2.2.1" />
        </Tiles>
      </Panel>

      <Panel title="Match timeline" rules="3.1.2, G35">
        <TimelineBar />
        <ul className="grid list-disc gap-1.5 pl-5 text-sm leading-6">
          <li>
            <span className="font-semibold">AUTO (15 s):</span> robots run their own code. Each robot starts touching its alliance's PYRAMID with 2 or 3
            preloaded discs. Disc points are doubled. <Rule refs="G05, G06" />
          </li>
          <li>
            <span className="font-semibold">TELEOP (2:00):</span> drivers take over. FEEDERS (human players) push discs onto the field through
            FEEDER SLOTS. <Rule refs="G34, G35" />
          </li>
          <li>
            <span className="font-semibold">Last 30 s:</span> feeders may also throw discs over the FEEDER STATION. This is when most robots climb. <Rule refs="G35" />
          </li>
          <li>
            <span className="font-semibold">After the buzzer:</span> CLIMB levels are judged 5 seconds after time runs out, or when everything stops
            moving. <Rule refs="3.1.5.2" />
          </li>
        </ul>
        <Think>
          a full climb takes a lot of the last 30 seconds. Every second spent climbing is a second not shooting. How many discs would your robot
          have to score to equal a Level 3 climb?
        </Think>
      </Panel>

      <Panel title="The field" rules="2.2, 2.2.2" hint={<>Simplified sketch, roughly to scale. Use Figure 2-2 in the manual and the <a className="text-primary underline" href={FIELD_DWG_URL} target="_blank" rel="noreferrer">field drawings</a> for exact positions.</>}>
        <FieldSketch />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Area</th>
                <th className="py-2 pr-3 font-medium">What it is</th>
                <th className="py-2 font-medium">Rule</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-t [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top">
              <tr>
                <td className="font-semibold">GOALS</td>
                <td>HIGH and two MIDDLE goals hang above the opponent's wall. Your LOW GOAL sits in a corner at that same end.</td>
                <td><Rule refs="2.2.3" /></td>
              </tr>
              <tr>
                <td className="font-semibold">PYRAMID</td>
                <td>Your steel climbing structure, in the half where you score, next to your AUTO LINE. A PYRAMID GOAL sits on top.</td>
                <td><Rule refs="2.2.5" /></td>
              </tr>
              <tr>
                <td className="font-semibold">AUTO LINE</td>
                <td>A red or blue tape line 108 in from the CENTER LINE. Your AUTO ZONE runs from it to the wall where you score.</td>
                <td><Rule refs="2.2.2" /></td>
              </tr>
              <tr>
                <td className="font-semibold">FEEDER STATION</td>
                <td>Three per alliance at your own wall, each with three FEEDER SLOTS your human player pushes discs through.</td>
                <td><Rule refs="2.2.7" /></td>
              </tr>
              <tr>
                <td className="font-semibold">LOADING ZONE</td>
                <td>The taped area in front of your two side-by-side FEEDER STATIONS. Opponents can't touch you while you're in it.</td>
                <td><Rule refs="2.2.2, G30" /></td>
              </tr>
              <tr>
                <td className="font-semibold">CENTER LINE</td>
                <td>Splits the field. In AUTO you may not leave your starting half.</td>
                <td><Rule refs="2.2.2, G19" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <Think>
          your feeders are at one end and your goals are at the other. Every cycle is a full-field trip unless you pick discs off the floor. Does
          that change how fast your drivetrain needs to be, or whether you need a floor intake at all?
        </Think>
      </Panel>
    </div>
  );
}

// ---- Tab: Key numbers -----------------------------------------------

const SCORING = [
  { goal: "HIGH GOAL", auto: 6, teleop: 3 },
  { goal: "MIDDLE GOAL", auto: 4, teleop: 2 },
  { goal: "LOW GOAL", auto: 2, teleop: 1 },
  { goal: "PYRAMID GOAL", auto: null, teleop: 5 },
] as const;

function SideView() {
  // 2.6 px per inch, floor at y = 330.
  const s = 2.6;
  const floor = 330;
  const y = (inches: number) => floor - inches * s;

  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 720 360" role="img" aria-label="Side view of goal, feeder slot, pyramid rung and robot height limits, drawn to scale" className="w-full min-w-[600px] max-w-[880px]">
        {[0, 30, 60, 90, 120].map((inches) => (
          <g key={inches}>
            <line x1={50} x2={700} y1={y(inches)} y2={y(inches)} className={inches === 0 ? "stroke-foreground" : "stroke-border"} strokeWidth={inches === 0 ? 2 : 1} />
            <text x={44} y={y(inches)} dy="0.35em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {inches}{inches === 120 ? " in" : ""}
            </text>
          </g>
        ))}

        {/* Feeder slots 22, 42, 62 (12 x 3 in) */}
        <rect x={70} y={y(72)} width={60} height={72 * s} className="fill-muted stroke-border" />
        {[22, 42, 62].map((inches) => (
          <rect key={inches} x={85} y={y(inches + 3)} width={30} height={3 * s} className="fill-foreground" />
        ))}
        <text x={100} y={y(76)} textAnchor="middle" className="fill-foreground text-[12px] font-semibold">FEEDER SLOTS</text>
        <text x={136} y={y(42)} dy="0.35em" className="fill-muted-foreground text-[11px]">22 / 42 / 62"</text>

        {/* Robot height limits */}
        <rect x={210} y={y(60)} width={80} height={60 * s} rx={4} className="fill-primary/80" />
        <rect x={204} y={y(8)} width={92} height={6 * s} rx={2} className="fill-rose-600 dark:fill-rose-400" />
        <line x1={196} x2={310} y1={y(60)} y2={y(60)} className="stroke-warning" strokeWidth={2.5} strokeDasharray="6 4" />
        <line x1={196} x2={310} y1={y(84)} y2={y(84)} className="stroke-destructive" strokeWidth={2.5} strokeDasharray="6 4" />
        <text x={250} y={y(60) - 6} textAnchor="middle" className="fill-warning text-[12px] font-semibold">60" most of the field</text>
        <text x={250} y={y(84) - 6} textAnchor="middle" className="fill-destructive text-[12px] font-semibold">84" in AUTO ZONE / on PYRAMID</text>
        <text x={250} y={y(30)} textAnchor="middle" className="fill-primary-foreground text-[12px] font-semibold">ROBOT</text>

        {/* Pyramid rungs 30, 60, 90 */}
        <line x1={370} x2={420} y1={floor} y2={y(90)} className="stroke-muted-foreground" strokeWidth={5} />
        <line x1={490} x2={440} y1={floor} y2={y(90)} className="stroke-muted-foreground" strokeWidth={5} />
        {[30, 60, 90].map((inches) => (
          <line key={inches} x1={370 + inches * s * 0.2} x2={490 - inches * s * 0.2} y1={y(inches)} y2={y(inches)} className="stroke-foreground" strokeWidth={4} />
        ))}
        <text x={498} y={y(30)} dy="0.35em" className="fill-foreground text-[11px] font-semibold">30" → Level 2</text>
        <text x={486} y={y(60)} dy="0.35em" className="fill-foreground text-[11px] font-semibold">60" → Level 3</text>
        <text x={466} y={y(90)} dy="0.35em" className="fill-foreground text-[11px] font-semibold">90" top</text>
        <text x={430} y={y(96)} textAnchor="middle" className="fill-foreground text-[12px] font-semibold">PYRAMID</text>

        {/* Goals on the wall */}
        <rect x={600} y={y(43)} width={60} height={24 * s} className="fill-none stroke-foreground" strokeWidth={2} />
        <text x={630} y={y(31)} dy="0.35em" textAnchor="middle" className="fill-foreground text-[11px] font-semibold">LOW 19"</text>
        <rect x={566} y={y(109.6)} width={38} height={21 * s} className="fill-none stroke-foreground" strokeWidth={2} />
        <rect x={666} y={y(109.6)} width={38} height={21 * s} className="fill-none stroke-foreground" strokeWidth={2} />
        <rect x={610} y={y(116.1)} width={50} height={12 * s} className="fill-cta/30 stroke-cta" strokeWidth={2} />
        <text x={560} y={y(99)} dy="0.35em" textAnchor="end" className="fill-foreground text-[11px] font-semibold">MIDDLE 88⅝"</text>
        <text x={635} y={y(100)} textAnchor="middle" className="fill-cta text-[11px] font-semibold">HIGH</text>
        <text x={635} y={y(100) + 13} textAnchor="middle" className="fill-cta text-[11px] font-semibold">104⅛"</text>
      </svg>
    </div>
  );
}

function TabNumbers() {
  return (
    <div className="space-y-6">
      <Panel title="What's each disc worth?" rules="3.1.5.1" hint="Points per disc. AUTO doubles everything except the PYRAMID GOAL, which only counts in TELEOP.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Goal</th>
                <th className="py-2 pr-3 text-right font-medium">AUTO</th>
                <th className="py-2 pr-3 text-right font-medium">TELEOP</th>
                <th className="py-2 font-medium">Teleop value</th>
              </tr>
            </thead>
            <tbody>
              {SCORING.map((row) => (
                <tr key={row.goal} className="border-t">
                  <td className="py-2 pr-3 font-semibold">{row.goal}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.auto ?? "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.teleop}</td>
                  <td className="w-1/2 py-2">
                    <div className="h-4 overflow-hidden rounded bg-muted">
                      <div className="h-full rounded bg-primary" style={{ width: `${(row.teleop / 5) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="grid list-disc gap-1 pl-5 text-sm leading-6 text-muted-foreground">
          <li>A disc counts once any part of it passes through the goal opening, as long as it's still there at the end and not touching your robot.</li>
          <li>Only discs of <span className="font-semibold text-foreground">your alliance's color</span> score in your PYRAMID GOAL. Each alliance gets 6 colored discs.</li>
        </ul>
      </Panel>

      <Panel title="Climbing" rules="3.1.5.2, 2.2.5">
        <Tiles>
          <Tile value="10" label="Level 1: off the carpet, on the PYRAMID" />
          <Tile value="20" label="Level 2: above the 30 in rung" />
          <Tile value="30" label="Level 3: above the 60 in rung" />
          <Tile value="68°" label="PYRAMID sides slope in · 94 in wide at the base" rules="2.2.5" />
        </Tiles>
        <ul className="grid list-disc gap-1 pl-5 text-sm leading-6 text-muted-foreground">
          <li>Your level is set by the <span className="font-semibold text-foreground">lowest point</span> of your robot when scores are judged.</li>
          <li>A climb must go up in order (floor → 1 → 2 → 3) and never touch more than two levels at once. No skipping rungs.</li>
          <li>A Level 3 climb equals 10 HIGH GOAL discs in TELEOP.</li>
        </ul>
      </Panel>

      <Panel title="Heights that matter" rules="2.2.3, 2.2.5, 2.2.7, G22" hint="Side view, drawn to scale. Your shooter has to clear the goal edges, your intake may need to reach a feeder slot, and your climber has to work inside the height limits.">
        <SideView />
      </Panel>

      <Panel title="DISCS" rules="2.2.10, 3.1.1">
        <Tiles>
          <Tile value="11 in" label="nominal diameter · 1.4 in tall · about 180 g" rules="2.2.10" />
          <Tile value="118" label="white discs, plus 6 red and 6 blue" rules="3.1.1" />
          <Tile value="2 or 3" label="preloaded per robot · 3 if starting outside the AUTO ZONE" rules="G06" />
          <Tile value="4 max" label="discs a robot may control at once" rules="G24" />
        </Tiles>
      </Panel>

      <Panel title="Penalties" rules="3.1.4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Tile value="+3" label="to the opponent per FOUL" />
          <Tile value="+20" label="to the opponent per TECHNICAL FOUL" />
        </div>
        <p className="text-sm text-muted-foreground">One TECHNICAL FOUL is worth more than six teleop HIGH GOAL discs. Drive clean.</p>
      </Panel>
    </div>
  );
}

// ---- Tab: Robot rules -----------------------------------------------

const MOTORS = [
  ["CIM", 6],
  ["BaneBots", 4],
  ["AndyMark 9015", 4],
  ["Denso throttle", 4],
  ["VEX BAG / mini-CIM", 4],
  ["AndyMark PG", 3],
  ["Window motor", 2],
  ["VEX 393", 2],
  ["Snow blower", 1],
] as const;

function TabRobot() {
  return (
    <div className="space-y-6">
      <Panel title="Size and weight" rules="R03, R05, G22, G23" hint="These set the outside of your master sketch. Draw them first.">
        <Tiles>
          <Tile value="112 in" label="max FRAME PERIMETER (e.g. 28 × 28 in)" rules="R03" />
          <Tile value="54 in" label="the robot must always fit inside a 54 in circle" rules="R03, G23" />
          <Tile value="60 / 84 in" label="max height: 84 in in your AUTO ZONE or on your PYRAMID, 60 in everywhere else" rules="G22" />
          <Tile value="120 lb" label="max weight, not counting battery and BUMPERS" rules="R05" />
        </Tiles>
        <p className="text-sm text-muted-foreground">
          In the STARTING CONFIGURATION nothing may stick out past the frame perimeter. <Rule refs="R04" />
        </p>
      </Panel>

      <Panel title="BUMPERS" rules="R22, R23, R24, R25">
        <Tiles>
          <Tile value="2–10 in" label="BUMPERS must sit in this band above the floor" rules="R25" />
          <Tile value="8 in" label="minimum BUMPER on each side of every outside corner" rules="R22" />
          <Tile value="20 lb" label="max weight of the BUMPER set" rules="R23" />
          <Tile value="Red / Blue" label="match your alliance color each match" rules="R30" />
        </Tiles>
      </Panel>

      <Panel title="Budget and build" rules="R11, R12, R16, R17, R21">
        <Tiles>
          <Tile value="$4,000" label="max total robot cost" rules="R11" />
          <Tile value="$400" label="max cost of any single part" rules="R12" />
          <Tile value="6 weeks" label="build season. The robot was bagged on Feb 19, 2013" rules="R17" />
          <Tile value="30 lb" label="of fabricated parts you may bring to an event" rules="R21" />
        </Tiles>
      </Panel>

      <Panel title="Motors" rules="R32, R33" hint="Max count per motor type. Motors can't be modified inside.">
        <div className="grid gap-2 sm:grid-cols-3">
          {MOTORS.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span>{name}</span>
              <span className="font-semibold tabular-nums">{count}</span>
            </div>
          ))}
        </div>
        <Think>2013 robots ran pneumatics and a cRIO, not today's parts. For our mock build, design with the motors we own now and note where you broke from 2013.</Think>
      </Panel>

      <Panel title="Other design rules" rules="R07, R10">
        <ul className="grid list-disc gap-1.5 pl-5 text-sm leading-6">
          <li>You need at least two <span className="font-semibold">belay attachment points</span> on opposite sides, near the balance point, so the field crew can safely lower a climbed robot. <Rule refs="R10, G04" /></li>
          <li>Discs must be removable from the robot while it's off and disabled. <Rule refs="R07" /></li>
          <li>No metal, sandpaper, or hard studs on traction surfaces. <Rule refs="R06" /></li>
        </ul>
      </Panel>
    </div>
  );
}

// ---- Tab: Watch out -------------------------------------------------

const GOTCHAS: { title: string; body: string; rules: string }[] = [
  { title: "60 in tall, except near your goals", body: "A tall shooter is legal in your AUTO ZONE or on your PYRAMID, but it has to be under 60 in everywhere else.", rules: "G22" },
  { title: "Always inside a 54 in circle", body: "Arms, hooks, and intakes that unfold all count. A wide robot has almost no room to extend.", rules: "R03, G23" },
  { title: "Four discs at a time, max", body: "Each extra disc you carry, herd, or trap is a FOUL. A five-disc hopper is wasted space.", rules: "G24" },
  { title: "No skipping rungs", body: "A climb has to go Level 1 → 2 → 3 in order, touching no more than two levels at once.", rules: "3.1.5.2" },
  { title: "Stay off the other PYRAMID", body: "Touching an opponent's pyramid is a TECHNICAL FOUL. If it affects their climb: RED CARD, and they get Level 3 points.", rules: "G27" },
  { title: "Climbers and loaders are protected", body: "You can't touch an opponent who is on their PYRAMID or in their LOADING ZONE.", rules: "G30" },
  { title: "Pins last 5 seconds", body: "A longer pin is a TECHNICAL FOUL, worth 20 points to them.", rules: "G31" },
  { title: "AUTO: stay on your half", body: "Crossing the CENTER LINE in AUTO is a FOUL, or a TECHNICAL FOUL if you hit someone.", rules: "G19" },
  { title: "Colored discs, your pyramid only", body: "Only your color scores in your PYRAMID GOAL, and only in TELEOP. Putting discs in the opponent's PYRAMID GOAL is a TECHNICAL FOUL.", rules: "3.1.5.1, G17" },
  { title: "Don't throw discs out", body: "Intentionally ejecting discs from the field is a FOUL for each disc.", rules: "G15" },
  { title: "Keep your robot together", body: "Leaving parts on the field on purpose is a TECHNICAL FOUL.", rules: "G13" },
  { title: "Only the FEEDER touches discs", body: "Drivers and coaches can't handle discs during the match.", rules: "G34" },
];

function TabWatch() {
  return (
    <div className="space-y-4">
      <p className="max-w-[70ch] text-sm text-muted-foreground">These rules shape robot design and driving. Know them before anyone starts sketching.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {GOTCHAS.map((item) => (
          <div key={item.title} className="rounded-xl border border-t-4 border-t-destructive bg-card p-4">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 mb-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
            <Rule refs={item.rules} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Tab: Ask the rulebook ------------------------------------------

const KB: { q: string; k: string; a: string; r: string }[] = [
  { q: "How long is a match?", k: "match long length time minutes duration total", a: "2 minutes 15 seconds: a 15-second AUTO, then 2 minutes of TELEOP.", r: "3.1.2" },
  { q: "How long is AUTO?", k: "auto autonomous long seconds code", a: "15 seconds. Robots run their own code, and disc points are doubled.", r: "3.1.2, 3.1.5.1" },
  { q: "How many points is a disc worth?", k: "disc point points worth score frisbee value goal high middle low", a: "HIGH 6/3, MIDDLE 4/2, LOW 2/1 (AUTO/TELEOP). PYRAMID GOAL 5, TELEOP only.", r: "3.1.5.1" },
  { q: "When does a disc count?", k: "count scored through opening end touching", a: "Once any part of it passes through the goal opening, if it's still in the goal at the end and not touching a robot from that alliance.", r: "3.1.5.1" },
  { q: "What is the PYRAMID GOAL?", k: "pyramid goal top colored disc basket five", a: "A basket on top of each PYRAMID. Only discs of that pyramid's color score there, 5 points each, TELEOP only.", r: "2.2.3, 3.1.5.1" },
  { q: "What are the colored discs for?", k: "colored red blue disc pyramid", a: "Each alliance has 6 discs of its color, kept in its ALLIANCE STATION. They're the only discs that score in that alliance's PYRAMID GOAL.", r: "3.1.1, 3.1.5.1" },
  { q: "How many points for climbing?", k: "climb climbing pyramid points level hang endgame", a: "Level 1 = 10, Level 2 = 20, Level 3 = 30. You score only your highest level.", r: "3.1.5.2" },
  { q: "What counts as each climb level?", k: "level 1 2 3 definition rung lowest point", a: "It's set by the lowest point of your robot: off the carpet on the pyramid = Level 1, above the 30 in rung = Level 2, above the 60 in rung = Level 3.", r: "3.1.5.2" },
  { q: "Can we skip a rung?", k: "skip rung sequence order two levels", a: "No. A climb must go through the levels in order and never touch more than two levels at once.", r: "3.1.5.2" },
  { q: "When is the climb judged?", k: "climb judged assessed end buzzer seconds", a: "5 seconds after the match timer hits zero, or once everything stops moving.", r: "3.1.5.2" },
  { q: "How tall are the PYRAMID rungs?", k: "pyramid rung height bar inches", a: "30, 60, and 90 in off the floor. The PYRAMID is 94 in wide at the base and its sides lean in at 68°.", r: "2.2.5" },
  { q: "How high are the goals?", k: "goal height tall high middle low opening edge", a: "Bottom edges: LOW 19 in, MIDDLE 88⅝ in, HIGH 104⅛ in. Openings: LOW 29 × 24, MIDDLE 54 × 21, HIGH 54 × 12 in.", r: "2.2.3" },
  { q: "Where are our goals?", k: "where goals location wall end", a: "Your HIGH and MIDDLE goals are above the opponent's alliance wall. Your LOW goal is in a corner at that end.", r: "2.2.3" },
  { q: "Where do robots start?", k: "start starting position begin pyramid", a: "Each robot must start touching its own PYRAMID, fully on the floor, in its STARTING CONFIGURATION.", r: "G05" },
  { q: "How many discs can we preload?", k: "preload start begin how many", a: "3 if your robot touches carpet outside the AUTO ZONE, otherwise 2.", r: "G06" },
  { q: "How many discs can we hold?", k: "hold carry control limit hopper capacity many", a: "4. Each extra disc you control is a FOUL. Pushing or deflecting discs doesn't count as control.", r: "G24" },
  { q: "How does the feeder get discs to us?", k: "feeder human player slot station load", a: "Through the FEEDER SLOTS (12 × 3 in, at 22, 42, and 62 in). In the last 30 seconds they may also throw discs over the FEEDER STATION.", r: "2.2.7, G35" },
  { q: "How big is a disc?", k: "disc size diameter weight frisbee", a: "About 11 in across, 1.4 in tall, and about 180 g.", r: "2.2.10" },
  { q: "How big can our robot be?", k: "robot size big frame perimeter dimensions limit", a: "Frame perimeter up to 112 in, and it must always fit in a 54 in diameter circle.", r: "R03, G23" },
  { q: "How tall can our robot be?", k: "tall height high limit 60 84", a: "84 in max. Away from your AUTO ZONE and PYRAMID, it must be 60 in or shorter.", r: "R03, G22" },
  { q: "How much can our robot weigh?", k: "weight heavy pounds lb", a: "120 lb, not counting the battery or BUMPERS.", r: "R05" },
  { q: "What are the bumper rules?", k: "bumper bumpers height zone", a: "BUMPERS sit 2–10 in off the floor, cover at least 8 in on each side of every outside corner, and weigh 20 lb or less.", r: "R22, R23, R25" },
  { q: "What motors can we use?", k: "motor motors legal allowed cim", a: "Only motor types listed in R32, with a max count each (for example, up to 6 CIMs).", r: "R32" },
  { q: "What's the budget?", k: "cost budget money price dollars", a: "$4,000 total, and no single part over $400.", r: "R11, R12" },
  { q: "Can we cross the center line in AUTO?", k: "center line auto cross half", a: "No. Leaving your starting half in AUTO is a FOUL, or a TECHNICAL FOUL if you contact an opponent.", r: "G19" },
  { q: "Can we play defense on a climber?", k: "defense defend climber pyramid touch opponent", a: "No contact with an opponent touching its PYRAMID or in its LOADING ZONE. Touching their PYRAMID itself is a TECHNICAL FOUL, and a RED CARD if it affects a climb.", r: "G27, G30" },
  { q: "How long can we pin someone?", k: "pin pinning trap hold", a: "5 seconds. Then back off 6 ft and wait 3 seconds before pinning them again.", r: "G31" },
  { q: "How much are fouls worth?", k: "foul penalty technical points", a: "FOUL = 3 points to the opponent. TECHNICAL FOUL = 20 points.", r: "3.1.4" },
  { q: "Do we need belay points?", k: "belay attachment lower safety climb", a: "Yes, at least two on opposite sides near the robot's balance point.", r: "R10" },
  { q: "Who can be in the driver station?", k: "drive team coach driver feeder human how many", a: "One coach, two drivers, and one feeder per team.", r: "G10" },
];

const STOP = new Set(["the", "a", "an", "is", "are", "can", "we", "our", "do", "does", "how", "what", "of", "to", "in", "it", "i", "you", "for", "on", "be", "my", "there", "when", "much", "many"]);

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP.has(word))
    .map((word) => {
      const stem = word.replace(/(ing|es|s|ed)$/, "");

      return stem.length > 1 ? stem : word;
    });
}

function searchKb(query: string) {
  const qw = words(query);

  if (!qw.length) {
    return [];
  }

  return KB.map((entry) => {
    const kw = words(`${entry.k} ${entry.q}`);
    let score = 0;

    for (const w of qw) {
      for (const k of kw) {
        if (k === w) {
          score += 2;
        } else if (w.length > 3 && k.length > 3 && (k.startsWith(w) || w.startsWith(k))) {
          score += 1;
        }
      }
    }

    return { entry, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function TabAsk() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchKb(query), [query]);
  const chips = ["How tall can our robot be?", "How many discs can we hold?", "What counts as each climb level?", "Where are our goals?", "Can we play defense on a climber?"];

  return (
    <Panel title="Ask the Rulebook" hint="Type a question in your own words. Answers come from a built-in summary of the 2013 manual. Tap a rule tag to open that page of the manual.">
      <label className="relative block">
        <span className="sr-only">Ask a rules question</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. how big can our robot be?"
          autoComplete="off"
          className="h-12 w-full rounded-lg border border-input bg-background pr-4 pl-10 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Button key={chip} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setQuery(chip)}>
            {chip}
          </Button>
        ))}
      </div>
      <div aria-live="polite" className="space-y-3">
        {query.trim() &&
          (results.length ? (
            results.map(({ entry }, index) => (
              <div key={entry.q} className={cn("rounded-lg border border-l-4 border-l-primary p-4", index > 0 && "opacity-80")}>
                <p className="font-semibold">{entry.q}</p>
                <p className="mt-1 text-sm leading-6">
                  {entry.a} <Rule refs={entry.r} />
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-lg border p-4 text-sm">
              <p className="font-semibold">No match in the summary.</p>
              Try other words, or search the{" "}
              <a href={MANUAL_URL} target="_blank" rel="noreferrer" className="text-primary underline">
                full manual
              </a>{" "}
              and bring what you find to a mentor.
            </div>
          ))}
      </div>
    </Panel>
  );
}

// ---- Tab: Practice --------------------------------------------------

type GoalKey = "high" | "middle" | "low";

const GOAL_POINTS: Record<GoalKey, { auto: number; teleop: number; label: string }> = {
  high: { auto: 6, teleop: 3, label: "High" },
  middle: { auto: 4, teleop: 2, label: "Middle" },
  low: { auto: 2, teleop: 1, label: "Low" },
};

const CLIMB_POINTS = [0, 10, 20, 30];

function MatchEstimator() {
  const [autoDiscs, setAutoDiscs] = useState(3);
  const [autoGoal, setAutoGoal] = useState<GoalKey>("high");
  const [goal, setGoal] = useState<GoalKey>("high");
  const [perCycle, setPerCycle] = useState(4);
  const [cycle, setCycle] = useState(16);
  const [accuracy, setAccuracy] = useState(75);
  const [level, setLevel] = useState(1);
  const [climbTime, setClimbTime] = useState(8);
  const [climbSuccess, setClimbSuccess] = useState(90);

  const hit = accuracy / 100;
  const autoPts = autoDiscs * GOAL_POINTS[autoGoal].auto * hit;
  const shootTime = 120 - (level > 0 ? climbTime + 2 : 0);
  const cycles = Math.max(0, Math.floor(shootTime / cycle));
  const teleopPts = cycles * perCycle * GOAL_POINTS[goal].teleop * hit;
  const climbPts = CLIMB_POINTS[level] * (climbSuccess / 100);
  const total = autoPts + teleopPts + climbPts;

  // Same robot, but it skips the climb and keeps shooting.
  const noClimbCycles = Math.floor(120 / cycle);
  const noClimbTotal = autoPts + noClimbCycles * perCycle * GOAL_POINTS[goal].teleop * hit;
  const pps = (perCycle * GOAL_POINTS[goal].teleop * hit) / cycle;

  return (
    <Lab title="2013 match estimator" caption="One robot, one match, real 2013 point values. Cycle time means a full trip: load at your feeder, cross the field, shoot, come back. Climbing adds 2 s to line up.">
      <div className="grid gap-5 md:grid-cols-2">
        <Slider id="ua-auto" label="AUTO discs fired" value={autoDiscs} min={0} max={7} onChange={setAutoDiscs} />
        <Choice<GoalKey>
          label="AUTO target"
          value={autoGoal}
          options={(Object.keys(GOAL_POINTS) as GoalKey[]).map((key) => ({ value: key, label: GOAL_POINTS[key].label }))}
          onChange={setAutoGoal}
        />
        <Choice<GoalKey>
          label="TELEOP target"
          value={goal}
          options={(Object.keys(GOAL_POINTS) as GoalKey[]).map((key) => ({ value: key, label: GOAL_POINTS[key].label }))}
          onChange={setGoal}
        />
        <Slider id="ua-per" label="Discs per cycle" value={perCycle} min={1} max={4} onChange={setPerCycle} format={(v) => `${v} (max 4, G24)`} />
        <Slider id="ua-cycle" label="Seconds per cycle" value={cycle} min={6} max={40} onChange={setCycle} format={(v) => `${v} s`} />
        <Slider id="ua-acc" label="Shot accuracy" value={accuracy} min={20} max={100} step={5} onChange={setAccuracy} format={(v) => `${v}%`} />
        <Choice<string>
          label="Climb"
          value={String(level)}
          options={[
            { value: "0", label: "None" },
            { value: "1", label: "Level 1" },
            { value: "2", label: "Level 2" },
            { value: "3", label: "Level 3" },
          ]}
          onChange={(value) => {
            const next = Number(value);
            setLevel(next);
            setClimbTime([0, 6, 15, 28][next]);
          }}
        />
        {level > 0 && (
          <>
            <Slider id="ua-ct" label="Climb time" value={climbTime} min={3} max={60} onChange={setClimbTime} format={(v) => `${v} s`} />
            <Slider id="ua-cs" label="Climb success rate" value={climbSuccess} min={0} max={100} step={5} onChange={setClimbSuccess} format={(v) => `${v}%`} />
          </>
        )}
      </div>
      <Readouts
        items={[
          { label: "AUTO", value: autoPts.toFixed(1) },
          { label: "TELEOP", value: teleopPts.toFixed(1), note: `${cycles} cycles · ${pps.toFixed(2)} pts/s` },
          { label: "Climb", value: climbPts.toFixed(1) },
          { label: "Expected total", value: total.toFixed(0), tone: total >= 90 ? "good" : total >= 55 ? "warn" : "bad" },
        ]}
      />
      {level > 0 && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          The same robot skipping the climb and shooting the whole time would expect about {noClimbTotal.toFixed(0)} points.
        </p>
      )}
      <Goals
        goals={[
          { label: "Find a plan that expects 90 points or more", met: total >= 90 },
          { label: "Find a Level 3 climb that scores less than skipping the climb", met: level === 3 && total < noClimbTotal },
          { label: "Find a LOW GOAL plan that beats a 40%-accurate HIGH GOAL plan at the same speed", met: goal === "low" && teleopPts > cycles * perCycle * 3 * 0.4 },
        ]}
      />
    </Lab>
  );
}

type ReqKind = "requirement" | "mechanism";

const UNKNOWNS = [
  {
    unknown: "Can we hit the HIGH GOAL from the back of our PYRAMID?",
    variable: "Shooter wheel speed (RPM) and launch angle",
    measure: "Discs in a high-goal-sized target out of 10, from about 18 ft",
    success: "8 of 10 at one setting, with no retuning between shots",
  },
  {
    unknown: "Does a disc fed through a FEEDER SLOT land flat in our hopper?",
    variable: "Hopper ramp angle and slot height (22, 42, or 62 in)",
    measure: "Discs that end up flat and indexed out of 10 feeds",
    success: "10 of 10, at least 4 seconds faster than a floor pickup",
  },
  {
    unknown: "Can a hook grab the 30 in rung and lift us to Level 1, then Level 2?",
    variable: "Hook shape and arm length",
    measure: "Seconds from touching the PYRAMID to Level 2, and whether it ever slips",
    success: "Under 15 s, 5 of 5 tries, staying inside the 54 in circle",
  },
  {
    unknown: "Can we pick discs off the carpet while driving?",
    variable: "Roller height above carpet and roller speed",
    measure: "Discs picked up per pass out of 10, at a slow walk",
    success: "8 of 10 without jamming",
  },
];

function TabPractice() {
  return (
    <div className="space-y-6">
      <Panel title="1. Game analysis" hint="Do this before anyone names a mechanism.">
        <ol className="grid list-decimal gap-1.5 pl-5 text-sm leading-6">
          <li>Write a one-paragraph summary of ULTIMATE ASCENT: how a match starts, what scores, how it ends. Don't look at anyone else's.</li>
          <li>List every way to score, its points, and when it counts. Check yourself against the Key Numbers tab.</li>
          <li>List every rule that limits the robot (size, height, disc count, climbing). Cite each rule number.</li>
          <li>Use the estimator below to find which actions are worth the most points per second.</li>
        </ol>
        <MatchEstimator />
        <Takeaway>Expected points = points × how often it works. A reliable low-goal robot can beat a high-goal robot that misses.</Takeaway>
      </Panel>

      <Panel title="2. Design decisions" hint="Pick a strategy, then write it down as requirements: what the robot must do and how well, without saying how.">
        <Sorter<ReqKind>
          buckets={[
            { value: "requirement", label: "Requirement" },
            { value: "mechanism", label: "Mechanism (too early)" },
          ]}
          items={[
            { text: "Scores 4 discs in the HIGH GOAL from the back of the PYRAMID in under 5 s", answer: "requirement", why: "It says what and how fast, and leaves the shooter design open." },
            { text: "Uses a two-wheel shooter with 8 in wheels", answer: "mechanism", why: "That's a solution. Prototype it against other launchers first." },
            { text: "Stays under 60 in tall while crossing the field", answer: "requirement", why: "A limit straight from G22. Every design must meet it." },
            { text: "Reaches Level 2 within 15 s of touching the PYRAMID", answer: "requirement", why: "Measurable, and any climber could meet it." },
            { text: "Climbs with a telescoping hook arm", answer: "mechanism", why: "A design choice. What must the climber reach, and how fast?" },
            { text: "Takes discs from the FEEDER SLOT and holds up to 4", answer: "requirement", why: "Describes the job. Many hopper designs could do it." },
          ]}
        />
        <Think>
          the big 2013 decisions were: floor pickup or feeder only, HIGH or LOW goal, and how high to climb. A floor pickup saves trips but costs
          weight, space, and build time. Which would your team choose with 6 weeks and your current skills?
        </Think>
        <p className="text-sm">
          Next: compare your top ideas with a weighted decision matrix. See the{" "}
          <Link to="/training/labs/game-breakdown" className="text-primary underline">
            Break down a game
          </Link>{" "}
          lesson for the method.
        </p>
      </Panel>

      <Panel title="3. Prototype planning" hint="A prototype is an experiment. Each one answers one question. Here are example test cards for this game.">
        <div className="grid gap-3 md:grid-cols-2">
          {UNKNOWNS.map((item) => (
            <div key={item.unknown} className="rounded-lg border bg-card p-4 text-sm">
              <p className="font-semibold">{item.unknown}</p>
              <dl className="mt-2 grid gap-1 leading-6">
                <div>
                  <dt className="inline font-medium text-muted-foreground">Change: </dt>
                  <dd className="inline">{item.variable}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-muted-foreground">Measure: </dt>
                  <dd className="inline">{item.measure}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-muted-foreground">Success: </dt>
                  <dd className="inline">{item.success}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        <p className="text-sm">
          Write your own test card before you cut anything. The{" "}
          <Link to="/training/labs/prototyping" className="text-primary underline">
            Prototype like a scientist
          </Link>{" "}
          lesson walks through it.
        </p>
      </Panel>

      <Panel title="4. Integrate: master sketch check" rules="R03, G22, G23, R25" hint="Before you combine prototypes into one Onshape master sketch or test robot, check the whole package against the rules.">
        <EnvelopeCheck />
      </Panel>
    </div>
  );
}

function EnvelopeCheck() {
  const [length, setLength] = useState(28);
  const [width, setWidth] = useState(26);
  const [bumper, setBumper] = useState(3.5);
  const [extend, setExtend] = useState(0);
  const [stowed, setStowed] = useState(52);
  const [cruise, setCruise] = useState(58);
  const [maxHeight, setMaxHeight] = useState(80);
  const [weight, setWeight] = useState(112);

  const perimeter = 2 * (length + width);
  const outerL = length + 2 * bumper + extend;
  const outerW = width + 2 * bumper;
  const diagonal = Math.sqrt(outerL ** 2 + outerW ** 2);

  const checks = [
    { label: `Frame perimeter ${perimeter.toFixed(0)} in ≤ 112 in (R03)`, met: perimeter <= 112 },
    { label: `Widest diagonal ${diagonal.toFixed(1)} in ≤ 54 in, with bumpers and extension (R03, G23)`, met: diagonal <= 54 },
    { label: `Starting height ${stowed} in ≤ 84 in (R03)`, met: stowed <= 84 },
    { label: `Height while crossing the field ${cruise} in ≤ 60 in (G22)`, met: cruise <= 60 },
    { label: `Tallest height ${maxHeight} in ≤ 84 in, only at your PYRAMID or in your AUTO ZONE (G22)`, met: maxHeight <= 84 },
    { label: `Weight ${weight} lb ≤ 120 lb, without battery and bumpers (R05)`, met: weight <= 120 },
  ];

  return (
    <Lab title="Robot envelope" caption="The 54 in check uses the diagonal of the outer rectangle, so it is a quick estimate. Measure the real shape in your CAD before you commit.">
      <div className="grid gap-5 md:grid-cols-2">
        <Slider id="env-l" label="Frame length" value={length} min={18} max={40} onChange={setLength} format={(v) => `${v} in`} />
        <Slider id="env-w" label="Frame width" value={width} min={18} max={40} onChange={setWidth} format={(v) => `${v} in`} />
        <Slider id="env-b" label="Bumper thickness" value={bumper} min={2} max={5} step={0.5} onChange={setBumper} format={(v) => `${v} in`} />
        <Slider id="env-e" label="Extension past bumpers (one side)" value={extend} min={0} max={24} onChange={setExtend} format={(v) => `${v} in`} />
        <Slider id="env-s" label="Starting height" value={stowed} min={20} max={100} onChange={setStowed} format={(v) => `${v} in`} />
        <Slider id="env-c" label="Height while crossing the field" value={cruise} min={20} max={100} onChange={setCruise} format={(v) => `${v} in`} />
        <Slider id="env-m" label="Tallest height (shooting or climbing)" value={maxHeight} min={20} max={110} onChange={setMaxHeight} format={(v) => `${v} in`} />
        <Slider id="env-wt" label="Estimated weight" value={weight} min={60} max={150} onChange={setWeight} format={(v) => `${v} lb`} />
      </div>
      <Goals goals={checks} />
    </Lab>
  );
}

// ---- Tab: Quiz ------------------------------------------------------

const QUIZ: { q: string; options: string[]; answer: number; why: string; rules: string }[] = [
  { q: "How long is AUTO in ULTIMATE ASCENT?", options: ["10 seconds", "15 seconds", "20 seconds", "30 seconds"], answer: 1, why: "AUTO is the first 15 seconds of a 2:15 match.", rules: "3.1.2" },
  { q: "A disc goes in the HIGH GOAL during AUTO. How many points?", options: ["3", "4", "5", "6"], answer: 3, why: "HIGH is 6 in AUTO and 3 in TELEOP.", rules: "3.1.5.1" },
  { q: "Where are your alliance's HIGH and MIDDLE goals?", options: ["Above your own driver station", "Above the opponent's alliance wall", "On top of your PYRAMID", "On the side walls"], answer: 1, why: "You load at your own wall and shoot at goals over the opponent's wall.", rules: "2.2.3" },
  { q: "Which discs score in your PYRAMID GOAL?", options: ["Any disc", "White discs only", "Your alliance's colored discs only", "Opponent colored discs"], answer: 2, why: "Only discs that match the pyramid's color, 5 points each, TELEOP only.", rules: "3.1.5.1" },
  { q: "What's the most discs a robot may control at once?", options: ["2", "3", "4", "No limit"], answer: 2, why: "4. Each extra disc is a FOUL.", rules: "G24" },
  { q: "How tall may a robot be while crossing the middle of the field?", options: ["54 in", "60 in", "84 in", "No limit"], answer: 1, why: "60 in, unless it's in its AUTO ZONE or touching its PYRAMID, where 84 in is allowed.", rules: "G22" },
  { q: "The robot must always fit inside a circle of what diameter?", options: ["36 in", "48 in", "54 in", "60 in"], answer: 2, why: "54 in, including anything that extends.", rules: "R03, G23" },
  { q: "What's the max frame perimeter?", options: ["100 in", "112 in", "120 in", "128 in"], answer: 1, why: "112 in, e.g. 28 × 28 in.", rules: "R03" },
  { q: "A robot's lowest point is above the 30 in rung but below the 60 in rung. What level?", options: ["Level 1", "Level 2", "Level 3", "No climb"], answer: 1, why: "Level 2: 20 points.", rules: "3.1.5.2" },
  { q: "Can a robot reach straight from the floor to the 60 in rung and skip Level 2?", options: ["Yes", "No, levels must go in order, touching no more than two at once", "Only in AUTO", "Only with a belay"], answer: 1, why: "A climb is sequential and may never touch more than two levels at once.", rules: "3.1.5.2" },
  { q: "How many points does a TECHNICAL FOUL give the opponent?", options: ["3", "5", "10", "20"], answer: 3, why: "FOUL = 3, TECHNICAL FOUL = 20.", rules: "3.1.4" },
  { q: "You touch an opponent who is climbing their PYRAMID. What happens?", options: ["Nothing, defense is legal", "A FOUL", "A TECHNICAL FOUL, and they can get Level 3 points", "You lose your climb"], answer: 2, why: "Robots touching their PYRAMID are protected.", rules: "G30" },
  { q: "How many discs may a robot preload if it starts outside its AUTO ZONE?", options: ["1", "2", "3", "4"], answer: 2, why: "3 outside the AUTO ZONE, 2 inside it.", rules: "G06" },
  { q: "In AUTO, a robot drives across the CENTER LINE. What happens?", options: ["Nothing", "A FOUL (TECHNICAL FOUL if it hits someone)", "It's disabled", "Its discs don't count"], answer: 1, why: "Robots must stay on their starting half in AUTO.", rules: "G19" },
  { q: "What's the max robot weight?", options: ["100 lb", "120 lb with battery", "120 lb without battery and bumpers", "150 lb"], answer: 2, why: "120 lb, not counting battery and BUMPERS.", rules: "R05" },
];

function shuffled(count: number) {
  const order = Array.from({ length: count }, (_, index) => index);

  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order;
}

function TabQuiz() {
  const [order, setOrder] = useState(() => shuffled(QUIZ.length));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  function restart() {
    setOrder(shuffled(QUIZ.length));
    setIndex(0);
    setScore(0);
    setPicked(null);
  }

  if (index >= order.length) {
    const percent = Math.round((score / order.length) * 100);

    return (
      <Panel title="Quiz complete">
        <Readouts
          items={[
            { label: "Correct", value: `${score} / ${order.length}` },
            { label: "Score", value: `${percent}%`, tone: percent >= 90 ? "good" : percent >= 70 ? "warn" : "bad" },
          ]}
        />
        <p className="text-sm">{percent >= 90 ? "Rules expert." : percent >= 70 ? "Solid. Review the ones you missed." : "Re-read Key Numbers and Robot Rules, then try again."}</p>
        <Button type="button" variant="cta" onClick={restart}>
          Try again
        </Button>
      </Panel>
    );
  }

  const item = QUIZ[order[index]];

  function choose(option: number) {
    if (picked !== null) {
      return;
    }

    setPicked(option);

    if (option === item.answer) {
      setScore((value) => value + 1);
    }
  }

  return (
    <Panel title="Rules quiz" hint={`Question ${index + 1} of ${order.length} · Score ${score}`}>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${(index / order.length) * 100}%` }} />
      </div>
      <p className="text-lg font-semibold">{item.q}</p>
      <div className="grid gap-2">
        {item.options.map((option, optionIndex) => {
          const isAnswer = picked !== null && optionIndex === item.answer;
          const isWrong = picked === optionIndex && optionIndex !== item.answer;

          return (
            <button
              key={option}
              type="button"
              disabled={picked !== null}
              onClick={() => choose(optionIndex)}
              className={cn(
                "rounded-lg border-2 px-4 py-3 text-left text-base transition-colors",
                picked === null && "hover:border-primary",
                isAnswer && "border-success bg-emerald-50 dark:bg-emerald-950/30",
                isWrong && "border-destructive bg-rose-50 dark:bg-rose-950/30",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div key={index} className={cn("space-y-3", picked === item.answer ? "animate-rise" : "animate-shake")} aria-live="polite">
          <p className="rounded-lg bg-muted px-4 py-3 text-sm leading-6">
            <span className={cn("font-semibold", picked === item.answer ? "text-success" : "text-destructive")}>
              {picked === item.answer ? "Correct! " : "Not quite. "}
            </span>
            {item.why} <Rule refs={item.rules} />
          </p>
          <Button
            type="button"
            variant="cta"
            onClick={() => {
              setIndex((value) => value + 1);
              setPicked(null);
            }}
          >
            {index + 1 < order.length ? "Next question" : "See results"}
          </Button>
        </div>
      )}
    </Panel>
  );
}

// ---- Page -----------------------------------------------------------

const TABS = [
  { id: "game", label: "The Game", render: () => <TabGame /> },
  { id: "numbers", label: "Key Numbers", render: () => <TabNumbers /> },
  { id: "robot", label: "Robot Rules", render: () => <TabRobot /> },
  { id: "watch", label: "Watch Out", render: () => <TabWatch /> },
  { id: "ask", label: "Ask the Rulebook", render: () => <TabAsk /> },
  { id: "practice", label: "Practice", render: () => <TabPractice /> },
  { id: "quiz", label: "Quiz", render: () => <TabQuiz /> },
];

export function UltimateAscentKickoffPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const hash = location.hash.replace("#", "");
  const active = TABS.find((tab) => tab.id === hash) ?? TABS[0];

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/training" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        ← Learning
      </Link>
      <PageHeading
        title="Mock kickoff: ULTIMATE ASCENT (2013)"
        description="A rulebook cheat sheet for our offseason game. Learn the game, then practice game analysis, design decisions, prototype planning, and checking a master sketch."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={MANUAL_URL} target="_blank" rel="noreferrer">
                Game Manual <ExternalLink aria-hidden />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={UPDATES_URL} target="_blank" rel="noreferrer">
                Team Updates <ExternalLink aria-hidden />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={QA_URL} target="_blank" rel="noreferrer">
                Q&amp;A <ExternalLink aria-hidden />
              </a>
            </Button>
          </>
        }
      />

      <nav aria-label="Cheat sheet sections" className="sticky top-14 z-30 -mx-4 mb-6 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-2">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={tab.id === active.id ? "page" : undefined}
              onClick={() => {
                navigate({ hash: tab.id });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                tab.id === active.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div key={active.id} className="animate-rise">
        {active.render()}
      </div>

      <p className="mt-10 border-t pt-4 text-xs leading-5 text-muted-foreground">
        A summary of the 2013 FRC ULTIMATE ASCENT Game Manual for Robot Dolphins training. Rule tags open the official manual. The manual and
        Team Updates always win: if something here disagrees, trust the manual.
      </p>
    </div>
  );
}
