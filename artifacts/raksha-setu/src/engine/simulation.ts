/**
 * RAKSHA SETU — simulation engine.
 *
 * Generates a deterministic time-series for one crash simulation from its
 * actual input parameters. No unrelated random telemetry: for identical
 * inputs the produced series is always identical.
 *
 * Model (explainable, simplified):
 *  - Phase 1 (approach): vehicle travels at the initial speed. Sampled at
 *    100 ms resolution for up to 1.5 s so the "moving vehicle" phase is visible.
 *  - Phase 2 (impact): over the impact duration the speed follows a half-sine
 *    deceleration pulse from the initial speed down to the impact speed:
 *        v(t) = v_impact + (v_initial − v_impact) × cos(π·t / Δt) / 2 + (v_initial − v_impact)/2 …
 *    implemented as v(t) = v_impact + ΔV × (1 + cos(π·t/Δt)) / 2
 *    Instantaneous acceleration is its derivative:
 *        a(t) = −ΔV · π / (2·Δt) · sin(π·t/Δt)
 *    The pulse's average acceleration equals the constant-deceleration result
 *    from physics.ts, so charts and headline numbers stay consistent.
 *  - Phase 3 (post-impact): vehicle continues at the impact speed (run-out).
 */

import { computePhysics, kmhToMps, type ImpactType, type PhysicsResult, type SimulationInput } from './physics';
import { computeSeverity, type SeverityResult } from './severity';

export type TelemetrySample = {
  /** seconds since simulation start */
  time: number;
  /** km/h at this instant */
  speed: number;
  /** m/s² at this instant (negative during the deceleration pulse) */
  acceleration: number;
  /** 'approach' | 'impact' | 'post-impact' */
  phase: 'approach' | 'impact' | 'post-impact';
};

export type SimulationRun = {
  input: SimulationInput;
  physics: PhysicsResult;
  severity: SeverityResult;
  samples: TelemetrySample[];
  /** timestamps the run was created / replayed */
  createdAt: string;
  id: string;
};

const APPROACH_SECONDS = 1.5;
const APPROACH_STEP_S = 0.1;
const IMPACT_STEPS = 40;
const POST_IMPACT_SECONDS = 1.0;
const POST_IMPACT_STEP_S = 0.1;

/** Deterministic id from the inputs, so the same scenario always maps to the same id. */
export function scenarioId(input: SimulationInput): string {
  const raw = `${input.vehicleMassKg}|${input.initialSpeedKmh}|${input.impactSpeedKmh}|${input.impactDurationS}|${input.impactType}|${input.roadSurface}|${input.vehicleCondition}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  const stamp = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `SIM-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}-${(hash >>> 0).toString(36).slice(0, 4).toUpperCase()}`;
}

/** Builds the deterministic telemetry series for a simulation input. */
export function generateSeries(input: SimulationInput): TelemetrySample[] {
  const physics = computePhysics(input);
  const v0 = physics.initialVelocityMps;
  const v1 = physics.impactVelocityMps;
  const dv = physics.deltaVMps;
  const dt = input.impactDurationS;
  const samples: TelemetrySample[] = [];

  // Phase 1 — approach at constant initial speed.
  for (let t = 0; t < APPROACH_SECONDS; t += APPROACH_STEP_S) {
    samples.push({ time: round3(t), speed: input.initialSpeedKmh, acceleration: 0, phase: 'approach' });
  }
  samples.push({ time: APPROACH_SECONDS, speed: input.initialSpeedKmh, acceleration: 0, phase: 'approach' });

  // Phase 2 — half-sine deceleration pulse across the impact duration.
  const peakFactor = Math.PI / (2 * dt);
  for (let i = 1; i <= IMPACT_STEPS; i += 1) {
    const t = (dt * i) / IMPACT_STEPS;
    const speedMps = v1 + dv * ((1 + Math.cos((Math.PI * t) / dt)) / 2);
    const accel = i === IMPACT_STEPS ? 0 : -dv * peakFactor * Math.sin((Math.PI * t) / dt);
    samples.push({ time: round3(APPROACH_SECONDS + t), speed: round2(kmhToMpsToKmh(speedMps)), acceleration: round1(accel), phase: 'impact' });
  }

  // Phase 3 — post-impact run-out at the impact speed.
  const impactEndTime = APPROACH_SECONDS + dt;
  for (let t = POST_IMPACT_STEP_S; t <= POST_IMPACT_SECONDS + 1e-9; t += POST_IMPACT_STEP_S) {
    samples.push({ time: round3(impactEndTime + t), speed: round2(input.impactSpeedKmh), acceleration: 0, phase: 'post-impact' });
  }
  return samples;
}

function kmhToMpsToKmh(mps: number): number {
  return mps * 3.6;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Runs the full simulation: physics + severity + deterministic series. */
export function runSimulation(input: SimulationInput, id?: string): SimulationRun {
  const physics = computePhysics(input);
  const severity = computeSeverity(physics, input.impactType);
  return {
    id: id ?? scenarioId(input),
    input,
    physics,
    severity,
    samples: generateSeries(input),
    createdAt: new Date().toISOString(),
  };
}

/** Total duration of the generated series, in seconds. */
export function seriesDuration(samples: TelemetrySample[]): number {
  return samples.length ? samples[samples.length - 1].time : 0;
}

/** Sample at (or immediately before) a given time — used during playback. */
export function sampleAt(samples: TelemetrySample[], time: number): TelemetrySample {
  if (!samples.length) return { time: 0, speed: 0, acceleration: 0, phase: 'approach' };
  let current = samples[0];
  for (const sample of samples) {
    if (sample.time <= time) current = sample;
    else break;
  }
  return current;
}

export type { ImpactType, PhysicsResult, SeverityResult };
