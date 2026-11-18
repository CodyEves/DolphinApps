import { cn } from "@/lib/utils";

/*
 * Top-down sketch of the 2013 ULTIMATE ASCENT field, shared by the mock
 * kickoff cheat sheet and its drive-time simulator.
 */

export type Orientation = "landscape" | "portrait";

/*
 * The field is drawn once in field coordinates: fx runs 0..648 from the red
 * wall to the blue wall (12 px per foot), fy runs 0..324 across the field.
 * Landscape (tablet/desktop) puts red on the left. Portrait (phones) puts red
 * at the bottom so the sketch fits a narrow screen with readable labels.
 */
export const FIELD_VIEW: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 720, h: 370 },
  portrait: { w: 400, h: 724 },
};

export function toScreen(o: Orientation, fx: number, fy: number): [number, number] {
  return o === "landscape" ? [36 + fx, 24 + fy] : [38 + fy, 34 + (648 - fx)];
}

function FRect({ o, fx, fy, w, h, className, strokeWidth, rx }: { o: Orientation; fx: number; fy: number; w: number; h: number; className: string; strokeWidth?: number; rx?: number }) {
  const [x, y] = o === "landscape" ? toScreen(o, fx, fy) : toScreen(o, fx + w, fy);

  return <rect x={x} y={y} width={o === "landscape" ? w : h} height={o === "landscape" ? h : w} rx={rx} className={className} strokeWidth={strokeWidth} />;
}

function FLine({ o, pts, className, strokeWidth, dash }: { o: Orientation; pts: [number, number][]; className: string; strokeWidth: number; dash?: string }) {
  return (
    <polyline
      points={pts.map(([fx, fy]) => toScreen(o, fx, fy).join(",")).join(" ")}
      fill="none"
      className={className}
      strokeWidth={strokeWidth}
      strokeDasharray={dash}
    />
  );
}

const RED_STROKE = "stroke-rose-600 dark:stroke-rose-400";
const BLUE_STROKE = "stroke-sky-600 dark:stroke-sky-400";
const RED_TEXT = "fill-rose-700 dark:fill-rose-300";
const BLUE_TEXT = "fill-sky-700 dark:fill-sky-300";

type FieldLabel = { text: string; className?: string; l: [number, number, "start" | "middle" | "end", number?]; p: [number, number, "start" | "middle" | "end"] };

const FIELD_LABELS: FieldLabel[] = [
  { text: "RED DRIVERS", l: [14, 186, "middle", -90], p: [200, 714, "middle"] },
  { text: "BLUE DRIVERS", l: [706, 186, "middle", 90], p: [200, 14, "middle"] },
  { text: "CENTER LINE", className: "fill-muted-foreground", l: [360, 16, "middle"], p: [358, 351, "end"] },
  { text: "RED PYRAMID", l: [515, 131, "middle"], p: [200, 150, "middle"] },
  { text: "BLUE PYRAMID", l: [205, 131, "middle"], p: [200, 576, "middle"] },
  { text: "RED AUTO LINE", className: RED_TEXT, l: [472, 340, "start"], p: [42, 246, "start"] },
  { text: "BLUE AUTO LINE", className: BLUE_TEXT, l: [256, 40, "start"], p: [358, 480, "end"] },
  { text: "RED HIGH + MIDDLE GOALS", className: RED_TEXT, l: [668, 274, "end"], p: [215, 54, "middle"] },
  { text: "BLUE HIGH + MIDDLE GOALS", className: BLUE_TEXT, l: [52, 108, "start"], p: [190, 662, "middle"] },
  { text: "RED LOW GOAL", className: RED_TEXT, l: [648, 336, "end"], p: [326, 82, "end"] },
  { text: "BLUE LOW GOAL", className: BLUE_TEXT, l: [72, 44, "start"], p: [76, 644, "start"] },
  { text: "RED FEEDERS", className: RED_TEXT, l: [136, 308, "start"], p: [310, 600, "end"] },
  { text: "BLUE FEEDERS", className: BLUE_TEXT, l: [584, 72, "end"], p: [92, 110, "start"] },
];

