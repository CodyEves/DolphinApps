import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Choice, Goals, Lab, LineChart, Readouts, Slider, SpinningShafts, Takeaway } from "@/components/learning/lab-ui";
import { LessonShell, SkillCheckChapter } from "@/components/learning/lesson-shell";
import type { Tone } from "@/components/learning/lab-ui";
import {
  MOTORS,
  elevatorSweep,
  freeSpeedRad,
  geared,
  heatBand,
  motorById,
  motorCurrent,
  operatingPoint,
  simulateArm,
  simulateElevator,
} from "@/lib/motor-physics";

const motorOptions = MOTORS.map((motor) => ({ value: motor.id, label: motor.name }));
const toneForBand = (tone: "good" | "warn" | "bad"): Tone => tone;

function fmt(value: number, digits = 0) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function ratioFormat(value: number) {
  return `${fmt(value, value < 10 ? 1 : 0)}:1`;
}

export function MotorRatioLessonPage() {
  return (
    <LessonShell
      title="Pick a motor and gear ratio"
      chapters={[
        { id: "trade", title: "What a gear ratio trades", minutes: 5, render: () => <ChapterTrade /> },
        { id: "load", title: "The load sets the current", minutes: 6, render: () => <ChapterLoad /> },
        { id: "arm", title: "Hold and swing an arm", minutes: 7, render: () => <ChapterArm /> },
        { id: "elevator", title: "Find the fastest elevator ratio", minutes: 6, render: () => <ChapterElevator /> },
        { id: "limit", title: "Design under a motor limit", minutes: 6, render: () => <ChapterLimit /> },
        { id: "quiz", title: "Check your understanding", minutes: 4, render: () => <ChapterQuiz /> },
      ]}
    />
  );
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

// ---- Chapter 1 -----------------------------------------------------------

function ChapterTrade() {
  const [motorId, setMotorId] = useState("kraken-x60");
  const [ratio, setRatio] = useState(10);
  const motor = motorById(motorId);
  const out = geared(motor, ratio);

  return (
    <>
      <P>
        Every FRC motor spins far too fast and too weakly to move a mechanism directly. A Kraken X60 spins at 6,000 RPM with nothing
        attached, but it can only push with about 7 N·m before it stalls. That is roughly the twist you can give a door handle.
      </P>
      <P>
        A gear or belt reduction fixes that. A 10:1 reduction means the motor turns 10 times for every one turn of the output. The output
        spins 10 times slower and, ignoring friction, pushes 10 times harder. You never get both. You choose where on that trade your
        mechanism needs to be.
      </P>

      <Lab title="Trade speed for torque">
        <div className="grid gap-5 sm:grid-cols-2">
          <Choice label="Motor" value={motorId} options={motorOptions} onChange={setMotorId} />
          <Slider id="trade-ratio" label="Reduction" value={ratio} min={1} max={100} step={1} onChange={setRatio} format={ratioFormat} />
        </div>
        <SpinningShafts ratio={ratio} motorLabel={`${motor.name} shaft`} />
        <Readouts
          items={[
            { label: "Motor free speed", value: `${fmt(motor.freeSpeedRpm)} RPM` },
            { label: "Output free speed", value: `${fmt(out.freeSpeedRpm, out.freeSpeedRpm < 100 ? 1 : 0)} RPM` },
            { label: "Motor stall torque", value: `${fmt(motor.stallTorque, 2)} N·m` },
            { label: "Output stall torque", value: `${fmt(out.stallTorque, 1)} N·m` },
          ]}
        />
      </Lab>

      <P>
        Notice that the product stays the same. Free speed times stall torque is the motor's power budget, and a gearbox can only move it
        around. To get more of both, you need a stronger motor or more motors.
      </P>
      <Takeaway>A reduction of G:1 divides speed by G and multiplies torque by G. It never adds power.</Takeaway>
    </>
  );
}

// ---- Chapter 2 -----------------------------------------------------------

function ChapterLoad() {
  const [motorId, setMotorId] = useState("kraken-x60");
  const [ratio, setRatio] = useState(20);
  const [load, setLoad] = useState(30);
  const motor = motorById(motorId);
  const out = geared(motor, ratio);
  const point = operatingPoint(motor, ratio, 1, load);
  const band = heatBand(point.currentPerMotor);
  const maxTorque = Math.max(out.stallTorque, load) * 1.1;

  return (
    <>
      <P>
        A motor does not decide how hard it pushes. The load does. Ask an output shaft to hold a weight and the motor makes exactly the
        torque needed, then slows down to the speed where its curve meets that torque.
      </P>
      <P>
        The straight line below is the motor's torque–speed curve after the gearbox. At zero torque it spins at free speed. At stall
        torque it stops. Current rises in a straight line with torque, and near stall almost all of it turns into heat.
      </P>

      <Lab
        title="Find the operating point"
        caption="Heat guidance is a rule of thumb for current held for more than a few seconds. Short bursts above 40 A are normal."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Choice label="Motor" value={motorId} options={motorOptions} onChange={setMotorId} />
          <Slider id="load-ratio" label="Reduction" value={ratio} min={1} max={100} onChange={setRatio} format={ratioFormat} />
        </div>
        <Slider id="load-torque" label="Load on the output" value={load} min={0} max={150} onChange={setLoad} format={(value) => `${value} N·m`} />
        <LineChart
          ariaLabel="Output torque versus output speed for the chosen motor and reduction"
          xDomain={[0, out.freeSpeedRpm]}
          yDomain={[0, maxTorque]}
          xLabel="Output speed (RPM)"
          yLabel="Torque (N·m)"
          series={[
            {
              label: "Torque the motor can make",
              strokeClass: "stroke-primary",
              points: [
                { x: 0, y: out.stallTorque },
                { x: out.freeSpeedRpm, y: 0 },
              ],
            },
          ]}
          hLine={{ y: load, label: `Load ${load} N·m` }}
          marker={point.stalled ? undefined : { x: point.outputRpm, y: load, label: `${fmt(point.outputRpm)} RPM` }}
        />
        <Readouts
          items={[
            { label: "Output speed", value: point.stalled ? "Stalled" : `${fmt(point.outputRpm)} RPM`, tone: point.stalled ? "bad" : "neutral" },
            { label: "Share of stall", value: `${fmt(point.fraction * 100)}%`, tone: point.fraction > 0.5 ? "bad" : point.fraction > 0.25 ? "warn" : "good" },
            { label: "Current", value: `${fmt(point.currentPerMotor)} A`, note: band.label, tone: toneForBand(band.tone) },
            { label: "Power to the load", value: `${fmt(point.powerW)} W` },
          ]}
        />
      </Lab>

      <P>
        Try a 30 N·m load at 10:1, then at 30:1. With more reduction the motor works at a smaller share of its stall torque, so it draws
        less current and runs cooler, but the output turns slower.
      </P>
      <Takeaway>Current follows torque. Keep a mechanism that has to hold a load well below stall, or it will cook the motor.</Takeaway>
    </>
  );
}

// ---- Chapter 3 -----------------------------------------------------------

function ChapterArm() {
  const [motorId, setMotorId] = useState("kraken-x60");
  const [ratio, setRatio] = useState(20);
  const [mass, setMass] = useState(4);
  const [length, setLength] = useState(0.6);
  const [limit, setLimit] = useState(60);
  const motor = motorById(motorId);
  const result = useMemo(
    () => simulateArm({ motor, count: 1, ratio, massKg: mass, lengthM: length, currentLimit: limit }),
    [motor, ratio, mass, length, limit],
  );
  const hold = heatBand(result.holdCurrent);
  const goals = [
    { label: "Reaches straight up", met: result.reached },
    { label: "Swings 90° in under 0.35 s", met: result.reached && result.timeS < 0.35 },
    { label: "Holds at horizontal on under 15 A", met: result.holdCurrent < 15 },
  ];

  return (
    <>
      <P>
        An arm is the hardest common mechanism to gear because gravity pulls on it the whole time. The worst spot is straight out
        sideways, where the weight has the most leverage. That holding torque is mass × 9.81 × distance from the pivot.
      </P>
      <P>
        Too little reduction and the motor sits near stall just to hold the arm level, which overheats it. Too much and the arm swings
        slowly. Your job is to find a ratio that does both jobs.
      </P>

      <Lab title="Swing an arm from level to straight up" caption="The arm is modeled as a weight at the end of a light tube. Real arms with friction will be a little slower.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Choice label="Motor" value={motorId} options={motorOptions} onChange={setMotorId} />
          <Slider id="arm-ratio" label="Reduction" value={ratio} min={5} max={150} onChange={setRatio} format={ratioFormat} />
          <Slider id="arm-mass" label="Mass at the end" value={mass} min={1} max={10} step={0.5} onChange={setMass} format={(value) => `${fmt(value, 1)} kg`} />
          <Slider id="arm-length" label="Pivot to the mass" value={length} min={0.2} max={1.2} step={0.05} onChange={setLength} format={(value) => `${fmt(value, 2)} m`} />
          <Slider id="arm-limit" label="Current limit per motor" value={limit} min={20} max={120} step={5} onChange={setLimit} format={(value) => `${value} A`} />
        </div>
        <LineChart
          ariaLabel="Arm angle over time"
          xDomain={[0, Math.max(0.6, Math.min(3, result.timeS * 1.15))]}
          yDomain={[0, 100]}
          xLabel="Time (s)"
          yLabel="Angle (°)"
          series={[{ label: "Arm angle", strokeClass: "stroke-primary", points: result.trace.map((point) => ({ x: point.t, y: point.x })) }]}
          hLine={{ y: 90, label: "Straight up" }}
          vLine={{ x: 0.35, label: "0.35 s goal" }}
        />
        <Readouts
          items={[
            { label: "Time to 90°", value: result.reached ? `${fmt(result.timeS, 2)} s` : "Never", tone: result.reached ? (result.timeS < 0.35 ? "good" : "warn") : "bad" },
            { label: "Holding current", value: `${fmt(result.holdCurrent, 1)} A`, note: hold.label, tone: toneForBand(hold.tone) },
            { label: "Share of stall to hold", value: `${fmt(result.holdFraction * 100)}%` },
            { label: "Peak current", value: `${fmt(result.peakCurrent)} A`, note: "while swinging" },
          ]}
        />
        <Goals goals={goals} />
      </Lab>

      <P>
        Start at 20:1 and the arm can't even lift: holding it level needs more than the 60 A limit. Raise the ratio until holding is
        cool, then check the swing time. Go too far and the arm gets slow again.
        If you cannot meet both, try a stronger motor or a shorter arm. Shortening the arm cuts the holding torque just as much as
        removing weight does.
      </P>
      <Takeaway>Gear an arm for holding first. Pick the lowest ratio that holds it level on under 15 A, then check it is fast enough.</Takeaway>
    </>
  );
}

// ---- Chapter 4 -----------------------------------------------------------

const SPOOLS = [
  { value: "0.0254", label: "1 in" },
  { value: "0.0381", label: "1.5 in" },
  { value: "0.0508", label: "2 in" },
];

function ChapterElevator() {
  const [motorId, setMotorId] = useState("kraken-x60");
  const [count, setCount] = useState("2");
  const [ratio, setRatio] = useState(12);
  const [mass, setMass] = useState(15);
  const [height, setHeight] = useState(1.5);
  const [spool, setSpool] = useState("0.0508");
  const motor = motorById(motorId);
  const base = { motor, count: Number(count), massKg: mass, spoolDiameterM: Number(spool), heightM: height, currentLimit: 40 };
  const ratios = useMemo(() => Array.from({ length: 40 }, (_, index) => 1 + index), []);
  const sweep = useMemo(() => elevatorSweep(base, ratios), [motorId, count, mass, height, spool]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = useMemo(() => simulateElevator({ ...base, ratio }), [motorId, count, mass, height, spool, ratio]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = sweep.filter((point): point is { ratio: number; timeS: number } => point.timeS !== null);
  const best = valid.reduce<{ ratio: number; timeS: number } | null>((current, point) => (!current || point.timeS < current.timeS ? point : current), null);
  const hold = heatBand(result.holdCurrent);
  const yMax = Math.min(3, Math.max(...valid.map((point) => point.timeS), 1)) * 1.1;

  return (
    <>
      <P>
        An elevator is a spool or sprocket winding up a rope, belt, or chain. The spool acts like a lever: a bigger spool lifts faster
        but needs more torque. Gravity pulls the same amount everywhere, so an elevator is easier to hold than an arm.
      </P>
      <P>
        Here the question is speed. With too little reduction the motors cannot accelerate the carriage, and the trip takes forever. With
        too much, they accelerate quickly but top out slow. Somewhere in between is the fastest ratio.
      </P>

      <Lab title="Race the elevator to the top" caption="Each point on the curve is a full simulated lift with a 40 A limit per motor. ReCalc's linear mechanism calculator does the same math with friction included.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Choice label="Motor" value={motorId} options={motorOptions} onChange={setMotorId} />
          <Choice label="Motors" value={count} options={[{ value: "1", label: "1" }, { value: "2", label: "2" }]} onChange={setCount} />
          <Slider id="elev-ratio" label="Reduction" value={ratio} min={1} max={40} onChange={setRatio} format={ratioFormat} />
          <Choice label="Spool diameter" value={spool} options={SPOOLS} onChange={setSpool} />
          <Slider id="elev-mass" label="Carriage and game piece" value={mass} min={2} max={20} step={0.5} onChange={setMass} format={(value) => `${fmt(value, 1)} kg`} />
          <Slider id="elev-height" label="Travel" value={height} min={0.4} max={2} step={0.1} onChange={setHeight} format={(value) => `${fmt(value, 1)} m`} />
        </div>
        <LineChart
          ariaLabel="Time to the top for every reduction from 1:1 to 40:1"
          xDomain={[1, 40]}
          yDomain={[0, yMax]}
          xLabel="Reduction (x:1)"
          yLabel="Time to the top (s)"
          series={[
            {
              label: "Time to the top",
              strokeClass: "stroke-primary",
              points: valid.filter((point) => point.timeS <= yMax).map((point) => ({ x: point.ratio, y: point.timeS })),
            },
          ]}
          marker={result.reached ? { x: ratio, y: result.timeS, label: `${fmt(result.timeS, 2)} s` } : undefined}
          vLine={best ? { x: best.ratio, label: `Fastest ${best.ratio}:1` } : undefined}
        />
        <Readouts
          items={[
            { label: "Your time", value: result.reached ? `${fmt(result.timeS, 2)} s` : "Can't lift", tone: result.reached ? "neutral" : "bad" },
            { label: "Fastest possible", value: best ? `${fmt(best.timeS, 2)} s` : "None", note: best ? `at ${best.ratio}:1` : undefined },
            { label: "Holding current", value: `${fmt(result.holdCurrent, 1)} A`, note: hold.label, tone: toneForBand(hold.tone) },
            { label: "Peak current", value: `${fmt(result.peakCurrent)} A`, note: "per motor" },
          ]}
        />
      </Lab>

      <P>
        Real teams usually pick a ratio a little above the fastest one. The curve is flat near the bottom, so you lose almost no time, and
        the extra reduction gives margin for friction, a heavier game piece, and a tired battery.
      </P>
      <Takeaway>Plot time against ratio and pick just past the fastest point. Being a little slow is fine; being unable to lift is not.</Takeaway>
    </>
  );
}

// ---- Chapter 5 -----------------------------------------------------------

function ChapterLimit() {
  const [motorId, setMotorId] = useState("kraken-x44");
  const [ratio, setRatio] = useState(3);
  const motor = motorById(motorId);
  const target = { massKg: 6, heightM: 1.0, spoolDiameterM: 0.0381 };
  const result = useMemo(
    () => simulateElevator({ motor, count: 1, ratio, currentLimit: 60, ...target }),
    [motor, ratio], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const goals = [
    { label: "Lifts 6 kg to 1.0 m with one motor", met: result.reached },
    { label: "Gets there in under 0.7 s", met: result.reached && result.timeS < 0.7 },
    { label: "Holds at the top on under 12 A", met: result.holdCurrent < 12 },
  ];
  const freeSpeed = (freeSpeedRad(motor) / ratio) * (target.spoolDiameterM / 2);

  return (
    <>
      <P>
        FIRST has announced a motor limit for 2027. Every motor on the robot now has to earn its place, so mechanisms that used two motors
        may get one. With half the torque available you have two choices: more reduction, which costs speed, or a stronger motor.
      </P>
      <P>
        Your challenge: an elevator has to lift 6 kg 1.0 m on a 1.5 in spool, using one motor with a 60 A limit. Find a motor and ratio
        that meets all three goals.
      </P>

      <Lab title="One motor, three goals">
        <div className="grid gap-5 sm:grid-cols-2">
          <Choice label="Motor" value={motorId} options={motorOptions} onChange={setMotorId} />
          <Slider id="limit-ratio" label="Reduction" value={ratio} min={1} max={40} onChange={setRatio} format={ratioFormat} />
        </div>
        <LineChart
          ariaLabel="Elevator height over time"
          xDomain={[0, Math.max(1, Math.min(3, result.timeS * 1.15))]}
          yDomain={[0, 1.2]}
          xLabel="Time (s)"
          yLabel="Height (m)"
          series={[{ label: "Height", strokeClass: "stroke-primary", points: result.trace.map((point) => ({ x: point.t, y: point.x })) }]}
          hLine={{ y: 1, label: "1.0 m" }}
          vLine={{ x: 0.7, label: "0.7 s goal" }}
        />
        <Readouts
          items={[
            { label: "Time to 1.0 m", value: result.reached ? `${fmt(result.timeS, 2)} s` : "Can't lift", tone: result.reached ? (result.timeS < 0.7 ? "good" : "warn") : "bad" },
            { label: "Holding current", value: `${fmt(result.holdCurrent, 1)} A`, tone: result.holdCurrent < 12 ? "good" : "bad" },
            { label: "Top speed", value: `${fmt(freeSpeed, 1)} m/s`, note: "with no load" },
            { label: "Current at 1 N·m", value: `${fmt(motorCurrent(motor, 1))} A`, note: "per motor" },
          ]}
        />
        <Goals goals={goals} />
      </Lab>

      <P>
        If you found an answer, write down the motor and ratio. That is the same reasoning you will use in January: start from the
        requirement, check it against the motor's curve, and leave some margin.
      </P>
      <Takeaway>Under a motor limit, the ratio and the motor choice are one decision. Check speed, holding current, and margin together.</Takeaway>
    </>
  );
}

// ---- Quiz ----------------------------------------------------------------

function ChapterQuiz() {
  return (
    <>
      <SkillCheckChapter seedKey="mech-ratios" />
      <p className="text-sm text-muted-foreground">
        Want to go further? Try the same mechanisms in{" "}
        <a href="https://www.reca.lc/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          ReCalc
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
        , which adds friction and real gearbox efficiency.
      </p>
    </>
  );
}
