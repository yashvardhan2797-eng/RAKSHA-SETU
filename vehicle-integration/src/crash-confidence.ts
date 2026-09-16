// ============================================================================
// RAKSHA SETU — Vehicle Agent: crash confidence check
//
// Flowchart step ② CRASH CONFIDENCE CHECK.
//
// Deterministic, evidence-based scoring over a rolling window of ECU/OEM
// sensor frames. Deliberately transparent: every indicator is visible with
// its threshold and contribution. It is NOT a certified crash-detection
// algorithm — in production the weights/thresholds are calibrated against
// fleet data and validated against OEM airbag-module behavior.
//
// Three sensor families (two-of-three must fire before an alert):
//   • Motion family — deceleration, yaw, lateral g, wheel-speed ΔV
//   • OEM crash family — airbag deploy signal, belt pretensioner
//   • Contact family — door/hood impact contacts
//
// Guard rails against false positives:
//   • strong decel WITHOUT wheel-speed loss → discounted (hard-braking pattern)
//   • rotation/lateral impulse without speed loss → discounted
//   • vertical shake without speed loss → discounted (pothole pattern)
// ============================================================================

import type { EcuEvidence } from './types.ts';

export const CONFIDENCE_MODEL_LABEL = 'RAKSHA SETU Vehicle Agent — crash confidence v0.1 (prototype, not certified)';

export const CONFIDENCE_THRESHOLDS = {
  decelerationG: 0.45,        // ≥ 0.45 g longitudinal deceleration counts
  lateralG: 0.35,             // ≥ 0.35 g lateral impulse counts
  yawRateDegPerSec: 30,       // ≥ 30 °/s sudden rotation counts
  deltaSpeedKmh: 15,          // ≥ 15 km/h wheel-speed loss inside the window counts
  verticalG: 1.2,             // vertical jolt above this (without speed loss) is discounted
} as const;

export const CONFIDENCE_WEIGHTS = {
  airbag: 35,
  pretension: 15,
  contact: 15,
  deceleration: 15,
  deltaSpeed: 10,
  yaw: 10,
  lateral: 5,
} as const;

/** Confidence at/above which the agent alerts (flowchart ③ RAKSHA SETU APP ALERT). */
export const ALERT_CONFIDENCE = 75;
/** Above this the agent shows a REVIEW state (watch mode, no alert yet). */
export const REVIEW_CONFIDENCE = 40;

/** One evaluated indicator: what was seen, the threshold, the contribution. */
export type ConfidenceIndicator = {
  id: string;
  label: string;
  seen: boolean;
  value: string;
  threshold: string;
  points: number;
  /** why an indicator fired but was excluded as a false-positive pattern */
  discounted?: string;
};

export type ConfidenceResult = {
  /** 0–100 */
  confidence: number;
  level: 'IDLE' | 'REVIEW' | 'CONFIRMED';
  /** flowchart step ⑤ RESPONSE? — an alert is raised only when true */
  alert: boolean;
  reason: string;
  indicators: ConfidenceIndicator[];
  familiesFired: string[];
  /** two-of-three sensor-family gate result */
  familyGate: { passed: boolean; detail: string };
};

