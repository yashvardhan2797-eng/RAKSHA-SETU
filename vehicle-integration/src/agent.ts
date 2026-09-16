// ============================================================================
// RAKSHA SETU — Vehicle Agent (the software installed in the car)
//
// The on-board component from the flowchart. Runs next to the ECU / OEM
// telematics unit and continuously:
//
//   ① POSSIBLE CRASH        — reads ECU/CAN + OEM T-Box + GNSS frames (10 Hz)
//   ② CRASH CONFIDENCE      — evidence-based confidence check (crash-confidence.ts)
//   ③ RAKSHA SETU APP ALERT — when confidence ≥ ALERT_CONFIDENCE, transmits the
//                             crash packet to the bridge → RAKSHA SETU cloud
//   ④ 30-SECOND TIMER       — local HMI countdown, driver can respond
//   ⑤ RESPONSE?             — YES → 5A I'M SAFE → cancel incident
//                             NO  → 5B SEND HELP → escalation flag transmitted
//
// Transmission is real HTTP POST to this repo's bridge (POST /api/vehicle/
// telemetry and /api/vehicle/accident), which forwards to the RAKSHA SETU
// api-server — the same cloud path the flowchart's step ⑧ describes.
//
// ⚠ PROTOTYPE: sensor frames are simulated (ecu.ts). Everything downstream of
// the frames — confidence, state machine, transmission — is the real agent
// logic. No real emergency service is contacted by this software.
// ============================================================================

import { CONFIG } from './config.ts';
import { EVIDENCE_WINDOW_FRAMES, buildEvidence, readEcuFrame, type EcuScenario, type ScenarioState } from './ecu.ts';
import { ALERT_CONFIDENCE, CONFIDENCE_MODEL_LABEL, evaluateCrashConfidence, type ConfidenceResult } from './crash-confidence.ts';
import { calculateRisk } from './risk.ts';
import type { DriverResponse, EcuEvidence, EcuFrame, TelemetryPacket, VehicleStatus } from './types.ts';

const ECU_SAMPLE_MS = 100; // 10 Hz sensor loop
const CANCEL_WINDOW_MS = 30_000; // flowchart step ④

export type AgentPhase =
  | 'IDLE'                 // normal driving, monitoring
  | 'REVIEW'               // confidence in the review band — watching closely
  | 'ALERT_SENT'           // ③ alert transmitted, 30-s window running
  | 'DRIVER_SAFE'          // 5A — driver confirmed safe, incident cancelled
  | 'ESCALATED';           // 5B — no response, send help

export type AgentSnapshot = {
  phase: AgentPhase;
  scenario: EcuScenario;
  latestFrame: EcuFrame | null;
  framesPerSecond: number;
  evidence: EcuEvidence | null;
  confidence: ConfidenceResult | null;
  activeEventId: string | null;
  windowEndsAt: string | null;
  windowSecondsLeft: number | null;
  lastTransmit: { endpoint: string; ok: boolean; at: string; detail: string } | null;
  totals: { framesRead: number; alertsSent: number; cancels: number; escalations: number };
  model: string;
};

type PacketOverrides = {
  eventType: TelemetryPacket['eventType'];
  signals: TelemetryPacket['signals'];
  driverResponse: DriverResponse;
  status: VehicleStatus;
  speedKmh: number;
  deceleration: number;
  risk: { suddenDeceleration: boolean; abnormalOrientation: boolean; unexpectedStop: boolean; driverNoResponse: boolean; manualSos: boolean };
};

export class VehicleAgent {
  private scenario: EcuScenario = 'NORMAL_DRIVING';
  private scenarioState: ScenarioState = { lastSpeedKmh: 62, phaseMs: 0 };
  private window: EcuFrame[] = [];
  private loopTimer: NodeJS.Timeout | null = null;
  private windowTimer: NodeJS.Timeout | null = null;
  private windowEndsAt: number | null = null;

