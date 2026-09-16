// ============================================================================
// RAKSHA SETU — Vehicle Integration Simulator (ISOLATED DEMO COMPONENT)
// Telemetry packet factory. Every packet is clearly marked as SIMULATED.
// ============================================================================

import { CONFIG } from './config.ts';
import { calculateRisk, RISK_MODEL_LABEL, type RiskInput } from './risk.ts';
import type { SignalFlags, TelemetryEventType, TelemetryPacket, VehicleStatus } from './types.ts';

export const NO_SIGNALS: SignalFlags = {
  crashSignal: false,
  impactDetected: false,
  sos: false,
  abnormalOrientation: false,
  unexpectedStop: false,
};

/** Normal-driving baseline used by the dashboard when the demo resets. */
export const NORMAL_BASELINE = {
  speedKmh: 62,
  acceleration: 0.4,
  deceleration: 0.1,
  heading: 142,
} as const;

let packetCounter = 0;

export function nextPacketId(): string {
  packetCounter += 1;
  return `PKT-${String(packetCounter).padStart(4, '0')}`;
}

export type PacketOverrides = {
  eventType: TelemetryEventType;
  speedKmh?: number;
  acceleration?: number;
  deceleration?: number;
  heading?: number;
  status?: VehicleStatus;
  ignition?: 'ON' | 'OFF';
  signals?: Partial<SignalFlags>;
  driverResponse?: 'OK' | 'PENDING' | 'NO_RESPONSE';
  risk?: Partial<RiskInput>;
  relatedEventId?: string;
};

export function buildPacket(overrides: PacketOverrides): TelemetryPacket {
  const riskInput: RiskInput = {
    suddenDeceleration: overrides.risk?.suddenDeceleration ?? false,
    abnormalOrientation: overrides.risk?.abnormalOrientation ?? false,
    unexpectedStop: overrides.risk?.unexpectedStop ?? false,
    driverNoResponse: overrides.risk?.driverNoResponse ?? false,
    manualSos: overrides.risk?.manualSos ?? false,
  };
  const risk = calculateRisk(riskInput);

  return {
    packetId: nextPacketId(),
    eventType: overrides.eventType,
    vehicleId: CONFIG.vehicle.id,
    timestamp: new Date().toISOString(),
    location: {
      latitude: CONFIG.location.latitude,
      longitude: CONFIG.location.longitude,
      simulated: true,
      label: CONFIG.location.label,
    },
    vehicle: {
      speedKmh: overrides.speedKmh ?? NORMAL_BASELINE.speedKmh,
      acceleration: overrides.acceleration ?? NORMAL_BASELINE.acceleration,
      deceleration: overrides.deceleration ?? NORMAL_BASELINE.deceleration,
      heading: overrides.heading ?? NORMAL_BASELINE.heading,
      status: overrides.status ?? 'NORMAL',
      ignition: overrides.ignition ?? 'ON',
    },
    signals: { ...NO_SIGNALS, ...(overrides.signals ?? {}) },
    driver: { response: overrides.driverResponse ?? 'OK' },
    risk: {
      score: risk.score,
      category: risk.category,
      factors: risk.factors.filter((f) => f.applied).map((f) => `${f.label} (+${f.weight})`),
      model: RISK_MODEL_LABEL,
    },
    ...(overrides.relatedEventId ? { relatedEventId: overrides.relatedEventId } : {}),
  };
}
