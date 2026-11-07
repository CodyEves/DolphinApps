/**
 * Simple DC motor + gearbox model for the "Pick a motor and gear ratio" lesson.
 *
 * Each motor is a straight torque-speed line at 12 V:
 *   torque(ω) = stallTorque × (1 − ω / freeSpeed)
 *   current   = freeCurrent + torque / kT
 * A reduction of G:1 divides speed by G and multiplies torque by G.
 * Friction and gearbox losses are ignored, so real mechanisms will be a little
 * slower and draw a little more current than these numbers.
 */

export type Motor = {
  id: string;
  name: string;
  freeSpeedRpm: number;
  stallTorque: number; // N·m
  stallCurrent: number; // A
  freeCurrent: number; // A
};

/** 12 V specs. REV docs for NEO family; Kraken values are trapezoidal (no FOC). */
export const MOTORS: Motor[] = [
  { id: "kraken-x60", name: "Kraken X60", freeSpeedRpm: 6000, stallTorque: 7.09, stallCurrent: 366, freeCurrent: 2 },
  { id: "kraken-x44", name: "Kraken X44", freeSpeedRpm: 7530, stallTorque: 4.05, stallCurrent: 275, freeCurrent: 2 },
  { id: "neo-vortex", name: "NEO Vortex", freeSpeedRpm: 6784, stallTorque: 3.6, stallCurrent: 211, freeCurrent: 3.6 },
  { id: "neo", name: "NEO", freeSpeedRpm: 5676, stallTorque: 2.6, stallCurrent: 105, freeCurrent: 1.8 },
  { id: "neo-550", name: "NEO 550", freeSpeedRpm: 11000, stallTorque: 0.97, stallCurrent: 100, freeCurrent: 1.4 },
];

export const G = 9.81;
const RPM_TO_RAD = (2 * Math.PI) / 60;

export function motorById(id: string) {
  return MOTORS.find((motor) => motor.id === id) ?? MOTORS[0];
}

export function freeSpeedRad(motor: Motor) {
  return motor.freeSpeedRpm * RPM_TO_RAD;
}

export function kT(motor: Motor) {
  return motor.stallTorque / (motor.stallCurrent - motor.freeCurrent);
}

/** Torque one motor makes at a motor speed (rad/s), optionally capped by a current limit (A). */
export function motorTorque(motor: Motor, speedRad: number, currentLimit?: number) {
  const curve = motor.stallTorque * (1 - speedRad / freeSpeedRad(motor));
  const capped = currentLimit === undefined ? curve : Math.min(curve, kT(motor) * (currentLimit - motor.freeCurrent));

  return Math.max(-motor.stallTorque, capped);
}

/** Current one motor draws while making a torque (N·m). */
export function motorCurrent(motor: Motor, torque: number) {
  return motor.freeCurrent + Math.abs(torque) / kT(motor);
}

/** Output free speed (RPM) and stall torque (N·m) through a G:1 reduction with n motors. */
export function geared(motor: Motor, ratio: number, count = 1) {
  return {
    freeSpeedRpm: motor.freeSpeedRpm / ratio,
    stallTorque: motor.stallTorque * ratio * count,
  };
}

/** Operating point when the output has to hold or push a load torque (N·m). */
export function operatingPoint(motor: Motor, ratio: number, count: number, loadTorque: number) {
  const outputStall = motor.stallTorque * ratio * count;
  const fraction = Math.min(1, Math.max(0, loadTorque / outputStall));
  const motorTorquePer = motor.stallTorque * fraction;
  const outputRpm = (motor.freeSpeedRpm * (1 - fraction)) / ratio;
  const current = motorCurrent(motor, motorTorquePer);
  const powerW = loadTorque * outputRpm * RPM_TO_RAD;

  return { fraction, outputRpm, currentPerMotor: current, powerW, stalled: fraction >= 1 };
}

export type ArmInput = {
  motor: Motor;
  count: number;
  ratio: number;
  massKg: number; // mass at the end of the arm (treated as a point mass)
  lengthM: number; // pivot to center of mass
  currentLimit: number; // A per motor
};

