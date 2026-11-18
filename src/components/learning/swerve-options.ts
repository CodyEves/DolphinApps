/*
 * Common FRC swerve modules and the physics to turn a module choice plus a
 * robot weight into a top speed and an acceleration for the drive simulator.
 *
 * Free speed = motor free RPM ÷ gear ratio × wheel circumference.
 * Ratios are the vendors' published ones. The WCP Swerve X2 numbers are taken
 * from WCP's published speed range for each ratio set (Kraken X60, middle 11T
 * pinion), so they are marked approximate.
 */

export type MotorKey = "krakenX60" | "neoVortex" | "neo";

export const MOTORS: Record<MotorKey, { label: string; freeRpm: number; stallTorqueNm: number; stallAmps: number; currentLimit: number }> = {
  // Kraken X60 without FOC, NEO Vortex, NEO V1.1 (manufacturer specs at 12 V).
  krakenX60: { label: "Kraken X60", freeRpm: 6000, stallTorqueNm: 7.09, stallAmps: 366, currentLimit: 80 },
  neoVortex: { label: "NEO Vortex", freeRpm: 6784, stallTorqueNm: 3.6, stallAmps: 211, currentLimit: 80 },
  neo: { label: "NEO", freeRpm: 5676, stallTorqueNm: 2.6, stallAmps: 105, currentLimit: 60 },
};

export type SwerveOption = {
  id: string;
  vendor: "SDS" | "REV" | "WCP";
  module: string;
  gearing: string;
  ratio: number;
  wheelIn: number;
  approx?: boolean;
};

/** WCP publishes speeds, not ratios: back out the ratio from a Kraken X60 free speed on a 4 in wheel. */
function wcpRatio(krakenFtPerS: number) {
  return (6000 / 60) * ((Math.PI * 4) / 12) / krakenFtPerS;
}

export const SWERVE_OPTIONS: SwerveOption[] = [
  // MK5i and MK5n share the same three drive ratios and 4 in wheel (SDS gear ratio table), so one row covers both.
  { id: "mk5-r1", vendor: "SDS", module: "MK5i / MK5n", gearing: "R1", ratio: 7.03, wheelIn: 4 },
  { id: "mk5-r2", vendor: "SDS", module: "MK5i / MK5n", gearing: "R2", ratio: 6.03, wheelIn: 4 },
  { id: "mk5-r3", vendor: "SDS", module: "MK5i / MK5n", gearing: "R3", ratio: 5.27, wheelIn: 4 },
  { id: "mk4i-l1", vendor: "SDS", module: "MK4i", gearing: "L1", ratio: 8.14, wheelIn: 4 },
  { id: "mk4i-l2", vendor: "SDS", module: "MK4i", gearing: "L2", ratio: 6.75, wheelIn: 4 },
  { id: "mk4i-l3", vendor: "SDS", module: "MK4i", gearing: "L3", ratio: 6.12, wheelIn: 4 },
  { id: "mk4n-l1p", vendor: "SDS", module: "MK4n", gearing: "L1+", ratio: 7.13, wheelIn: 4 },
  { id: "mk4n-l2p", vendor: "SDS", module: "MK4n", gearing: "L2+", ratio: 5.9, wheelIn: 4 },
  { id: "mk4n-l3p", vendor: "SDS", module: "MK4n", gearing: "L3+", ratio: 5.36, wheelIn: 4 },
  { id: "max-low", vendor: "REV", module: "MAXSwerve", gearing: "Low (12T)", ratio: 5.5, wheelIn: 3 },
  { id: "max-med", vendor: "REV", module: "MAXSwerve", gearing: "Medium (13T)", ratio: 22 / 13 * 3, wheelIn: 3 },
  { id: "max-high", vendor: "REV", module: "MAXSwerve", gearing: "High (14T)", ratio: 22 / 14 * 3, wheelIn: 3 },
  { id: "x2-x1", vendor: "WCP", module: "Swerve X2", gearing: "X1 set", ratio: wcpRatio(14.5), wheelIn: 4, approx: true },
  { id: "x2-x2", vendor: "WCP", module: "Swerve X2", gearing: "X2 set", ratio: wcpRatio(16.5), wheelIn: 4, approx: true },
  { id: "x2-x3", vendor: "WCP", module: "Swerve X2", gearing: "X3 set", ratio: wcpRatio(17.5), wheelIn: 4, approx: true },
  { id: "x2-x4", vendor: "WCP", module: "Swerve X2", gearing: "X4 set", ratio: wcpRatio(20), wheelIn: 4, approx: true },
];