/** The field itself, for use inside an <svg> with FIELD_VIEW[o] as its viewBox. Set `quiet` to fade labels behind an interactive layer. */
export function FieldDrawing({ o, quiet = false }: { o: Orientation; quiet?: boolean }) {
  const pyr = 94;
  const pyrY = 162 - pyr / 2;
  const pyramid = (fx: number, stroke: string, fill: string) => (
    <g>
      <FRect o={o} fx={fx} fy={pyrY} w={pyr} h={pyr} className={cn(fill, stroke)} strokeWidth={3} />
      <FLine o={o} pts={[[fx, pyrY], [fx + pyr, pyrY + pyr]]} className={stroke} strokeWidth={1.5} />
      <FLine o={o} pts={[[fx + pyr, pyrY], [fx, pyrY + pyr]]} className={stroke} strokeWidth={1.5} />
      <FRect o={o} fx={fx + pyr / 2 - 12} fy={162 - 12} w={24} h={24} className={cn("fill-card", stroke)} strokeWidth={2} />
    </g>
  );

  return (
    <g className="pointer-events-none">
      <FRect o={o} fx={0} fy={0} w={648} h={324} rx={6} className="fill-muted stroke-border" strokeWidth={2} />

      {/* Driver walls */}
      <FRect o={o} fx={-14} fy={60} w={14} h={204} className="fill-rose-600 dark:fill-rose-400" />
      <FRect o={o} fx={648} fy={60} w={14} h={204} className="fill-sky-600 dark:fill-sky-400" />

      {/* Center + auto lines (108 in either side of center) */}
      <FLine o={o} pts={[[324, 0], [324, 324]]} className="stroke-foreground" strokeWidth={2} dash="6 5" />
      <FLine o={o} pts={[[432, 0], [432, 324]]} className={RED_STROKE} strokeWidth={2.5} />
      <FLine o={o} pts={[[216, 0], [216, 324]]} className={BLUE_STROKE} strokeWidth={2.5} />

      {/* Each pyramid sits in the half where its alliance scores */}
      {pyramid(432, RED_STROKE, "fill-rose-600/15")}
      {pyramid(122, BLUE_STROKE, "fill-sky-600/15")}

      {/* High + middle goals: RED goals hang over the BLUE wall and vice versa */}
      {[96, 142, 188].map((fy, index) => (
        <g key={fy}>
          <FRect o={o} fx={642} fy={fy} w={10} h={40} rx={2} className={index === 1 ? "fill-rose-700 dark:fill-rose-300" : "fill-rose-600 dark:fill-rose-400"} />
          <FRect o={o} fx={-4} fy={fy} w={10} h={40} rx={2} className={index === 1 ? "fill-sky-700 dark:fill-sky-300" : "fill-sky-600 dark:fill-sky-400"} />
        </g>
      ))}

      {/* Low goals, in a corner of the opponent's wall */}
      <FRect o={o} fx={618} fy={294} w={30} h={30} className={cn("fill-rose-600/40", RED_STROKE)} strokeWidth={2} />
      <FRect o={o} fx={0} fy={0} w={30} h={30} className={cn("fill-sky-600/40", BLUE_STROKE)} strokeWidth={2} />

      {/* Feeder stations and loading zones */}
      <FLine o={o} pts={[[0, 254], [40, 324], [110, 324]]} className={RED_STROKE} strokeWidth={5} />
      <FLine o={o} pts={[[0, 224], [140, 324]]} className="stroke-rose-600/70 dark:stroke-rose-400/70" strokeWidth={2} dash="4 3" />
      <FLine o={o} pts={[[30, 0], [60, 0]]} className={RED_STROKE} strokeWidth={5} />
      <FLine o={o} pts={[[648, 70], [608, 0], [538, 0]]} className={BLUE_STROKE} strokeWidth={5} />
      <FLine o={o} pts={[[648, 100], [508, 0]]} className="stroke-sky-600/70 dark:stroke-sky-400/70" strokeWidth={2} dash="4 3" />
      <FLine o={o} pts={[[618, 324], [588, 324]]} className={BLUE_STROKE} strokeWidth={5} />

      <g className={cn("fill-foreground font-semibold", o === "portrait" ? "text-[12px]" : "text-[11px]", quiet && "opacity-50")}>
        {FIELD_LABELS.map((label) => {
          const [x, y, anchor, rotate] = o === "landscape" ? label.l : [...label.p, undefined];

          return (
            <text key={label.text} x={x} y={y} textAnchor={anchor} transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined} className={label.className}>
              {label.text}
            </text>
          );
        })}
      </g>
    </g>
  );
}

/** The field as a standalone picture. Landscape shows from sm up, portrait on phones. */
export function FieldSvg({ o }: { o: Orientation }) {
  const view = FIELD_VIEW[o];

  return (
    <svg
      viewBox={`0 0 ${view.w} ${view.h}`}
      role="img"
      aria-label="Simplified top-down sketch of the 2013 Ultimate Ascent field"
      className={o === "landscape" ? "hidden w-full max-w-[900px] sm:block" : "mx-auto block w-full max-w-[420px] sm:hidden"}
    >
      <FieldDrawing o={o} />
    </svg>
  );
}