  phase: AgentPhase = 'IDLE';
  confidence: ConfidenceResult | null = null;
  latestFrame: EcuFrame | null = null;
  activeEventId: string | null = null;
  lastTransmit: AgentSnapshot['lastTransmit'] = null;
  totals = { framesRead: 0, alertsSent: 0, cancels: 0, escalations: 0 };
  private framesSinceSecond = 0;
  private framesPerSecond = 10;

  /** Called by the bridge whenever a snapshot is served / streamed. */
  onChange: (() => void) | null = null;

  start(): void {
    if (this.loopTimer) return;
    this.loopTimer = setInterval(() => this.tick(), ECU_SAMPLE_MS);
  }

  stop(): void {
    if (this.loopTimer) clearInterval(this.loopTimer);
    if (this.windowTimer) clearInterval(this.windowTimer);
    this.loopTimer = null;
    this.windowTimer = null;
  }

  /** Demo control: point the sensor bus at a scenario. */
  setScenario(scenario: EcuScenario): void {
    this.scenario = scenario;
    this.scenarioState = { lastSpeedKmh: this.latestFrame?.speedKmh ?? 62, phaseMs: 0 };
  }

  /** ① — one iteration of the sensor loop. */
  private tick(): void {
    const frame = readEcuFrame(this.scenario, this.scenarioState, ECU_SAMPLE_MS);
    this.latestFrame = frame;
    this.totals.framesRead += 1;
    this.framesSinceSecond += 1;
    if (this.framesSinceSecond >= 1000 / ECU_SAMPLE_MS) {
      this.framesPerSecond = this.framesSinceSecond;
      this.framesSinceSecond = 0;
    }

    this.window.push(frame);
    if (this.window.length > EVIDENCE_WINDOW_FRAMES) this.window.shift();

    // ② — confidence check over the rolling evidence window. Manual SOS and the
    // alert flow bypass it (a driver-initiated SOS is always transmitted).
    const evidence = buildEvidence(this.window);
    this.confidence = evaluateCrashConfidence(evidence);

    if (this.confidence.alert && this.phase === 'IDLE') {
      void this.raiseAlert('ACCIDENT_DETECTED', this.confidence);
    } else if (this.confidence.level === 'REVIEW' && this.phase === 'IDLE') {
      this.phase = 'REVIEW';
    } else if (this.confidence.level === 'IDLE' && this.phase === 'REVIEW') {
      this.phase = 'IDLE'; // pattern dissolved — no false alert
    }
    this.onChange?.();
  }

  /** Driver pressed the physical SOS button (always transmitted, skips ②). */
  manualSos(): void {
    if (this.phase === 'ALERT_SENT' || this.phase === 'ESCALATED') return;
    void this.raiseAlert('MANUAL_SOS', null);
  }