/** Free speed in ft/s: how fast the wheels would turn with no load at all. */
export function freeSpeedFtPerS(option: SwerveOption, motor: MotorKey) {
  return (MOTORS[motor].freeRpm / option.ratio / 60) * ((Math.PI * option.wheelIn) / 12);
}

/** Real robots never reach free speed: friction and battery sag eat some of it. */
export const USABLE_FRACTION = 0.85;
/** Tread on carpet: the wheels slip past about this many g of acceleration. */
const TRACTION_G = 1.0;
const GEAR_EFFICIENCY = 0.85;
/** A charged battery's open-circuit voltage, and battery + wiring resistance. */
const BATTERY_VOLTS = 12.5;
const BATTERY_OHMS = 0.018;

/**
 * Top speed and an equivalent steady acceleration for a 4-module swerve robot.
 *
 * Steps the robot forward from rest with a simple DC motor model: each motor
 * draws the smaller of its current limit and what the battery voltage can push
 * through it at that speed; four motors pulling hard sag the battery voltage;
 * and the wheels can't push harder than tread traction allows. The
 * acceleration returned is "top speed ÷ time to reach it", which is what the
 * simulator's speed-up/slow-down model needs.
 */
export function drivetrainPerformance(option: SwerveOption, motor: MotorKey, weightLb: number, currentLimit: number) {
  const spec = MOTORS[motor];
  const free = freeSpeedFtPerS(option, motor);
  const top = free * USABLE_FRACTION;
  const massKg = weightLb * 0.4536;
  const wheelM = (option.wheelIn * 0.0254) / 2;
  const resistance = 12 / spec.stallAmps;
  const kt = spec.stallTorqueNm / spec.stallAmps;
  const ke = 12 / ((spec.freeRpm * 2 * Math.PI) / 60); // volts per rad/s
  const tractionMs2 = TRACTION_G * 9.81;
  const topMs = top * 0.3048;

  let v = 0;
  let t = 0;
  let tractionTime = 0;
  let minVolts = BATTERY_VOLTS;
  const dt = 0.002;

  while (v < topMs && t < 15) {
    const omega = (v / wheelM) * option.ratio;
    let volts = BATTERY_VOLTS;
    let amps = 0;

    // Battery voltage and motor current depend on each other; a few passes settle it.
    for (let i = 0; i < 4; i++) {
      amps = Math.max(0, Math.min(currentLimit, (volts - ke * omega) / resistance));
      volts = BATTERY_VOLTS - BATTERY_OHMS * 4 * amps;
    }

    const force = (4 * kt * amps * option.ratio * GEAR_EFFICIENCY) / wheelM;
    const motorAccel = force / massKg;
    const accel = Math.min(tractionMs2, motorAccel);

    if (motorAccel >= tractionMs2) {
      tractionTime += dt;
    }

    if (accel <= 1e-3) {
      break;
    }

    minVolts = Math.min(minVolts, volts);
    v += accel * dt;
    t += dt;
  }

  return {
    freeFtPerS: free,
    topFtPerS: top,
    accelFtPerS2: top / t,
    timeToTop: t,
    /** Share of the speed-up spent with the wheels at the edge of slipping. */
    tractionShare: t > 0 ? tractionTime / t : 0,
    minVolts,
  };
}
