/**
 * RAKSHA SETU — physics engine.
 *
 * SIMULATION ONLY. All values come from a simplified one-dimensional
 * constant-deceleration model and are NOT a certified crash reconstruction
 * or automotive safety assessment. See src/engine/methodology.ts.
 *
 * Conventions:
 * - SI units internally (m/s, m/s², N, J).
 * - Speeds enter/exit as km/h (UI-facing).
 * - Every result carries its formula so the About/Methodology page and
 *   each report can show exactly how a number was produced.
 */

/** Standard gravity used for g-force conversion (m/s²). */
export const STANDARD_GRAVITY = 9.81;

/** km/h → m/s.  velocity_mps = velocity_kmh / 3.6 */
export function kmhToMps(kmh: number): number {
  return kmh / 3.6;
}

/** m/s → km/h. */
export function mpsToKmh(mps: number): number {
  return mps * 3.6;
}

/** Magnitude of the change in velocity: ΔV = |v_initial − v_impact| (m/s). */
export function deltaV(initialVelocityMps: number, impactVelocityMps: number): number {
  return Math.abs(initialVelocityMps - impactVelocityMps);
}

/** Average deceleration over the impact: a = ΔV / Δt (m/s², returned positive). */
export function averageDeceleration(deltaVelocityMps: number, durationS: number): number {
  if (durationS <= 0) throw new Error('Impact duration must be greater than zero');
  return deltaVelocityMps / durationS;
}

/** g-force equivalent of an acceleration in m/s².  gForce = a / 9.81 */
export function toGForce(accelerationMps2: number): number {
  return accelerationMps2 / STANDARD_GRAVITY;
}

/** Estimated average impact force: F = m × a (N). Positive magnitude. */
export function estimatedImpactForce(massKg: number, averageDecelerationMps2: number): number {
  return massKg * averageDecelerationMps2;
}

/** Kinetic energy: KE = ½ m v² (J). */
export function kineticEnergy(massKg: number, velocityMps: number): number {
  return 0.5 * massKg * velocityMps * velocityMps;
}

/** Impact-type multipliers on severity scoring (demonstration values, not standards). */
export type ImpactType = 'Frontal' | 'Rear' | 'Side' | 'Oblique' | 'Static Object';

export type SimulationInput = {
  /** 500–5000 kg */
  vehicleMassKg: number;
  /** 0–200 km/h */
  initialSpeedKmh: number;
  /** 0–200 km/h (≤ initial speed for normal impact scenarios) */
  impactSpeedKmh: number;
  /** 0.01–2.00 s */
  impactDurationS: number;
  impactType: ImpactType;
  roadSurface: 'Dry' | 'Wet' | 'Unknown';
  vehicleCondition: 'Normal' | 'Heavy' | 'Unknown';
};

export type PhysicsResult = {
  /** m/s */
  initialVelocityMps: number;
  /** m/s */
  impactVelocityMps: number;
  /** m/s */
  deltaVMps: number;
  /** km/h — same ΔV expressed for display */
  deltaVKmh: number;
  /** s */
  impactDurationS: number;
  /** m/s² (positive magnitude) */
  decelerationMps2: number;
  /** g */
  gForce: number;
  /** Estimated Average Impact Force, N */
  estimatedForceN: number;
  /** Estimated Average Impact Force, kN */
  estimatedForceKN: number;
  /** J, at initial speed */
  initialKineticEnergyJ: number;
  /** J, at impact speed */
  impactKineticEnergyJ: number;
  /** J dissipated by the impact (KE_initial − KE_impact) */
  energyDissipatedJ: number;
};

/** Full physics pass for one simulation input. Pure and deterministic. */
export function computePhysics(input: SimulationInput): PhysicsResult {
  const initialVelocityMps = kmhToMps(input.initialSpeedKmh);
  const impactVelocityMps = kmhToMps(input.impactSpeedKmh);
  const dv = deltaV(initialVelocityMps, impactVelocityMps);
  const deceleration = averageDeceleration(dv, input.impactDurationS);
  const forceN = estimatedImpactForce(input.vehicleMassKg, deceleration);
  const keInitial = kineticEnergy(input.vehicleMassKg, initialVelocityMps);
  const keImpact = kineticEnergy(input.vehicleMassKg, impactVelocityMps);

  return {
    initialVelocityMps,
    impactVelocityMps,
    deltaVMps: dv,
    deltaVKmh: mpsToKmh(dv),
    impactDurationS: input.impactDurationS,
    decelerationMps2: deceleration,
    gForce: toGForce(deceleration),
    estimatedForceN: forceN,
    estimatedForceKN: forceN / 1000,
    initialKineticEnergyJ: keInitial,
    impactKineticEnergyJ: keImpact,
    energyDissipatedJ: keInitial - keImpact,
  };
}

export const PHYSICS_FORMULAS = {
  velocityConversion: 'velocity_mps = velocity_kmh / 3.6',
  deltaV: 'ΔV = |v_initial − v_impact|',
  deceleration: 'a = ΔV / Δt',
  gForce: 'g = a / 9.81',
  force: 'F = m × a  (Estimated Average Impact Force)',
  kineticEnergy: 'KE = ½ × m × v²',
} as const;