export function evaluateCrashConfidence(evidence: EcuEvidence): ConfidenceResult {
  const t = CONFIDENCE_THRESHOLDS;
  const speedLoss = evidence.deltaSpeedKmh;
  const speedRetained = speedLoss < t.deltaSpeedKmh;

  const indicators: ConfidenceIndicator[] = [];
  const push = (id: string, label: string, seen: boolean, value: string, threshold: string, weight: number, discounted?: string) =>
    indicators.push({ id, label, seen, value, threshold, points: seen ? weight : 0, discounted });

  // --- OEM crash family -----------------------------------------------------
  push('airbag', 'Airbag deploy signal', evidence.airbagDeploySignal, evidence.airbagDeploySignal ? 'FIRED' : 'no', 'OEM airbag module', CONFIDENCE_WEIGHTS.airbag);
  push('pretension', 'Belt pretensioner fired', evidence.seatbeltPretensionFired, evidence.seatbeltPretensionFired ? 'FIRED' : 'no', 'OEM airbag module', CONFIDENCE_WEIGHTS.pretension);
  push('contact', 'Impact contacts (doors/hood)', evidence.impactContact, evidence.impactContact ? 'DETECTED' : 'no', 'door/hood sensors', CONFIDENCE_WEIGHTS.contact);

  // --- Motion family (each member carries its false-positive guard) ----------
  const decelSeen = evidence.peakDecelerationG >= t.decelerationG;
  const decelCounts = decelSeen && !speedRetained;
  push('deceleration', 'Peak deceleration', decelSeen, `${evidence.peakDecelerationG.toFixed(2)} g`, `≥ ${t.decelerationG} g`, CONFIDENCE_WEIGHTS.deceleration,
    decelSeen && speedRetained ? 'no wheel-speed loss → hard-braking pattern, discounted' : undefined);

  const yawSeen = evidence.peakYawRateDegPerSec >= t.yawRateDegPerSec;
  const yawCounts = yawSeen && (!speedRetained || evidence.airbagDeploySignal);
  push('yaw', 'Sudden rotation (yaw)', yawSeen, `${evidence.peakYawRateDegPerSec.toFixed(0)} °/s`, `≥ ${t.yawRateDegPerSec} °/s`, CONFIDENCE_WEIGHTS.yaw,
    yawSeen && !yawCounts ? 'no speed loss and no OEM signal → discounted' : undefined);

  const lateralSeen = evidence.peakLateralG >= t.lateralG;
  const lateralCounts = lateralSeen && !speedRetained;
  push('lateral', 'Lateral impulse', lateralSeen, `${evidence.peakLateralG.toFixed(2)} g`, `≥ ${t.lateralG} g`, CONFIDENCE_WEIGHTS.lateral,
    lateralSeen && !lateralCounts ? 'no wheel-speed loss → discounted' : undefined);

  const dvSeen = speedLoss >= t.deltaSpeedKmh;
  push('deltaSpeed', 'Wheel-speed ΔV', dvSeen, `${speedLoss.toFixed(1)} km/h`, `≥ ${t.deltaSpeedKmh} km/h`, CONFIDENCE_WEIGHTS.deltaSpeed);

  // Vertical jolt: informational only (0 points) — classic pothole false-positive.
  const verticalSeen = evidence.peakVerticalG >= t.verticalG;
  push('vertical', 'Vertical jolt', verticalSeen, `${evidence.peakVerticalG.toFixed(2)} g`, `> ${t.verticalG} g`, 0,
    verticalSeen && speedRetained ? 'shake without speed loss → discounted (pothole pattern)' : undefined);

  // --- Two-of-three family gate ----------------------------------------------
  const motionFired = decelCounts || yawCounts || lateralCounts || dvSeen;
  const oemFired = evidence.airbagDeploySignal || evidence.seatbeltPretensionFired;
  const contactFired = evidence.impactContact;
  const families = [motionFired && 'motion', oemFired && 'oem-crash', contactFired && 'contact'].filter(Boolean) as string[];
  const familyGate = {
    passed: families.length >= 2,
    detail: families.length >= 2
      ? `${families.join(' + ')} (${families.length}/3 families) — gate passed`
      : `only ${families.join(' + ') || 'none'} (${families.length}/3 families) — gate not passed`,
  };

  // --- Score -------------------------------------------------------------------
  let score = indicators.reduce((sum, i) => sum + i.points, 0);
  // A single family alone can never alert, regardless of its score.
  if (!familyGate.passed) score = Math.min(score, REVIEW_CONFIDENCE - 1);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level: ConfidenceResult['level'] = score >= ALERT_CONFIDENCE ? 'CONFIRMED' : score >= REVIEW_CONFIDENCE ? 'REVIEW' : 'IDLE';
  const alert = level === 'CONFIRMED';

  const reason = familyGate.passed
    ? `Crash CONFIRMED at ${score}/100 — ${familyGate.detail}`
    : level === 'REVIEW'
      ? `Possible crash pattern (${score}/100) — waiting for corroborating evidence`
      : `No crash pattern (${score}/100) — nominal or guarded sensor signature`;

  return { confidence: score, level, alert, reason, indicators, familiesFired: families, familyGate };
}
