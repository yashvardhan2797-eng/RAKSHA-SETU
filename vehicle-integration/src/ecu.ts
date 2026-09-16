// ============================================================================
// RAKSHA SETU — Vehicle Agent: ECU / OEM telematics sensor bus
//
// Flowchart step ① POSSIBLE CRASH — data acquisition.
//
// The software installed in the car reads sensor frames from:
//   • the ECU / CAN bus  (wheel speed, IMU accelerations, yaw rate)
//   • the OEM telematics unit / T-Box (airbag module, belt pretensioner,
//     impact contacts — the OEM's own crash signals)
//   • the GNSS receiver (position + independent speed cross-check)
//
// ⚠ PROTOTYPE: the frames come from a SIMULATED source so the demo runs with
// no vehicle hardware. In production the same `EcuFrame` interface is fed by a
// CAN driver (ISO 15765-4 / OBD-II, or a direct CAN socket) and the OEM cloud
// telematics API. Nothing in this file hard-codes crash outcomes — it only
// transports raw sensor values; the decision is made by crash-confidence.ts.
// ============================================================================

import { CONFIG } from './config.ts';
import type { EcuEvidence, EcuFrame } from './types.ts';

/** Sensor channels exposed by the bus — displayed on the vehicle dashboard. */
export const ECU_CHANNELS = [
  { id: 'speedKmh', label: 'Wheel speed', unit: 'km/h', source: 'CAN' },
  { id: 'accelLongitudinalG', label: 'Longitudinal accel', unit: 'g', source: 'CAN' },
  { id: 'accelLateralG', label: 'Lateral accel', unit: 'g', source: 'CAN' },
  { id: 'accelVerticalG', label: 'Vertical accel', unit: 'g', source: 'CAN' },
  { id: 'yawRateDegPerSec', label: 'Yaw rate', unit: '°/s', source: 'CAN' },
  { id: 'airbagDeploySignal', label: 'Airbag deploy signal', unit: '', source: 'OEM-TBOX' },
  { id: 'seatbeltPretensionFired', label: 'Belt pretensioner', unit: '', source: 'OEM-TBOX' },
  { id: 'impactContact', label: 'Impact contacts (doors/hood)', unit: '', source: 'OEM-TBOX' },
  { id: 'gpsSpeedKmh', label: 'GNSS speed cross-check', unit: 'km/h', source: 'GNSS' },
] as const;

/** Length of the rolling evidence window, in frames (10 Hz → 2.0 s). */
export const EVIDENCE_WINDOW_FRAMES = 20;

/** Scenario drives the simulated sensor values — the agent never invents them. */
export type EcuScenario =
  | 'NORMAL_DRIVING'
  | 'HARD_BRAKING'      // abrupt braking, no rotation, no OEM crash signals
  | 'CRASH_IMPACT'      // full crash signature (the real detection case)
  | 'POTHOLE_SHAKE'     // false-positive bait: strong vertical jolt, speed retained
  | 'POST_CRASH_STOPPED';

export type ScenarioState = { lastSpeedKmh: number; phaseMs: number };

let frameCounter = 0;

