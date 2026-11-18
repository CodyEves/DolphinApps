import { ChevronDown, Eraser, Pause, Play, Plus, SkipBack, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

import { FIELD_VIEW, FieldDrawing, toScreen } from "@/components/learning/field-2013";
import type { Orientation } from "@/components/learning/field-2013";
import { Goals } from "@/components/learning/lab-ui";
import { MOTORS, SWERVE_OPTIONS, USABLE_FRACTION, drivetrainPerformance, freeSpeedFtPerS } from "@/components/learning/swerve-options";
import type { MotorKey } from "@/components/learning/swerve-options";
import { cn } from "@/lib/utils";

/*
 * Drive-time simulator for the 2013 field.
 *
 * Students tap to drop waypoints, drag them around, and see how long a
 * holonomic (swerve / mecanum) robot takes to drive the path with a given top
 * speed and acceleration. Holonomic means the robot can move in any direction
 * without turning first, so only the path's distance and its corners matter.
 *
 * Model (simple on purpose, so students can reason about it):
 * - Speed ramps up and down at a constant acceleration (a trapezoid profile).
 * - The robot starts and ends each trip stopped, and stops at any waypoint
 *   with a wait time.
 * - With "slow for corners" on, the robot can carry at most
 *   top speed × cos(turn angle ÷ 2) through a waypoint: full speed going
 *   straight, about 70% through a 90° turn, a full stop to reverse.
 */

const FT = 12; // field drawing units per foot
const FIELD_L = 54;
const FIELD_W = 27;
const ROBOT_FT = 34 / 12; // 28 in frame + bumpers
const HALF = ROBOT_FT / 2;

type Waypoint = { x: number; y: number; wait: number };

// Pyramid footprints in feet (94 in square), red is the one red scores at.
const PYRAMIDS = [
  { name: "red", x0: 36, x1: 36 + 94 / 12, y0: 13.5 - 47 / 12, y1: 13.5 + 47 / 12 },
  { name: "blue", x0: 18 - 94 / 12, x1: 18, y0: 13.5 - 47 / 12, y1: 13.5 + 47 / 12 },
];

const PRESETS: { label: string; loop: boolean; points: Waypoint[] }[] = [
  {
    label: "Feeder ↔ shot",
    loop: true,
    points: [
      { x: 4, y: 24, wait: 3 },
      { x: 20, y: 21.5, wait: 0 },
      { x: 33.5, y: 16.5, wait: 2 },
    ],
  },
  {
    label: "Full field ↔ low goal",
    loop: true,
    points: [
      { x: 4, y: 24, wait: 3 },
      { x: 50, y: 24, wait: 1.5 },
    ],
  },
  {
    label: "Dodge traffic",
    loop: false,
    points: [
      { x: 4, y: 24, wait: 0 },
      { x: 20, y: 22, wait: 0 },
      { x: 26, y: 4, wait: 0 },
      { x: 33.5, y: 14, wait: 2 },
    ],
  },
];

// ---- Motion profile -------------------------------------------------

type Phase =
  | { kind: "wait"; t0: number; dur: number; x: number; y: number }
  | { kind: "move"; t0: number; dur: number; ax: number; ay: number; ux: number; uy: number; s0: number; v0: number; a: number };

type Profile = {
  phases: Phase[];
  total: number;
  driveTime: number;
  waitTime: number;
  distance: number;
  peak: number;
};

function segmentPhases(L: number, v0: number, v1: number, vmax: number, a: number) {
  const vp = Math.max(Math.min(vmax, Math.sqrt(a * L + (v0 * v0 + v1 * v1) / 2)), Math.max(v0, v1));
  const d1 = Math.max(0, (vp * vp - v0 * v0) / (2 * a));
  const d3 = Math.max(0, (vp * vp - v1 * v1) / (2 * a));
  const d2 = Math.max(0, L - d1 - d3);

  return [
    { s0: 0, v0, a, dur: (vp - v0) / a },
    { s0: d1, v0: vp, a: 0, dur: vp > 0 ? d2 / vp : 0 },
    { s0: d1 + d2, v0: vp, a: -a, dur: (vp - v1) / a },
  ].filter((part) => part.dur > 1e-6);
}

function buildProfile(points: Waypoint[], loop: boolean, vmax: number, accel: number, cornerSlow: boolean): Profile {
  const empty = { phases: [], total: 0, driveTime: 0, waitTime: 0, distance: 0, peak: 0 };

  if (points.length === 0) {
    return empty;
  }

  // Drop repeated points so every segment has a direction.
  const nodes: Waypoint[] = [];

  for (const point of loop && points.length > 1 ? [...points, { ...points[0], wait: 0 }] : points) {
    const last = nodes[nodes.length - 1];

    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.05) {
      nodes.push(point);
    }
  }

  const n = nodes.length - 1;
  const lengths: number[] = [];
  const dirs: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    const dx = nodes[i + 1].x - nodes[i].x;
    const dy = nodes[i + 1].y - nodes[i].y;
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    dirs.push([dx / len, dy / len]);
  }

  // Speed cap at each node.
  const cap = nodes.map((node, j) => {
    if (j === 0 || j === n || node.wait > 0) {
      return 0;
    }

    if (!cornerSlow) {
      return vmax;
    }

    const cosTurn = dirs[j - 1][0] * dirs[j][0] + dirs[j - 1][1] * dirs[j][1];

    return vmax * Math.sqrt(Math.max(0, (1 + cosTurn) / 2));
  });

  // Forward pass (can we speed up enough?) then backward pass (can we stop in time?).
  const v = [...cap];
  v[0] = 0;

  for (let i = 0; i < n; i++) {
    v[i + 1] = Math.min(v[i + 1], Math.sqrt(v[i] * v[i] + 2 * accel * lengths[i]));
  }

  for (let i = n - 1; i >= 0; i--) {
    v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * accel * lengths[i]));
  }

  const phases: Phase[] = [];
  let t = 0;
  let driveTime = 0;
  let waitTime = 0;
  let peak = 0;

  const addWait = (node: Waypoint) => {
    if (node.wait > 0) {
      phases.push({ kind: "wait", t0: t, dur: node.wait, x: node.x, y: node.y });
      t += node.wait;
      waitTime += node.wait;
    }
  };

  addWait(nodes[0]);

  for (let i = 0; i < n; i++) {
    for (const part of segmentPhases(lengths[i], v[i], v[i + 1], vmax, accel)) {
      phases.push({ kind: "move", t0: t, dur: part.dur, ax: nodes[i].x, ay: nodes[i].y, ux: dirs[i][0], uy: dirs[i][1], s0: part.s0, v0: part.v0, a: part.a });
      t += part.dur;
      driveTime += part.dur;
      peak = Math.max(peak, part.v0, part.v0 + part.a * part.dur);
    }

    // In a round trip the start's wait is already counted at the beginning.
    if (!(loop && i === n - 1)) {
      addWait(nodes[i + 1]);
    }
  }

  return { phases, total: t, driveTime, waitTime, distance: lengths.reduce((sum, len) => sum + len, 0), peak };
}

