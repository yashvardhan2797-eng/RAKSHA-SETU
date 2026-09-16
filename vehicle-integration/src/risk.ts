// ============================================================================
// RAKSHA SETU — Vehicle Integration Simulator (ISOLATED DEMO COMPONENT)
// Explainable rule-based risk engine.
//
// ⚠ PROTOTYPE / DEMO RISK MODEL — this is NOT a certified automotive crash-
// detection algorithm. Weights mirror the existing RAKSHA SETU prototype UI.
// ============================================================================

import type { SeverityCategory } from './types.ts';

export const RISK_MODEL_LABEL = 'Prototype / Demo Risk Model (not certified crash detection)';

// NOTE: `id` must exactly match the camelCase keys of RiskInput (and of the
// risk objects in the simulator steps / dashboard) — the engine and the
// dashboard look rules up by id: input[rule.id].
export const RISK_RULES = [
  { id: 'suddenDeceleration', label: 'Sudden Deceleration', weight: 30 },
  { id: 'abnormalOrientation', label: 'Abnormal Orientation', weight: 20 },
  { id: 'unexpectedStop', label: 'Unexpected Stop', weight: 15 },
  { id: 'driverNoResponse', label: 'Driver No Response', weight: 25 },
  { id: 'manualSos', label: 'Manual SOS', weight: 30 },
] as const satisfies ReadonlyArray<{ id: keyof RiskInput; label: string; weight: number }>;

export type RiskRuleId = (typeof RISK_RULES)[number]['id'];

export type RiskInput = {
  suddenDeceleration: boolean;
  abnormalOrientation: boolean;
  unexpectedStop: boolean;
  driverNoResponse: boolean;
  manualSos: boolean;
};

export type RiskResult = {
  score: number;
  category: SeverityCategory;
  factors: Array<{ id: RiskRuleId; label: string; weight: number; applied: boolean }>;
  model: string;
};

export function calculateRisk(input: RiskInput): RiskResult {
  let score = 0;
  const factors = RISK_RULES.map((rule) => {
    const applied = Boolean(input[rule.id]);
    if (applied) score += rule.weight;
    return { id: rule.id, label: rule.label, weight: rule.weight, applied };
  });

  // Clamp to the documented 0–100 range.
  score = Math.max(0, Math.min(100, score));

  const category: SeverityCategory =
    score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';

  return { score, category, factors, model: RISK_MODEL_LABEL };
}