/** Builds one simulated sensor frame for the scenario, advanced by `dtMs`. */
export function readEcuFrame(scenario: EcuScenario, state: ScenarioState, dtMs: number): EcuFrame {
  frameCounter += 1;
  state.phaseMs += dtMs;
  const t = new Date().toISOString();
  const wobble = (n: number, amp: number) => Math.round((Math.sin(frameCounter * n) * amp) * 100) / 100;

  switch (scenario) {
    case 'NORMAL_DRIVING':
      state.lastSpeedKmh = 62 + wobble(0.7, 1.2);
      return frame(t, state.lastSpeedKmh, wobble(1.1, 0.12), wobble(0.9, 0.08), wobble(1.3, 0.05), wobble(1.7, 2.5), false, false, false);

    case 'HARD_BRAKING':
      state.lastSpeedKmh = Math.max(0, state.lastSpeedKmh - dtMs * 0.022);
      return frame(t, state.lastSpeedKmh, -0.38, wobble(0.9, 0.10), wobble(1.3, 0.05), wobble(1.7, 3), false, false, false);

    case 'CRASH_IMPACT': {
      // Deterministic crash signature: hard decel spike → yaw spike → OEM crash
      // signals fire → wheel speed collapses to zero.
      const phase = state.phaseMs;
      const decel = phase < 400 ? -3.1 : phase < 900 ? -1.4 : -0.1;
      const yaw = phase < 300 ? 6 : phase < 800 ? 41 : 12;
      const speed = phase < 900 ? Math.max(0, state.lastSpeedKmh - dtMs * 0.05) : 0;
      state.lastSpeedKmh = speed;
      return frame(t, speed, decel, phase < 800 ? 0.42 : 0.05, phase < 500 ? 0.31 : 0.04, yaw, phase >= 250, phase >= 350, phase >= 300);
    }

    case 'POTHOLE_SHAKE':
      // Speed barely changes — the confidence check must NOT call this a crash.
      state.lastSpeedKmh = Math.max(0, state.lastSpeedKmh - dtMs * 0.001);
      return frame(t, state.lastSpeedKmh, -0.12, wobble(0.9, 0.15), -1.6, wobble(1.7, 14), false, false, false);

    case 'POST_CRASH_STOPPED':
      state.lastSpeedKmh = 0;
      return frame(t, 0, 0, 0, wobble(1.3, 0.03), 0, true, true, true);
  }
}

function frame(t: string, speedKmh: number, longG: number, latG: number, vertG: number, yaw: number, airbag: boolean, pretension: boolean, contact: boolean): EcuFrame {
  const lat = CONFIG.location.latitude;
  const lng = CONFIG.location.longitude;
  return {
    t,
    source: 'CAN',
    speedKmh: round1(speedKmh),
    accelLongitudinalG: round2(longG),
    accelLateralG: round2(latG),
    accelVerticalG: round2(vertG),
    yawRateDegPerSec: round1(yaw),
    airbagDeploySignal: airbag,
    seatbeltPretensionFired: pretension,
    impactContact: contact,
    gps: { latitude: lat, longitude: lng, fix: true, speedKmh: round1(Math.abs(speedKmh + 1.5)) },
    simulated: true,
  };
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

/** Reduces a rolling window of frames into the evidence the confidence check consumes. */
export function buildEvidence(window: EcuFrame[]): EcuEvidence {
  if (!window.length) {
    return { peakDecelerationG: 0, peakLateralG: 0, peakYawRateDegPerSec: 0, peakVerticalG: 0, airbagDeploySignal: false, seatbeltPretensionFired: false, impactContact: false, preCrashSpeedKmh: 0, postSpeedKmh: 0, deltaSpeedKmh: 0, windowFrames: 0 };
  }
  const speeds = window.map((f) => f.speedKmh);
  const preCrashSpeedKmh = Math.max(...speeds);
  const postSpeedKmh = speeds[speeds.length - 1];
  return {
    peakDecelerationG: Math.max(0, ...window.map((f) => -f.accelLongitudinalG)),
    peakLateralG: Math.max(0, ...window.map((f) => Math.abs(f.accelLateralG))),
    peakYawRateDegPerSec: Math.max(0, ...window.map((f) => Math.abs(f.yawRateDegPerSec))),
    peakVerticalG: Math.max(0, ...window.map((f) => Math.abs(f.accelVerticalG))),
    airbagDeploySignal: window.some((f) => f.airbagDeploySignal),
    seatbeltPretensionFired: window.some((f) => f.seatbeltPretensionFired),
    impactContact: window.some((f) => f.impactContact),
    preCrashSpeedKmh,
    postSpeedKmh,
    deltaSpeedKmh: Math.max(0, round1(preCrashSpeedKmh - postSpeedKmh)),
    windowFrames: window.length,
  };
}
