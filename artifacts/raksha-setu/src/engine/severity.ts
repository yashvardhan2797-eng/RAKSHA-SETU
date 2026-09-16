/**
 * RAKSHA SETU — severity engine.
 *
 * Severity classification is a demonstration rule based on simulated vehicle
 * dynamics (ΔV, deceleration, estimated force, impact duration). It is NOT a
 * certified crashworthiness or medical severity assessment.
 *
 * The model is deterministic: identical inputs always produce identical output.
 *
 * Weighted risk score (0–100):
 *   ΔV (35%)            — normalized against a 0–25 m/s envelope
 *   Deceleration (25%)  — normalized against a 0–250 m/s envelope
 *   Force (30%)         — normalized against a 0–2000 kN envelope
 *   Duration (10%)      — shorter impacts score higher (0.01–2.00 s, inverted)
 *
 * An impact-type factor (see physics.ts) adjusts the final score within the
 * same 0–100 scale. Categories: 0–24 LOW · 25–49 MODERATE · 50–74 HIGH · 75–100 CRITICAL.
 */

import type { ImpactType, PhysicsResult } from './physics';

export type SeverityLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

/** Normalizes a value against an envelope and clamps to [0, 1]. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Demonstration impact-type factors applied to the base score (not official standards). */
export const IMPACT_TYPE_FACTORS: Record<ImpactType, number> = {
  Frontal: 1.0,
  Rear: 0.8,
  Side: 0.95,
  Oblique: 0.9,
  'Static Object': 1.05,
};

/** Score envelope constants (documented, fixed — not tuned per run). */
export const SEVERITY_ENVELOPES = {
  deltaV: 25, // m/s
  deceleration: 250, // m/s²
  forceKN: 2000, // kN
  duration: 2.0, // s (shorter duration → higher score)
} as const;

export const SEVERITY_WEIGHTS = {
  deltaV: 0.35,
  deceleration: 0.25,
  force: 0.3,
  duration: 0.1,
} as const;

export const SEVERITY_THRESHOLDS = {
  LOW: [0, 24],
  MODERATE: [25, 49],
  HIGH: [50, 74],
  CRITICAL: [75, 100],
} as const;

export type SeverityFactor = { label: string; contribution: number; detail: string };

export type SeverityResult = {
  level: SeverityLevel;
  /** 0–100, rounded to one decimal */
  score: number;
  /** Human-readable justification for the classification */
  reason: string;
  factors: SeverityFactor[];
};

function levelFor(score: number): SeverityLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

/** Deterministic severity evaluation from the physics result and impact type. */
export function computeSeverity(physics: PhysicsResult, impactType: ImpactType): SeverityResult {
  const dvNorm = clamp01(physics.deltaVMps / SEVERITY_ENVELOPES.deltaV);
  const decNorm = clamp01(physics.decelerationMps2 / SEVERITY_ENVELOPES.deceleration);
  const forceNorm = clamp01(physics.estimatedForceKN / SEVERITY_ENVELOPES.forceKN);
  const durationNorm = clamp01(1 - physics.impactDurationS / SEVERITY_ENVELOPES.duration);

  const base =
    dvNorm * SEVERITY_WEIGHTS.deltaV +
    decNorm * SEVERITY_WEIGHTS.deceleration +
    forceNorm * SEVERITY_WEIGHTS.force +
    durationNorm * SEVERITY_WEIGHTS.duration;

  const typeFactor = IMPACT_TYPE_FACTORS[impactType];
  const score = Math.round(Math.min(100, base * 100 * typeFactor) * 10) / 10;
  const level = levelFor(score);

  const factors: SeverityFactor[] = [
    { label: 'ΔV', contribution: Math.round(dvNorm * SEVERITY_WEIGHTS.deltaV * 100 * typeFactor * 10) / 10, detail: `${physics.deltaVMps.toFixed(2)} m/s of ${SEVERITY_ENVELOPES.deltaV} m/s envelope` },
    { label: 'Deceleration', contribution: Math.round(decNorm * SEVERITY_WEIGHTS.deceleration * 100 * typeFactor * 10) / 10, detail: `${physics.decelerationMps2.toFixed(1)} m/s² of ${SEVERITY_ENVELOPES.deceleration} m/s² envelope` },
    { label: 'Estimated force', contribution: Math.round(forceNorm * SEVERITY_WEIGHTS.force * 100 * typeFactor * 10) / 10, detail: `${physics.estimatedForceKN.toFixed(1)} kN of ${SEVERITY_ENVELOPES.forceKN} kN envelope` },
    { label: 'Impact duration', contribution: Math.round(durationNorm * SEVERITY_WEIGHTS.duration * 100 * typeFactor * 10) / 10, detail: `${physics.impactDurationS.toFixed(2)} s (shorter impacts score higher)` },
    { label: 'Impact type', contribution: 0, detail: `${impactType} × ${typeFactor} factor` },
  ];

  const reason = `${level} classification from a weighted demonstration score of ${score.toFixed(1)}/100 — dominated by ${[...factors].sort((a, b) => b.contribution - a.contribution)[0].label.toLowerCase()}.`;

  return { level, score, reason, factors };
}
