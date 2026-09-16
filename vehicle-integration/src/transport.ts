// ============================================================================
// RAKSHA SETU — Vehicle Integration Simulator (ISOLATED DEMO COMPONENT)
// Transport layer: in-memory event store, Server-Sent Events fan-out and
// read-only probing / best-effort forwarding towards the EXISTING RAKSHA SETU
// processes. Nothing in the existing application is modified by this file.
// ============================================================================

import { CONFIG } from './config.ts';
import type {
  AccidentEvent,
  ConnectionStatus,
  LogEntry,
  TelemetryPacket,
} from './types.ts';

// ---------------------------------------------------------------------------
// In-memory state (demo only — intentionally no database)
// ---------------------------------------------------------------------------
const events: AccidentEvent[] = [];
const logEntries: LogEntry[] = [];
let logCounter = 0;
let eventCounter = 0;
let latestTelemetry: TelemetryPacket | null = null;
let telemetryCount = 0;

export type SseClient = { id: number; res: import('node:http').ServerResponse };
const sseClients = new Map<number, import('node:http').ServerResponse>();

export function addSseClient(res: import('node:http').ServerResponse): number {
  const id = sseClients.size + 1 + Math.floor(Math.random() * 1000);
  sseClients.set(id, res);
  return id;
}

export function removeSseClient(id: number): void {
  sseClients.delete(id);
}

export function sseClientCount(): number {
  return sseClients.size;
}

export function broadcast(eventName: string, payload: unknown): void {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const [id, res] of sseClients) {
    try {
      res.write(frame);
    } catch {
      sseClients.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
export function addLog(level: LogEntry['level'], source: LogEntry['source'], message: string): LogEntry {
  logCounter += 1;
  const entry: LogEntry = { id: logCounter, time: new Date().toISOString(), level, source, message };
  logEntries.push(entry);
  if (logEntries.length > CONFIG.maxLogEntries) logEntries.shift();
  broadcast('log', entry);
  console.log(`[${entry.time}] (${source}/${level}) ${message}`);
  return entry;
}

// ---------------------------------------------------------------------------
// Event + telemetry store
// ---------------------------------------------------------------------------
export function reserveEventId(): string {
  eventCounter += 1;
  return `EVT-${String(eventCounter).padStart(4, '0')}`;
}

export function eventCount(): number {
  return eventCounter;
}

export function recordTelemetry(packet: TelemetryPacket): void {
  latestTelemetry = packet;
  telemetryCount += 1;
  broadcast('telemetry', packet);
  addLog(
    'info',
    'bridge',
    `TELEMETRY RECEIVED · packet ${packet.packetId} · ${packet.eventType} · ${packet.vehicleId}`,
  );

  // Update the lifecycle of a related accident event (driver response / escalation).
  if (packet.relatedEventId) {
    const event = events.find((e) => e.eventId === packet.relatedEventId);
    if (event) {
      if (packet.eventType === 'DRIVER_NO_RESPONSE') {
        event.lifecycle = 'ESCALATED';
        event.riskScore = Math.max(event.riskScore, packet.risk.score);
        event.riskCategory = packet.risk.category;
        addLog('critical', 'bridge', `EVENT ${event.eventId} ESCALATED (driver no response) — handed to RAKSHA SETU workflow`);
      } else if (packet.eventType === 'DRIVER_SAFE') {
        event.lifecycle = 'DRIVER_SAFE_CANCELLED';
        addLog('success', 'bridge', `EVENT ${event.eventId} — driver marked SAFE, escalation cancelled`);
        // Flowchart 5A: propagate the cancellation into the RAKSHA SETU cloud
        // (best-effort — the cloud marks the incident as a false alarm).
        if (event.rakshaIncidentId) {
          void fetch(`${CONFIG.rakshaApiUrl}/api/vehicle/incidents/${event.rakshaIncidentId}/cancel`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ reason: 'driver-safe-30s-window', eventId: event.eventId }),
          }).then((res) => addLog(res.ok ? 'success' : 'warn', 'bridge', `Cloud cancel for incident #${event.rakshaIncidentId} → HTTP ${res.status}`))
            .catch(() => addLog('warn', 'bridge', `Cloud cancel for incident #${event.rakshaIncidentId} unreachable (api-server offline) — local state still cancelled`));
        }
      }
      broadcast('event', event);
    }
  }
}