function stateAt(profile: Profile, time: number, fallback: Waypoint | undefined) {
  if (!profile.phases.length) {
    return fallback ? { x: fallback.x, y: fallback.y, v: 0 } : null;
  }

  const t = Math.min(Math.max(time, 0), profile.total);
  const phase = profile.phases.find((item) => t <= item.t0 + item.dur + 1e-9) ?? profile.phases[profile.phases.length - 1];
  const local = Math.min(phase.dur, Math.max(0, t - phase.t0));

  if (phase.kind === "wait") {
    return { x: phase.x, y: phase.y, v: 0 };
  }

  const s = phase.s0 + phase.v0 * local + 0.5 * phase.a * local * local;

  return { x: phase.ax + phase.ux * s, y: phase.ay + phase.uy * s, v: phase.v0 + phase.a * local };
}

function crossesPyramid(points: Waypoint[], loop: boolean) {
  const pts = loop && points.length > 2 ? [...points, points[0]] : points;

  for (let i = 0; i < pts.length - 1; i++) {
    for (const box of PYRAMIDS) {
      // Liang–Barsky clip against the pyramid grown by half the robot.
      const x0 = box.x0 - HALF;
      const x1 = box.x1 + HALF;
      const y0 = box.y0 - HALF;
      const y1 = box.y1 + HALF;
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      let lo = 0;
      let hi = 1;
      let hit = true;

      for (const [p, q] of [
        [-dx, pts[i].x - x0],
        [dx, x1 - pts[i].x],
        [-dy, pts[i].y - y0],
        [dy, y1 - pts[i].y],
      ]) {
        if (p === 0) {
          if (q < 0) {
            hit = false;
          }
        } else {
          const r = q / p;

          if (p < 0) {
            lo = Math.max(lo, r);
          } else {
            hi = Math.min(hi, r);
          }
        }
      }

      if (hit && lo <= hi) {
        return box.name;
      }
    }
  }

  return null;
}

// ---- Units ----------------------------------------------------------

type Units = "imperial" | "metric";

const M_PER_FT = 0.3048;

function fmtDist(ft: number, units: Units) {
  return units === "metric" ? `${(ft * M_PER_FT).toFixed(1)} m` : `${ft.toFixed(1)} ft`;
}

function fmtSpeed(ftPerS: number, units: Units, digits = 1) {
  return units === "metric" ? `${(ftPerS * M_PER_FT).toFixed(digits + 1)} m/s` : `${ftPerS.toFixed(digits)} ft/s`;
}