  /** ③ — build the packet from ECU evidence and transmit to the bridge. */
  private async raiseAlert(eventType: 'ACCIDENT_DETECTED' | 'MANUAL_SOS', confidence: ConfidenceResult | null): Promise<void> {
    this.phase = 'ALERT_SENT';
    const evidence = buildEvidence(this.window);
    const frame = this.latestFrame;
    const deceleration = Math.max(0, -(frame?.accelLongitudinalG ?? 0)) * 9.81;

    const overrides: PacketOverrides = {
      eventType,
      signals: {
        crashSignal: confidence !== null || eventType === 'MANUAL_SOS',
        impactDetected: evidence.airbagDeploySignal || evidence.impactContact || dvFired(evidence),
        sos: eventType === 'MANUAL_SOS',
        abnormalOrientation: evidence.peakYawRateDegPerSec >= 30,
        unexpectedStop: evidence.preCrashSpeedKmh >= 15 && evidence.postSpeedKmh === 0,
      },
      driverResponse: 'PENDING',
      status: eventType === 'MANUAL_SOS' ? 'IMPACT_DETECTED' : 'STOPPED',
      speedKmh: frame?.speedKmh ?? 0,
      deceleration: Math.round(deceleration * 10) / 10,
      risk: {
        suddenDeceleration: evidence.peakDecelerationG >= 0.45 || dvFired(evidence),
        abnormalOrientation: evidence.peakYawRateDegPerSec >= 30,
        unexpectedStop: evidence.preCrashSpeedKmh >= 15 && evidence.postSpeedKmh === 0,
        driverNoResponse: false,
        manualSos: eventType === 'MANUAL_SOS',
      },
    };

    const packet: TelemetryPacket = {
      packetId: `AGT-${Date.now().toString(36).toUpperCase()}`,
      eventType: overrides.eventType,
      vehicleId: CONFIG.vehicle.id,
      timestamp: new Date().toISOString(),
      location: {
        latitude: frame?.gps.latitude ?? CONFIG.location.latitude,
        longitude: frame?.gps.longitude ?? CONFIG.location.longitude,
        simulated: true,
        label: 'VEHICLE AGENT GNSS FIX',
      },
      vehicle: {
        speedKmh: overrides.speedKmh,
        acceleration: 0,
        deceleration: overrides.deceleration,
        heading: 142,
        status: overrides.status,
        ignition: 'ON',
      },
      signals: overrides.signals,
      driver: { response: overrides.driverResponse },
      risk: (() => {
        const risk = calculateRisk(overrides.risk);
        return { score: risk.score, category: risk.category, factors: risk.factors.filter((f) => f.applied).map((f) => `${f.label} (+${f.weight})`), model: risk.model };
      })(),
      ecu: {
        confidence: confidence?.confidence ?? (eventType === 'MANUAL_SOS' ? ALERT_CONFIDENCE : 0),
        decision: confidence?.reason ?? 'Manual SOS — driver-initiated, confidence check bypassed',
        evidence,
        model: CONFIDENCE_MODEL_LABEL,
      },
    };

    // ③ — transmit. First reserve an event id, then post the accident event.
    try {
      const reserve = await fetchJson(`${CONFIG.bridgeSelfUrl}/api/vehicle/reserve-event-id`, { method: 'POST' }) as { eventId?: string };
      this.activeEventId = reserve.eventId ?? null;
      const result = await fetchJson(`${CONFIG.bridgeSelfUrl}/api/vehicle/accident`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'vehicle-agent', eventId: this.activeEventId, packet }),
      }) as { ok?: boolean; rakshaIncidentId?: number | null; contactNotifications?: unknown[]; rakshaSetuForward?: { ok: boolean; note: string } };
      this.lastTransmit = {
        endpoint: '/api/vehicle/accident',
        ok: Boolean(result.ok),
        at: new Date().toISOString(),
        detail: result.rakshaSetuForward?.note ?? 'accepted by bridge',
      };
      this.totals.alertsSent += 1;
    } catch (err) {
      this.lastTransmit = { endpoint: '/api/vehicle/accident', ok: false, at: new Date().toISOString(), detail: err instanceof Error ? err.message : 'transmit failed' };
    }

    // ④ — start the 30-second cancellation window with a live countdown.
    this.windowEndsAt = Date.now() + CANCEL_WINDOW_MS;
    if (this.windowTimer) clearInterval(this.windowTimer);
    this.windowTimer = setInterval(() => {
      if (this.windowEndsAt !== null && Date.now() >= this.windowEndsAt) {
        this.clearWindowTimer();
        if (this.phase === 'ALERT_SENT') void this.escalate();
      }
      this.onChange?.();
    }, 500);
    this.onChange?.();
  }

  /** 5A — driver pressed I'M SAFE inside the window. */
  async driverSafe(): Promise<void> {
    if (this.phase !== 'ALERT_SENT') return;
    this.clearWindowTimer();
    this.phase = 'DRIVER_SAFE';
    this.totals.cancels += 1;
    await this.transmitFollowUp('DRIVER_SAFE', 'OK', 'NORMAL');
    // Return to monitoring; a NEW crash raises a NEW alert.
    setTimeout(() => { if (this.phase === 'DRIVER_SAFE') { this.phase = 'IDLE'; this.activeEventId = null; this.onChange?.(); } }, 4000);
    this.onChange?.();
  }

  /** 5B — window expired with no response: SEND HELP. */
  private async escalate(): Promise<void> {
    this.phase = 'ESCALATED';
    this.totals.escalations += 1;
    await this.transmitFollowUp('DRIVER_NO_RESPONSE', 'NO_RESPONSE', 'STOPPED');
    setTimeout(() => { if (this.phase === 'ESCALATED') { this.phase = 'IDLE'; this.activeEventId = null; this.onChange?.(); } }, 8000);
    this.onChange?.();
  }

  /** Post-response follow-up telemetry so the cloud lifecycle stays in sync. */
  private async transmitFollowUp(eventType: 'DRIVER_SAFE' | 'DRIVER_NO_RESPONSE', driverResponse: DriverResponse, status: VehicleStatus): Promise<void> {
    const frame = this.latestFrame;
    const packet: TelemetryPacket = {
      packetId: `AGT-${Date.now().toString(36).toUpperCase()}`,
      eventType,
      vehicleId: CONFIG.vehicle.id,
      timestamp: new Date().toISOString(),
      location: {
        latitude: frame?.gps.latitude ?? CONFIG.location.latitude,
        longitude: frame?.gps.longitude ?? CONFIG.location.longitude,
        simulated: true,
        label: 'VEHICLE AGENT GNSS FIX',
      },
      vehicle: { speedKmh: frame?.speedKmh ?? 0, acceleration: 0, deceleration: 0, heading: 142, status, ignition: 'ON' },
      signals: { crashSignal: false, impactDetected: false, sos: false, abnormalOrientation: false, unexpectedStop: false },
      driver: { response: driverResponse },
      risk: { score: driverResponse === 'NO_RESPONSE' ? 90 : 0, category: driverResponse === 'NO_RESPONSE' ? 'CRITICAL' : 'LOW', factors: driverResponse === 'NO_RESPONSE' ? ['Driver No Response (+25)'] : [], model: CONFIDENCE_MODEL_LABEL },
      relatedEventId: this.activeEventId ?? undefined,
      ecu: {
        confidence: driverResponse === 'NO_RESPONSE' ? 100 : 0,
        decision: driverResponse === 'NO_RESPONSE' ? '30-second window expired without driver response — escalated' : 'Driver confirmed safe inside the 30-second window — incident cancelled',
        evidence: buildEvidence(this.window),
        model: CONFIDENCE_MODEL_LABEL,
      },
    };
    try {
      await fetchJson(`${CONFIG.bridgeSelfUrl}/api/vehicle/telemetry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packet }),
      });
      this.lastTransmit = { endpoint: '/api/vehicle/telemetry', ok: true, at: new Date().toISOString(), detail: `${eventType} follow-up transmitted` };
    } catch (err) {
      this.lastTransmit = { endpoint: '/api/vehicle/telemetry', ok: false, at: new Date().toISOString(), detail: err instanceof Error ? err.message : 'follow-up failed' };
    }
  }

  private clearWindowTimer(): void {
    if (this.windowTimer) clearInterval(this.windowTimer);
    this.windowTimer = null;
    this.windowEndsAt = null;
  }

  secondsLeft(): number | null {
    return this.windowEndsAt === null ? null : Math.max(0, Math.ceil((this.windowEndsAt - Date.now()) / 1000));
  }

  snapshot(): AgentSnapshot {
    return {
      phase: this.phase,
      scenario: this.scenario,
      latestFrame: this.latestFrame,
      framesPerSecond: this.framesPerSecond,
      evidence: this.window.length ? buildEvidence(this.window) : null,
      confidence: this.confidence,
      activeEventId: this.activeEventId,
      windowEndsAt: this.windowEndsAt ? new Date(this.windowEndsAt).toISOString() : null,
      windowSecondsLeft: this.secondsLeft(),
      lastTransmit: this.lastTransmit,
      totals: { ...this.totals },
      model: CONFIDENCE_MODEL_LABEL,
    };
  }
}

function dvFired(evidence: EcuEvidence): boolean {
  return evidence.deltaSpeedKmh >= 15;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return (await res.json().catch(() => null)) ?? { ok: res.ok };
  } finally {
    clearTimeout(timer);
  }
}

/** Singleton agent owned by the bridge server. */
export const vehicleAgent = new VehicleAgent();