export function recordEvent(
  event: AccidentEvent,
  options: { acknowledged?: boolean } = {},
): void {
  if (options.acknowledged) event.lifecycle = 'RAKSHA_SETU_ACKNOWLEDGED';
  events.push(event);
  if (events.length > CONFIG.maxStoredEvents) events.shift();
  broadcast('accident', event);
  addLog(
    options.acknowledged ? 'critical' : 'warn',
    'bridge',
    `EVENT ${event.eventId} STORED · ${event.eventType} · risk ${event.riskScore} (${event.riskCategory})`,
  );
}

export function getEvents(): AccidentEvent[] {
  return [...events].reverse();
}

export function getEvent(eventId: string): AccidentEvent | undefined {
  return events.find((e) => e.eventId === eventId);
}

export function getLatestTelemetry(): TelemetryPacket | null {
  return latestTelemetry;
}

export function getLog(): LogEntry[] {
  return [...logEntries].reverse();
}

export function getTelemetryCount(): number {
  return telemetryCount;
}

export function resetState(): void {
  events.length = 0;
  logEntries.length = 0;
  logCounter = 0;
  eventCounter = 0;
  latestTelemetry = null;
  telemetryCount = 0;
  addLog('info', 'bridge', 'DEMO RESET — event store cleared, bridge ready');
  broadcast('reset', { at: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Read-only probing of the EXISTING RAKSHA SETU processes (never modified)
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type ProbeResult = {
  app: 'CONNECTED' | 'WAITING';
  api: 'CONNECTED' | 'WAITING';
  sseClients: number;
  checkedAt: string;
};

export async function probeRakshaSetu(): Promise<ProbeResult> {
  const results = await Promise.allSettled([
    fetchWithTimeout(`${CONFIG.rakshaAppUrl}/`, CONFIG.probeTimeoutMs),
    fetchWithTimeout(`${CONFIG.rakshaApiUrl}/api/healthz`, CONFIG.probeTimeoutMs),
  ]);
  const app = results[0].status === 'fulfilled' && results[0].value.ok ? 'CONNECTED' : 'WAITING';
  const api = results[1].status === 'fulfilled' && results[1].value.ok ? 'CONNECTED' : 'WAITING';
  return { app, api, sseClients: sseClients.size, checkedAt: new Date().toISOString() };
}

/**
 * Best-effort forward of the event towards the EXISTING api-server.
 * The existing server currently exposes only GET /api/healthz, so this POST is
 * expected to be refused (404) — the bridge records the result HONESTLY and
 * never retries destructively. This documents where the production ingest
 * endpoint would live without touching protected files.
 */
export async function forwardToRakshaSetuApi(event: AccidentEvent): Promise<NonNullable<AccidentEvent['rakshaSetuForward']>> {
  const endpoint = `${CONFIG.rakshaApiUrl}/api/vehicle/accident`;
  try {
    const res = await fetchWithTimeout(endpoint, CONFIG.probeTimeoutMs, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'vehicle-integration-bridge', eventId: event.eventId, event, packet: event.packet }),
    });
    // The ingest route answers with the per-contact dispatch log (step 7A):
    // [{ contactName, contactPhone, channel, status, ... }]
    const data = (await res.json().catch(() => null)) as { notifications?: unknown; persisted?: boolean; incidentId?: number } | null;
    const notifications = Array.isArray(data?.notifications) ? data!.notifications : [];
    event.rakshaIncidentId = data?.incidentId;
    event.persistedToDatabase = Boolean(data?.persisted);
    event.contactNotifications = notifications as AccidentEvent['contactNotifications'];
    return {
      attempted: true,
      endpoint,
      httpStatus: res.status,
      ok: res.ok,
      note: res.ok
        ? `Accepted by RAKSHA SETU api-server${data?.persisted ? ' (persisted to database)' : ' (in-memory mode)'}.`
        : 'Existing api-server reachable but rejected the event. Recorded by the bridge.',
    };
  } catch {
    return {
      attempted: true,
      endpoint,
      httpStatus: null,
      ok: false,
      note: 'Existing api-server not running (optional component). Event recorded by the bridge only.',
    };
  }
}

export function connectionStatus(probe: ProbeResult): ConnectionStatus {
  return {
    bridge: 'CONNECTED',
    rakshaSetuApp: probe.app,
    rakshaSetuApi: probe.api,
    checkedAt: probe.checkedAt,
    appUrl: CONFIG.rakshaAppUrl,
    apiUrl: CONFIG.rakshaApiUrl,
    sseClients: probe.sseClients,
  };
}