function fmtAccel(ftPerS2: number, units: Units) {
  return units === "metric" ? `${(ftPerS2 * M_PER_FT).toFixed(1)} m/s²` : `${ftPerS2.toFixed(0)} ft/s²`;
}

function fmtWeight(lb: number, units: Units) {
  return units === "metric" ? `${(lb * 0.4536).toFixed(0)} kg` : `${lb} lb`;
}

// ---- Field canvas ---------------------------------------------------

function clampPoint(x: number, y: number) {
  return {
    x: Math.round(Math.min(FIELD_L - HALF, Math.max(HALF, x)) * 4) / 4,
    y: Math.round(Math.min(FIELD_W - HALF, Math.max(HALF, y)) * 4) / 4,
  };
}

function screenToField(o: Orientation, sx: number, sy: number) {
  const fx = o === "landscape" ? sx - 36 : 648 - (sy - 34);
  const fy = o === "landscape" ? sy - 24 : sx - 38;

  return clampPoint(fx / FT, fy / FT);
}

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM();

  if (!matrix) {
    return null;
  }

  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());

  return { x: point.x, y: point.y };
}

type CanvasProps = {
  o: Orientation;
  points: Waypoint[];
  loop: boolean;
  selected: number | null;
  addMode: boolean;
  playing: boolean;
  robot: { x: number; y: number } | null;
  onAdd: (point: { x: number; y: number }) => void;
  onInsert: (index: number, point: { x: number; y: number }) => void;
  onMove: (index: number, point: { x: number; y: number }) => void;
  onSelect: (index: number | null) => void;
  onDelete: (index: number) => void;
};