export type SimResult = {
  reached: boolean;
  timeS: number;
  peakCurrent: number; // A per motor
  holdCurrent: number; // A per motor to hold at the worst point
  holdFraction: number; // share of geared stall torque used to hold
  trace: { t: number; x: number; current: number }[];
};

/** Swing an arm from horizontal (0°) to straight up (90°) at full power. */
export function simulateArm(input: ArmInput): SimResult {
  const { motor, count, ratio, massKg, lengthM, currentLimit } = input;
  const inertia = massKg * lengthM * lengthM;
  const gravityMax = massKg * G * lengthM;
  const holdMotorTorque = gravityMax / (ratio * count);
  const holdCurrent = motorCurrent(motor, holdMotorTorque);
  const dt = 0.001;
  let theta = 0;
  let omega = 0;
  let t = 0;
  let peakCurrent = 0;
  const trace: SimResult["trace"] = [];

  while (theta < Math.PI / 2 && t < 6) {
    const motorSpeed = omega * ratio;
    const torquePerMotor = motorTorque(motor, motorSpeed, currentLimit);
    const current = motorCurrent(motor, torquePerMotor);
    const net = torquePerMotor * ratio * count - gravityMax * Math.cos(theta);
    const alpha = net / inertia;

    omega = Math.max(0, omega + alpha * dt);
    theta += omega * dt;
    t += dt;
    peakCurrent = Math.max(peakCurrent, current);

    if (trace.length === 0 || t - trace[trace.length - 1].t >= 0.02) {
      trace.push({ t, x: (theta * 180) / Math.PI, current });
    }

    if (omega === 0 && net <= 0) {
      break;
    }
  }

  return {
    reached: theta >= Math.PI / 2,
    timeS: t,
    peakCurrent,
    holdCurrent,
    holdFraction: holdMotorTorque / motor.stallTorque,
    trace,
  };
}

export type ElevatorInput = {
  motor: Motor;
  count: number;
  ratio: number;
  massKg: number; // carriage + game piece
  spoolDiameterM: number;
  heightM: number;
  currentLimit: number; // A per motor
};

/** Lift an elevator from the bottom to a height at full power. */
export function simulateElevator(input: ElevatorInput): SimResult {
  const { motor, count, ratio, massKg, spoolDiameterM, heightM, currentLimit } = input;
  const radius = spoolDiameterM / 2;
  const weight = massKg * G;
  const holdMotorTorque = (weight * radius) / (ratio * count);
  const holdCurrent = motorCurrent(motor, holdMotorTorque);
  const dt = 0.001;
  let x = 0;
  let v = 0;
  let t = 0;
  let peakCurrent = 0;
  const trace: SimResult["trace"] = [];

  while (x < heightM && t < 6) {
    const motorSpeed = (v / radius) * ratio;
    const torquePerMotor = motorTorque(motor, motorSpeed, currentLimit);
    const current = motorCurrent(motor, torquePerMotor);
    const force = (torquePerMotor * ratio * count) / radius - weight;
    const a = force / massKg;

    v = Math.max(0, v + a * dt);
    x += v * dt;
    t += dt;
    peakCurrent = Math.max(peakCurrent, current);

    if (trace.length === 0 || t - trace[trace.length - 1].t >= 0.02) {
      trace.push({ t, x, current });
    }

    if (v === 0 && force <= 0) {
      break;
    }
  }

  return {
    reached: x >= heightM,
    timeS: t,
    peakCurrent,
    holdCurrent,
    holdFraction: holdMotorTorque / motor.stallTorque,
    trace,
  };
}

/** Time to the top for a range of ratios; `null` where the elevator cannot lift. */
export function elevatorSweep(input: Omit<ElevatorInput, "ratio">, ratios: number[]) {
  return ratios.map((ratio) => {
    const result = simulateElevator({ ...input, ratio });

    return { ratio, timeS: result.reached ? result.timeS : null };
  });
}

/** Rough heat guidance for continuous current per motor. */
export function heatBand(current: number) {
  if (current < 20) {
    return { label: "Cool", tone: "good" as const };
  }

  if (current < 40) {
    return { label: "Warm", tone: "warn" as const };
  }

  return { label: "Hot: will overheat or trip the breaker", tone: "bad" as const };
}
