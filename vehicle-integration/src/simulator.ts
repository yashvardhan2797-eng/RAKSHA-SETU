// ============================================================================
// RAKSHA SETU — Vehicle Integration Simulator (ISOLATED DEMO COMPONENT)
// DETERMINISTIC accident sequence. The demo MUST produce the same predictable
// sequence every time (no randomness) so the live SIH presentation is reliable.
//
// Timeline (relative to "SIMULATE ACCIDENT" click):
//   T0 +0ms   NORMAL                moving normally, risk 0
//   T1 +1s    SUDDEN_DECELERATION   sudden braking begins            risk 30
//   T2 +2s    ABNORMAL_ORIENTATION  abnormal heading/rotation        risk 50
//   T3 +3s    IMPACT_DETECTED       crash + impact signals TRUE      risk 65
//   T4 +4s    VEHICLE_STOPPED       unexpected stop confirmed        risk 65
//   T5 +5s    INCIDENT_GENERATED    ACCIDENT_DETECTED event created,
//                                   serialized and transmitted to the bridge
//   T6 +6s+   (if no driver response) DRIVER_NO_RESPONSE             risk 90 CRITICAL
// ============================================================================

import { CONFIG } from './config.ts';
import { RISK_RULES, RISK_MODEL_LABEL } from './risk.ts';
import { NORMAL_BASELINE } from './telemetry.ts';
import type { SimulationSpec } from './types.ts';

type StepInput = {
  atMs: number;
  eventType: SimulationSpec['accidentSequence'][number]['eventType'];
  log: string;
  transmit?: boolean;
  createsEvent?: boolean;
  speedKmh?: number;
  acceleration?: number;
  deceleration?: number;
  heading?: number;
  status?: SimulationSpec['accidentSequence'][number]['status'];
  signals?: Partial<SimulationSpec['accidentSequence'][number]['signals']>;
  driverResponse?: SimulationSpec['accidentSequence'][number]['driverResponse'];
  risk?: Partial<SimulationSpec['accidentSequence'][number]['risk']>;
};

const STEPS: StepInput[] = [
  {
    atMs: 0, eventType: 'NORMAL_TELEMETRY', log: 'T0 · NORMAL TELEMETRY — vehicle moving normally', transmit: true,
    speedKmh: 62, acceleration: 0.4, deceleration: 0.1, heading: 142, status: 'NORMAL', driverResponse: 'OK',
  },
  {
    atMs: 1000, eventType: 'SUDDEN_DECELERATION', log: 'T1 · SUDDEN DECELERATION — abnormal braking detected', transmit: true,
    speedKmh: 41, acceleration: 0, deceleration: 4.6, heading: 141, status: 'SUDDEN_DECELERATION',
    signals: {}, risk: { suddenDeceleration: true },
  },
  {
    atMs: 2000, eventType: 'ABNORMAL_ORIENTATION', log: 'T2 · ABNORMAL ORIENTATION — unexpected heading change', transmit: true,
    speedKmh: 18, acceleration: 0, deceleration: 6.4, heading: 163, status: 'ABNORMAL_ORIENTATION',
    signals: { abnormalOrientation: true }, risk: { suddenDeceleration: true, abnormalOrientation: true },
  },
  {
    atMs: 3000, eventType: 'IMPACT_DETECTED', log: 'T3 · IMPACT DETECTED — crash signal TRUE', transmit: true,
    speedKmh: 0, acceleration: -8.2, deceleration: 8.2, heading: 142, status: 'IMPACT_DETECTED',
    signals: { abnormalOrientation: true, crashSignal: true, impactDetected: true },
    risk: { suddenDeceleration: true, abnormalOrientation: true, unexpectedStop: true },
  },
  {
    atMs: 4000, eventType: 'VEHICLE_STOPPED', log: 'T4 · VEHICLE STOPPED — unexpected stop confirmed', transmit: true,
    speedKmh: 0, acceleration: 0, deceleration: 8.2, heading: 142, status: 'STOPPED',
    signals: { abnormalOrientation: true, crashSignal: true, impactDetected: true, unexpectedStop: true },
    risk: { suddenDeceleration: true, abnormalOrientation: true, unexpectedStop: true },
  },
  {
    atMs: 5000, eventType: 'ACCIDENT_DETECTED', log: 'T5 · ACCIDENT EVENT CREATED — building telemetry packet', transmit: true, createsEvent: true,
    speedKmh: 0, acceleration: 0, deceleration: 8.2, heading: 142, status: 'STOPPED',
    signals: { abnormalOrientation: true, crashSignal: true, impactDetected: true, unexpectedStop: true },
    driverResponse: 'PENDING',
    risk: { suddenDeceleration: true, abnormalOrientation: true, unexpectedStop: true },
  },
  {
    atMs: CONFIG.driverResponseTimeoutMs, eventType: 'DRIVER_NO_RESPONSE',
    log: 'T6 · DRIVER NO RESPONSE — escalation flag raised', transmit: true,
    speedKmh: 0, acceleration: 0, deceleration: 8.2, heading: 142, status: 'STOPPED',
    signals: { abnormalOrientation: true, crashSignal: true, impactDetected: true, unexpectedStop: true },
    driverResponse: 'NO_RESPONSE',
    risk: { suddenDeceleration: true, abnormalOrientation: true, unexpectedStop: true, driverNoResponse: true },
  },
];

export function buildSimulationSpec(): SimulationSpec {
  return {
    vehicle: { ...CONFIG.vehicle },
    location: { ...CONFIG.location },
    contacts: { ...CONFIG.contacts },
    normalTelemetryIntervalMs: CONFIG.normalTelemetryIntervalMs,
    accidentStepMs: CONFIG.accidentStepMs,
    driverResponseTimeoutMs: CONFIG.driverResponseTimeoutMs,
    baseline: { ...NORMAL_BASELINE },
    accidentSequence: STEPS.map((step) => ({
      atMs: step.atMs,
      eventType: step.eventType,
      log: step.log,
      transmit: step.transmit ?? false,
      createsEvent: step.createsEvent ?? false,
      speedKmh: step.speedKmh ?? NORMAL_BASELINE.speedKmh,
      acceleration: step.acceleration ?? NORMAL_BASELINE.acceleration,
      deceleration: step.deceleration ?? NORMAL_BASELINE.deceleration,
      heading: step.heading ?? NORMAL_BASELINE.heading,
      status: step.status ?? 'NORMAL',
      signals: {
        crashSignal: false, impactDetected: false, sos: false, abnormalOrientation: false, unexpectedStop: false,
        ...(step.signals ?? {}),
      },
      driverResponse: step.driverResponse ?? 'OK',
      risk: {
        suddenDeceleration: false, abnormalOrientation: false, unexpectedStop: false, driverNoResponse: false, manualSos: false,
        ...(step.risk ?? {}),
      },
    })),
    riskRules: RISK_RULES.map((r) => ({ ...r })),
    riskModelLabel: RISK_MODEL_LABEL,
  };
}