function FieldCanvas({ o, points, loop, selected, addMode, playing, robot, onAdd, onInsert, onMove, onSelect, onDelete }: CanvasProps) {
  const view = FIELD_VIEW[o];
  const tap = useRef<{ x: number; y: number; id: number } | null>(null);
  const drag = useRef<{ index: number; id: number; x: number; y: number; moved: boolean; inserted: boolean } | null>(null);
  const at = (point: { x: number; y: number }) => toScreen(o, point.x * FT, point.y * FT);
  const path = points.map((point) => at(point).join(",")).join(" ");
  const robotPx = ROBOT_FT * FT;

  // A "+" in the middle of every segment long enough to hold one. Dragging it splits the segment.
  const segments =
    points.length > 1 ? points.map((point, i) => ({ a: point, b: points[i + 1] ?? (loop && points.length > 2 ? points[0] : null), insertAt: i + 1 })) : [];
  const mids = segments
    .filter((seg): seg is { a: Waypoint; b: Waypoint; insertAt: number } => seg.b !== null && Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) > 4)
    .map((seg) => ({ insertAt: seg.insertAt, x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 }));

  function startDrag(event: PointerEvent<SVGGElement>, index: number, inserted: boolean) {
    event.stopPropagation();
    tap.current = null;
    drag.current = { index, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, inserted };
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
  }

  function handleDown(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current && addMode) {
      tap.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }
  }

  function handleMove(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;

    if (!current || current.id !== event.pointerId) {
      return;
    }

    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) {
      return;
    }

    current.moved = true;
    const svgPoint = toSvgPoint(event.currentTarget, event.clientX, event.clientY);

    if (svgPoint) {
      onMove(current.index, screenToField(o, svgPoint.x, svgPoint.y));
    }
  }

  function handleUp(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;

    if (current && current.id === event.pointerId) {
      if (!current.moved && !current.inserted) {
        onSelect(selected === current.index ? null : current.index);
      }

      drag.current = null;
      return;
    }

    const start = tap.current;
    tap.current = null;

    if (addMode && start && start.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) {
      const svgPoint = toSvgPoint(event.currentTarget, event.clientX, event.clientY);

      if (svgPoint) {
        onAdd(screenToField(o, svgPoint.x, svgPoint.y));
      }
    }
  }

  function handleKey(event: KeyboardEvent<SVGGElement>, index: number) {
    const step = event.shiftKey ? 2 : 0.5;
    const point = points[index];
    // Arrow keys move in screen directions, whichever way the field is drawn.
    const moves: Record<string, [number, number]> =
      o === "landscape"
        ? { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
        : { ArrowLeft: [0, -step], ArrowRight: [0, step], ArrowUp: [step, 0], ArrowDown: [-step, 0] };

    if (moves[event.key]) {
      event.preventDefault();
      onMove(index, clampPoint(point.x + moves[event.key][0], point.y + moves[event.key][1]));
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDelete(index);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(selected === index ? null : index);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${view.w} ${view.h}`}
      role="group"
      aria-label={addMode ? "Field. Tap to add a waypoint at the end of the path." : "Field. Drag waypoints to move them."}
      // pan-y keeps the page scrollable on phones; dragging a waypoint captures the pointer instead.
      className={cn(
        "touch-pan-y select-none",
        addMode && "cursor-crosshair",
        o === "landscape" ? "hidden w-full sm:block" : "mx-auto block w-full max-w-[420px] sm:hidden",
      )}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={() => {
        tap.current = null;
        drag.current = null;
      }}
    >
      <FieldDrawing o={o} quiet />

      {points.length > 1 && <polyline points={path} fill="none" className="stroke-primary" strokeWidth={3} strokeLinejoin="round" />}
      {loop && points.length > 1 && (
        <line
          x1={at(points[points.length - 1])[0]}
          y1={at(points[points.length - 1])[1]}
          x2={at(points[0])[0]}
          y2={at(points[0])[1]}
          className="stroke-primary"
          strokeWidth={3}
          strokeDasharray="8 6"
          opacity={0.6}
        />
      )}

      {!playing &&
        mids.map((mid) => {
          const [cx, cy] = at(mid);

          return (
            <g
              key={`mid-${mid.insertAt}`}
              className="cursor-copy touch-none"
              aria-hidden
              onPointerDown={(event) => {
                onInsert(mid.insertAt, clampPoint(mid.x, mid.y));
                startDrag(event, mid.insertAt, true);
              }}
            >
              <circle cx={cx} cy={cy} r={18} fill="transparent" />
              <circle cx={cx} cy={cy} r={8} className="fill-card stroke-primary/70" strokeWidth={2} strokeDasharray="3 2" />
              <path d={`M${cx - 4} ${cy}h8M${cx} ${cy - 4}v8`} className="stroke-primary" strokeWidth={2} strokeLinecap="round" />
            </g>
          );
        })}

      {robot && (
        <rect
          x={at(robot)[0] - robotPx / 2}
          y={at(robot)[1] - robotPx / 2}
          width={robotPx}
          height={robotPx}
          rx={5}
          className="pointer-events-none fill-primary/25 stroke-rose-600 dark:stroke-rose-400"
          strokeWidth={4}
        />
      )}

      {points.map((point, index) => {
        const [cx, cy] = at(point);
        const isSelected = selected === index;

        return (
          <g
            key={index}
            role="button"
            tabIndex={0}
            aria-label={`Waypoint ${index + 1}${point.wait ? `, wait ${point.wait} seconds` : ""}. Arrow keys move it, Delete removes it.`}
            aria-pressed={isSelected}
            className="cursor-grab touch-none outline-none [&:focus-visible>circle:nth-child(2)]:stroke-ring"
            onKeyDown={(event) => handleKey(event, index)}
            onPointerDown={(event) => startDrag(event, index, false)}
          >
            {/* Big invisible hit area for fingers */}
            <circle cx={cx} cy={cy} r={22} fill="transparent" />
            <circle cx={cx} cy={cy} r={12} className={cn(isSelected ? "fill-primary stroke-primary-foreground" : "fill-card stroke-primary")} strokeWidth={3} />
            <text
              x={cx}
              y={cy}
              dy="0.35em"
              textAnchor="middle"
              className={cn("pointer-events-none text-[12px] font-bold", isSelected ? "fill-primary-foreground" : "fill-primary")}
            >
              {index + 1}
            </text>
            {point.wait > 0 && (
              <g className="pointer-events-none">
                <rect x={cx + 10} y={cy - 26} width={30} height={16} rx={8} className="fill-cta" />
                <text x={cx + 25} y={cy - 18} dy="0.35em" textAnchor="middle" className="fill-white text-[10px] font-bold">
                  {point.wait}s
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---- Small controls -------------------------------------------------

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md font-medium whitespace-nowrap transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === option.value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-sm"
    >
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", checked ? "left-[1.125rem]" : "left-0.5")} />
      </span>
    </button>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  display: string;
}) {
  const id = useId();

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id} className="text-muted-foreground">
          {label}
        </label>
        <output htmlFor={id} className="font-medium tabular-nums">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-6 w-full cursor-pointer accent-[var(--primary)]"
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-heading text-base font-semibold tabular-nums",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SelectBox({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = useId();

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-lg border bg-background pr-9 pl-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );
}

const iconButton =
  "inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:w-auto sm:px-2.5 [&_svg]:size-4";

// ---- Timeline -------------------------------------------------------

/** Play button plus a scrubber with the speed curve drawn behind it, like a video timeline. */
function Timeline({
  profile,
  samples,
  vmax,
  time,
  playing,
  onPlay,
  onRestart,
  onScrub,
}: {
  profile: Profile;
  samples: { x: number; y: number }[];
  vmax: number;
  time: number;
  playing: boolean;
  onPlay: () => void;
  onRestart: () => void;
  onScrub: (t: number) => void;
}) {
  const total = profile.total;
  const w = 600;
  const h = 40;
  const curve = samples.map((point) => `${(point.x / Math.max(total, 0.001)) * w},${h - (point.y / Math.max(vmax, 0.1)) * (h - 4)}`).join(" ");
  const progress = total > 0 ? Math.min(1, time / total) : 0;

  return (
    <div className="flex items-center gap-2 border-t bg-card px-2 py-2 sm:gap-3 sm:px-3">
      <button
        type="button"
        onClick={onPlay}
        disabled={total === 0}
        aria-label={playing ? "Pause" : "Drive the path"}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-40 [&_svg]:size-4"
      >
        {playing ? <Pause aria-hidden /> : <Play aria-hidden className="translate-x-px" />}
      </button>
      <button
        type="button"
        onClick={onRestart}
        disabled={time === 0}
        aria-label="Back to start"
        className={cn(iconButton, "hidden sm:inline-flex sm:w-9 sm:px-0")}
      >
        <SkipBack aria-hidden />
      </button>

      <div className="relative h-10 min-w-0 flex-1">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <rect x={0} y={0} width={w} height={h} rx={6} className="fill-muted" />
          <rect x={0} y={0} width={w * progress} height={h} rx={6} className="fill-primary/15" />
          {total > 0 && (
            <polyline points={curve} fill="none" className="stroke-primary" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          )}
          <line x1={w * progress} x2={w * progress} y1={0} y2={h} className="stroke-cta" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        <input
          type="range"
          aria-label="Path time"
          min={0}
          max={Math.max(total, 0.01)}
          step={0.01}
          value={Math.min(time, total)}
          disabled={total === 0}
          onChange={(event) => onScrub(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      <div className="w-16 shrink-0 text-right leading-tight tabular-nums" aria-live="off">
        <p className="text-base font-semibold">{time.toFixed(1)} s</p>
        <p className="text-xs text-muted-foreground">of {total.toFixed(1)} s</p>
      </div>
    </div>
  );
}

// ---- Drivetrain -----------------------------------------------------

const VENDOR_NAME = { SDS: "Swerve Drive Specialties", REV: "REV Robotics", WCP: "West Coast Products" } as const;
const VENDORS = ["SDS", "REV", "WCP"] as const;

function optionLabel(id: string) {
  const option = SWERVE_OPTIONS.find((item) => item.id === id);

  return option ? `${option.module} ${option.gearing}` : "";
}

/** Every common module option for one motor, as tappable bars. */
function CompareModules({ motor, selectedId, onSelect, units }: { motor: MotorKey; selectedId: string; onSelect: (id: string) => void; units: Units }) {
  const speeds = SWERVE_OPTIONS.map((option) => ({ option, free: freeSpeedFtPerS(option, motor) }));
  const max = Math.max(...speeds.map((item) => item.free)) * 1.04;

  return (
    <div role="radiogroup" aria-label="Compare swerve modules" className="space-y-3 pt-1">
      {VENDORS.map((vendor) => (
        <div key={vendor}>
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{VENDOR_NAME[vendor]}</p>
          {speeds
            .filter((item) => item.option.vendor === vendor)
            .map(({ option, free }) => {
              const isSelected = option.id === selectedId;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelect(option.id)}
                  className={cn("block w-full rounded-md px-1.5 py-1 text-left transition-colors", isSelected ? "bg-accent" : "hover:bg-muted")}
                >
                  <span className="flex items-baseline justify-between gap-2 text-xs">
                    <span className={cn(isSelected && "font-semibold")}>
                      {option.module} <span className="text-muted-foreground">{option.gearing}</span>
                    </span>
                    <span className="font-medium tabular-nums">
                      {option.approx ? "≈" : ""}
                      {fmtSpeed(free, units)}
                    </span>
                  </span>
                  <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span
                      className={cn("block h-full rounded-full", isSelected ? "bg-primary" : "bg-primary/35")}
                      style={{ width: `${(free / max) * 100}%` }}
                    />
                  </span>
                </button>
              );
            })}
        </div>
      ))}
      <p className="text-[11px] leading-4 text-muted-foreground">
        Free speed with a {MOTORS[motor].label}. ≈ WCP publishes a speed range per ratio set; this uses the middle pinion.
      </p>
    </div>
  );
}

// ---- Simulator ------------------------------------------------------

type DriveMode = "module" | "manual";
type PanelTab = "path" | "robot";

export function DriveSim2013() {
  const [units, setUnits] = useState<Units>("imperial");
  const [points, setPoints] = useState<Waypoint[]>(PRESETS[0].points);
  const [loop, setLoop] = useState(PRESETS[0].loop);
  const [addMode, setAddMode] = useState(false);
  const [tab, setTab] = useState<PanelTab>("path");
  const [mode, setMode] = useState<DriveMode>("module");
  const [motor, setMotor] = useState<MotorKey>("krakenX60");
  const [moduleId, setModuleId] = useState("mk4i-l2");
  const [weight, setWeight] = useState(135);
  const [currentLimit, setCurrentLimit] = useState(60);
  const [manualV, setManualV] = useState(13);
  const [manualA, setManualA] = useState(12);
  const [cornerSlow, setCornerSlow] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  const option = SWERVE_OPTIONS.find((item) => item.id === moduleId) ?? SWERVE_OPTIONS[0];
  const perf = useMemo(() => drivetrainPerformance(option, motor, weight, currentLimit), [option, motor, weight, currentLimit]);
  const vmax = mode === "module" ? perf.topFtPerS : manualV;
  const accel = mode === "module" ? perf.accelFtPerS2 : manualA;

  const profile = useMemo(() => buildProfile(points, loop, vmax, accel, cornerSlow), [points, loop, vmax, accel, cornerSlow]);
  const noCorners = useMemo(() => buildProfile(points, loop, vmax, accel, false), [points, loop, vmax, accel]);
  const robot = stateAt(profile, time, points[0]);
  const blocked = crossesPyramid(points, loop);

  // Play the path in real time.
  useEffect(() => {
    if (!playing) {
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const startTime = timeRef.current;

    const tick = (now: number) => {
      const next = startTime + (now - startedAt) / 1000;

      if (next >= profile.total) {
        setTime(profile.total);
        setPlaying(false);

        return;
      }

      setTime(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [playing, profile.total]);

  function stop() {
    setPlaying(false);
    setTime(0);
  }

  function edit(next: Waypoint[]) {
    setPoints(next);
    stop();
  }

  function loadPreset(index: number) {
    edit(PRESETS[index].points);
    setLoop(PRESETS[index].loop);
    setSelected(null);
    setAddMode(false);
  }

  function deletePoint(index: number) {
    edit(points.filter((_, i) => i !== index));
    setSelected(null);
  }

  function selectPoint(index: number | null) {
    setSelected(index);

    if (index !== null) {
      setTab("path");
    }
  }

  const samples = useMemo(() => {
    const steps = 200;
    const out: { x: number; y: number }[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = (profile.total * i) / steps;
      out.push({ x: t, y: stateAt(profile, t, undefined)?.v ?? 0 });
    }

    return out;
  }, [profile]);

  const cornerCost = profile.total - noCorners.total;
  const cycles = loop && profile.total > 0 ? Math.floor(120 / profile.total) : 0;
  const rampTime = vmax / accel;

  const canvasProps = {
    points,
    loop,
    selected,
    addMode,
    playing,
    robot: robot && (playing || time > 0) ? robot : (points[0] ?? null),
    onAdd: (point: { x: number; y: number }) => {
      edit([...points, { ...point, wait: 0 }]);
      setSelected(null);
    },
    onInsert: (index: number, point: { x: number; y: number }) => {
      edit([...points.slice(0, index), { ...point, wait: 0 }, ...points.slice(index)]);
      setSelected(null);
    },
    onMove: (index: number, point: { x: number; y: number }) => {
      // Functional update: a drag can fire several moves before React re-renders.
      setPoints((current) => current.map((item, i) => (i === index ? { ...item, ...point } : item)));
      stop();
    },
    onSelect: selectPoint,
    onDelete: deletePoint,
  };

  const headline = profile.total > 0 ? `${profile.total.toFixed(1)} s` : "—";

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
          <div className="relative min-w-0 flex-1 sm:max-w-56 sm:flex-none">
            <select
              aria-label="Load an example path"
              value=""
              onChange={(event) => event.target.value !== "" && loadPreset(Number(event.target.value))}
              className="h-9 w-full appearance-none rounded-lg bg-transparent pr-8 pl-2.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Example paths…</option>
              {PRESETS.map((preset, index) => (
                <option key={preset.label} value={index}>
                  {preset.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          </div>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <button
            type="button"
            aria-pressed={addMode}
            onClick={() => setAddMode(!addMode)}
            className={cn(iconButton, addMode && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
            title="Add points"
          >
            <Plus aria-hidden />
            <span className="hidden sm:inline">Add</span>
            <span className="sr-only sm:hidden">Add points</span>
          </button>
          <button type="button" onClick={() => edit(points.slice(0, -1))} disabled={!points.length} className={iconButton} title="Undo last point">
            <Undo2 aria-hidden />
            <span className="hidden sm:inline">Undo</span>
            <span className="sr-only sm:hidden">Undo last point</span>
          </button>
          <button
            type="button"
            onClick={() => {
              edit([]);
              setSelected(null);
              setAddMode(true);
            }}
            disabled={!points.length}
            className={iconButton}
            title="Clear the path"
          >
            <Eraser aria-hidden />
            <span className="hidden sm:inline">Clear</span>
            <span className="sr-only sm:hidden">Clear the path</span>
          </button>
          <div className="ml-auto pl-1">
            <Segmented<Units>
              label="Units"
              size="sm"
              value={units}
              options={[
                { value: "imperial", label: "ft" },
                { value: "metric", label: "m" },
              ]}
              onChange={setUnits}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          {/* Field + timeline */}
          <div className="flex min-w-0 flex-col">
            <div className="relative flex flex-1 items-center bg-muted/40 px-1 py-2 sm:p-3">
              <div className="w-full">
                <FieldCanvas o="landscape" {...canvasProps} />
                <FieldCanvas o="portrait" {...canvasProps} />
              </div>

              {time > 0 && robot && (
                <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-card/95 px-3 py-1 text-xs font-semibold tabular-nums shadow sm:top-3 sm:right-3">
                  {fmtSpeed(robot.v, units)}
                </span>
              )}
              <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap justify-center gap-2 sm:top-3">
                {addMode && (
                  <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary py-1 pr-1 pl-3 text-xs font-medium text-primary-foreground shadow">
                    Tap the field to add points
                    <button
                      type="button"
                      onClick={() => setAddMode(false)}
                      className="rounded-full bg-primary-foreground/20 px-2 py-0.5 hover:bg-primary-foreground/30"
                    >
                      Done
                    </button>
                  </span>
                )}
                {!addMode && points.length < 2 && (
                  <span className="rounded-full bg-card/95 px-3 py-1 text-xs font-medium shadow">Tap + Add, then tap the field to draw a path</span>
                )}
              </div>
            </div>
            <Timeline
              profile={profile}
              samples={samples}
              vmax={vmax}
              time={time}
              playing={playing}
              onPlay={() => {
                if (!playing && time >= profile.total) {
                  setTime(0);
                }

                setAddMode(false);
                setPlaying(!playing);
              }}
              onRestart={stop}
              onScrub={(t) => {
                setPlaying(false);
                setTime(t);
              }}
            />
          </div>

          {/* Side panel */}
          <aside className="border-t lg:relative lg:border-t-0 lg:border-l">
            <div className="lg:absolute lg:inset-0 lg:flex lg:flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
                <Segmented<PanelTab>
                  label="Panel"
                  value={tab}
                  options={[
                    { value: "path", label: "Path" },
                    { value: "robot", label: "Robot" },
                  ]}
                  onChange={setTab}
                />
                <span className="truncate text-xs text-muted-foreground">{mode === "module" ? optionLabel(moduleId) : "Custom drivetrain"}</span>
              </div>

              <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {tab === "path" ? (
                  <div className="space-y-4 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{loop ? "Cycle time" : "Path time"}</p>
                      <p
                        className={cn(
                          "font-heading text-4xl font-bold tabular-nums [font-stretch:87.5%]",
                          profile.total > 0 && profile.total <= 12 && "text-success",
                        )}
                      >
                        {headline}
                      </p>
                      {loop && profile.total > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {cycles} cycles in TELEOP · about {cycles * 4} discs
                        </p>
                      )}
                    </div>
                    <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted/60 p-3">
                      <Stat label="Driving" value={`${profile.driveTime.toFixed(1)} s`} />
                      <Stat label="Waiting" value={`${profile.waitTime.toFixed(1)} s`} />
                      <Stat label="Distance" value={fmtDist(profile.distance, units)} />
                    </dl>

                    {blocked && (
                      <p className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-5 dark:bg-amber-950/30">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                        <span>
                          Path crosses the <span className="font-semibold">{blocked} PYRAMID</span>. Can your robot fit through, or should you route around it?
                        </span>
                      </p>
                    )}

                    <div className="divide-y">
                      <Switch
                        checked={loop}
                        onChange={(value) => {
                          setLoop(value);
                          stop();
                        }}
                        label="Round trip"
                        hint="Drive back to point 1"
                      />
                      <Switch
                        checked={cornerSlow}
                        onChange={setCornerSlow}
                        label="Slow down for corners"
                        hint={cornerSlow && cornerCost > 0.05 ? `Corners cost ${cornerCost.toFixed(1)} s` : "Sharper turns force a slower speed"}
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex items-baseline justify-between">
                        <p className="text-sm font-medium">Waypoints</p>
                        <p className="text-xs text-muted-foreground">Drag points · drag + to bend</p>
                      </div>
                      {points.length === 0 ? (
                        <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">No points yet</p>
                      ) : (
                        <ol className="divide-y rounded-lg border">
                          {points.map((point, index) => {
                            const isSelected = selected === index;

                            return (
                              <li key={index}>
                                <button
                                  type="button"
                                  onClick={() => selectPoint(isSelected ? null : index)}
                                  aria-expanded={isSelected}
                                  className={cn(
                                    "flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                                    isSelected ? "bg-accent" : "hover:bg-muted/60",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-primary text-primary",
                                    )}
                                  >
                                    {index + 1}
                                  </span>
                                  <span className="flex-1">{point.wait > 0 ? `Wait ${point.wait} s` : index === 0 ? "Start" : "Drive through"}</span>
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {fmtDist(point.x, units)}, {fmtDist(point.y, units)}
                                  </span>
                                </button>
                                {isSelected && (
                                  <div className="space-y-3 bg-accent/50 px-3 pt-1 pb-3">
                                    <Range
                                      label="Wait here"
                                      value={point.wait}
                                      min={0}
                                      max={8}
                                      step={0.5}
                                      onChange={(wait) => edit(points.map((item, i) => (i === index ? { ...item, wait } : item)))}
                                      display={point.wait ? `${point.wait} s` : "None"}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => deletePoint(index)}
                                      className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline"
                                    >
                                      <Trash2 className="size-4" aria-hidden />
                                      Delete point
                                    </button>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-3">
                    <Segmented<DriveMode>
                      label="Speed comes from"
                      value={mode}
                      options={[
                        { value: "module", label: "Swerve module" },
                        { value: "manual", label: "Custom" },
                      ]}
                      onChange={(next) => {
                        setMode(next);
                        stop();
                      }}
                    />

                    {mode === "module" ? (
                      <>
                        <SelectBox label="Module and gearing" value={moduleId} onChange={setModuleId}>
                          {VENDORS.map((vendor) => (
                            <optgroup key={vendor} label={VENDOR_NAME[vendor]}>
                              {SWERVE_OPTIONS.filter((item) => item.vendor === vendor).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.module} {item.gearing} · {item.approx ? "≈" : ""}
                                  {fmtSpeed(freeSpeedFtPerS(item, motor), units)}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </SelectBox>
                        <SelectBox label="Drive motor" value={motor} onChange={(value) => setMotor(value as MotorKey)}>
                          {(Object.keys(MOTORS) as MotorKey[]).map((key) => (
                            <option key={key} value={key}>
                              {MOTORS[key].label}
                            </option>
                          ))}
                        </SelectBox>
                        <Range label="Robot weight" value={weight} min={70} max={155} step={5} onChange={setWeight} display={fmtWeight(weight, units)} />
                        <Range
                          label="Current limit"
                          value={currentLimit}
                          min={20}
                          max={100}
                          step={5}
                          onChange={setCurrentLimit}
                          display={`${currentLimit} A`}
                        />

                        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/60 p-3">
                          <Stat label="Free speed" value={fmtSpeed(perf.freeFtPerS, units)} />
                          <Stat label="Real top speed" value={fmtSpeed(perf.topFtPerS, units)} />
                          <Stat label="0 → top speed" value={`${perf.timeToTop.toFixed(2)} s`} />
                          <Stat
                            label="Battery dips to"
                            value={`${perf.minVolts.toFixed(1)} V`}
                            tone={perf.minVolts < 7 ? "bad" : perf.minVolts < 8.5 ? "warn" : "good"}
                          />
                        </dl>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {perf.minVolts < 7
                            ? "Brownout risk: the battery sags too far. Lower the current limit. "
                            : perf.tractionShare > 0.05
                              ? "The wheels are near slipping as you speed up, so more current won't help much. "
                              : "The motors set how fast you speed up. More current helps but sags the battery. "}
                          Include battery (≈13 lb) and bumpers in the weight. Real top speed ≈ {Math.round(USABLE_FRACTION * 100)}% of free speed.
                        </p>

                        <details className="group rounded-lg border">
                          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                            Compare all modules
                            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                          </summary>
                          <div className="border-t px-2 pb-3">
                            <CompareModules motor={motor} selectedId={moduleId} onSelect={setModuleId} units={units} />
                          </div>
                        </details>
                      </>
                    ) : (
                      <>
                        <Range
                          label="Top speed"
                          value={manualV}
                          min={4}
                          max={20}
                          step={0.5}
                          onChange={(value) => {
                            setManualV(value);
                            stop();
                          }}
                          display={fmtSpeed(manualV, units)}
                        />
                        <Range
                          label="Acceleration"
                          value={manualA}
                          min={3}
                          max={30}
                          step={1}
                          onChange={(value) => {
                            setManualA(value);
                            stop();
                          }}
                          display={fmtAccel(manualA, units)}
                        />
                        <p className="text-xs text-muted-foreground">0 → top speed in {(manualV / manualA).toFixed(1)} s.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Goals
        goals={[
          { label: "Build a round trip (feeder → shot → feeder) under 12 s", met: loop && profile.total > 0 && profile.total < 12 && points.length >= 2 },
          {
            label: `Find a path where the robot never reaches top speed (it takes ${rampTime.toFixed(1)} s to get there)`,
            met: profile.total > 0 && profile.peak < vmax - 0.05,
          },
          { label: "Find a path where corners cost more than 1 s", met: cornerSlow && cornerCost > 1 },
        ]}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Simple model: the robot speeds up and slows down at a steady rate, stops at each waypoint with a wait, and slows for sharp corners if you choose. Real
        matches add traffic, defense, and driver reaction time.
      </p>
    </div>
  );
}
