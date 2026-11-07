import { CircleCheck, CircleX } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The bordered box that holds one hands-on lab. */
export function Lab({ title, children, caption }: { title: string; children: ReactNode; caption?: string }) {
  return (
    <section className="my-8 rounded-xl border bg-card" aria-label={`Lab: ${title}`}>
      <header className="flex items-baseline justify-between gap-3 border-b px-5 py-3">
        <h3 className="text-base font-semibold">
          <span className="text-muted-foreground">Lab · </span>
          {title}
        </h3>
      </header>
      <div className="space-y-5 p-5">{children}</div>
      {caption && <div className="border-t px-5 py-3 text-sm text-muted-foreground">{caption}</div>}
    </section>
  );
}

export function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (value: number) => String(value),
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <output htmlFor={id} className="font-semibold tabular-nums">
          {format(value)}
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
        className="h-2 w-full cursor-pointer accent-[var(--primary)]"
      />
    </div>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              value === option.value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export type Tone = "good" | "warn" | "bad" | "neutral";

const toneText: Record<Tone, string> = {
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
  neutral: "text-foreground",
};

export function Readouts({ items }: { items: { label: string; value: string; note?: string; tone?: Tone }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-card p-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn("mt-0.5 font-heading text-xl font-semibold tabular-nums [font-stretch:87.5%]", toneText[item.tone ?? "neutral"])}>
            {item.value}
          </dd>
          {item.note && <dd className="text-xs text-muted-foreground">{item.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Goals({ goals }: { goals: { label: string; met: boolean }[] }) {
  const allMet = goals.every((goal) => goal.met);

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        allMet ? "border-success/40 bg-emerald-50 dark:bg-emerald-950/30" : "bg-muted/40",
      )}
      aria-live="polite"
    >
      <p className="mb-2 text-sm font-semibold">{allMet ? "Challenge complete" : "Challenge"}</p>
      <ul className="grid gap-1.5 text-sm">
        {goals.map((goal) => (
          <li key={goal.label} className="flex items-center gap-2">
            {goal.met ? (
              <CircleCheck key="met" className="size-4 shrink-0 animate-pop text-success" aria-label="Met" />
            ) : (
              <CircleX key="unmet" className="size-4 shrink-0 text-muted-foreground" aria-label="Not met yet" />
            )}
            {goal.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Takeaway({ children }: { children: ReactNode }) {
  return (
    <aside className="my-6 rounded-lg bg-accent px-5 py-4">
      <p className="text-sm font-semibold text-primary">One thing to remember</p>
      <p className="mt-1 text-base leading-7">{children}</p>
    </aside>
  );
}

function niceTicks(min: number, max: number, count = 5) {
  const span = max - min || 1;
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => span / candidate <= count) ?? raw;
  const ticks: number[] = [];

  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-6; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }

  return ticks;
}

function formatTick(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(value < 1 ? 2 : 1);
}

export type ChartSeries = {
  label: string;
  points: { x: number; y: number }[];
  /** Tailwind stroke class, e.g. "stroke-primary". */
  strokeClass: string;
  dashed?: boolean;
};

/** A small line chart drawn to scale, with labeled axes. Colors come from theme tokens. */
export function LineChart({
  series,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  marker,
  vLine,
  hLine,
  ariaLabel,
}: {
  series: ChartSeries[];
  xDomain: [number, number];
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  marker?: { x: number; y: number; label?: string };
  vLine?: { x: number; label: string };
  hLine?: { y: number; label: string };
  ariaLabel: string;
}) {
  const width = 560;
  const height = 260;
  const pad = { left: 52, right: 16, top: 14, bottom: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const sx = (x: number) => pad.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotW;
  const sy = (y: number) => pad.top + plotH - ((y - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;
  const clampY = (y: number) => Math.min(yDomain[1], Math.max(yDomain[0], y));
  const xTicks = niceTicks(xDomain[0], xDomain[1]);
  const yTicks = niceTicks(yDomain[0], yDomain[1], 4);

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="w-full min-w-[420px]">
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line x1={pad.left} x2={width - pad.right} y1={sy(tick)} y2={sy(tick)} className="stroke-border" strokeWidth={1} />
              <text x={pad.left - 8} y={sy(tick)} dy="0.35em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text key={`x${tick}`} x={sx(tick)} y={height - pad.bottom + 18} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
              {formatTick(tick)}
            </text>
          ))}
          <line x1={pad.left} x2={width - pad.right} y1={sy(yDomain[0])} y2={sy(yDomain[0])} className="stroke-muted-foreground" strokeWidth={1} />
          <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[12px]">
            {xLabel}
          </text>
          <text transform={`translate(14 ${pad.top + plotH / 2}) rotate(-90)`} textAnchor="middle" className="fill-muted-foreground text-[12px]">
            {yLabel}
          </text>

          {hLine && hLine.y >= yDomain[0] && hLine.y <= yDomain[1] && (
            <g>
              <line x1={pad.left} x2={width - pad.right} y1={sy(hLine.y)} y2={sy(hLine.y)} className="stroke-warning" strokeWidth={1.5} strokeDasharray="5 4" />
              <text x={width - pad.right - 4} y={sy(hLine.y) - 6} textAnchor="end" className="fill-warning text-[11px] font-medium">
                {hLine.label}
              </text>
            </g>
          )}
          {vLine && vLine.x >= xDomain[0] && vLine.x <= xDomain[1] && (
            <g>
              <line x1={sx(vLine.x)} x2={sx(vLine.x)} y1={pad.top} y2={pad.top + plotH} className="stroke-muted-foreground" strokeWidth={1} strokeDasharray="3 3" />
              <text x={sx(vLine.x) + 4} y={pad.top + 10} className="fill-muted-foreground text-[11px]">
                {vLine.label}
              </text>
            </g>
          )}

          {series.map((line) => (
            <polyline
              key={line.label}
              fill="none"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={line.dashed ? "6 5" : undefined}
              className={line.strokeClass}
              points={line.points.map((point) => `${sx(point.x)},${sy(clampY(point.y))}`).join(" ")}
            />
          ))}

          {marker && marker.x >= xDomain[0] && marker.x <= xDomain[1] && (
            <g>
              <circle cx={sx(marker.x)} cy={sy(clampY(marker.y))} r={6} className="fill-cta stroke-card" strokeWidth={2} />
              {marker.label && (
                <text
                  x={sx(marker.x)}
                  y={sy(clampY(marker.y)) - 12}
                  textAnchor={sx(marker.x) > width - 120 ? "end" : "middle"}
                  className="fill-foreground text-[12px] font-semibold"
                >
                  {marker.label}
                </text>
              )}
            </g>
          )}
        </svg>
      </div>
      {series.length > 1 && (
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((line) => (
            <span key={line.label} className="inline-flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" x2="18" y1="3" y2="3" strokeWidth="2.5" strokeDasharray={line.dashed ? "4 3" : undefined} className={line.strokeClass} />
              </svg>
              {line.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Two shafts that spin at speeds proportional to their real RPM, so students
 * can see the reduction. The motor shaft is slowed to a watchable pace and the
 * output keeps the same ratio to it.
 */
export function SpinningShafts({ ratio, motorLabel }: { ratio: number; motorLabel: string }) {
  const motorSeconds = 0.5;
  const outputSeconds = Math.min(motorSeconds * ratio, 120);

  return (
    <div className="grid grid-cols-2 gap-4 text-center">
      {[
        { label: motorLabel, seconds: motorSeconds, size: 56 },
        { label: "Output shaft", seconds: outputSeconds, size: 96 },
      ].map((shaft) => (
        <div key={shaft.label} className="flex flex-col items-center gap-2">
          <div className="flex h-28 items-center justify-center">
            <svg
              width={shaft.size}
              height={shaft.size}
              viewBox="-50 -50 100 100"
              className="motion-safe:animate-spin"
              style={{ animationDuration: `${shaft.seconds}s` }}
              aria-hidden
            >
              <circle r="46" className="fill-muted stroke-border" strokeWidth="4" />
              {Array.from({ length: 12 }, (_, index) => (
                <rect
                  key={index}
                  x="-4"
                  y="-50"
                  width="8"
                  height="10"
                  rx="2"
                  className="fill-muted-foreground"
                  transform={`rotate(${index * 30})`}
                />
              ))}
              <line x1="0" y1="0" x2="0" y2="-38" strokeWidth="6" strokeLinecap="round" className="stroke-cta" />
              <circle r="7" className="fill-foreground" />
            </svg>
          </div>
          <p className="text-sm font-medium">{shaft.label}</p>
        </div>
      ))}
    </div>
  );
}
