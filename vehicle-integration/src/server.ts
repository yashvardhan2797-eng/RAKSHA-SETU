// ============================================================================
// RAKSHA SETU — Vehicle Integration Simulator (ISOLATED DEMO COMPONENT)
// Local HTTP bridge server. Zero runtime dependencies (Node 24 native TS).
//
//   GET  /                             Vehicle Integration Simulator dashboard
//   GET  /receiver                     RAKSHA SETU Integration Receiver dashboard
//   GET  /api/vehicle/health           Connection snapshot (probes existing app)
//   GET  /api/vehicle/status           Full bridge snapshot (events, log, state)
//   GET  /api/vehicle/events           All recorded integration events
//   GET  /api/vehicle/simulation-spec  Deterministic demo specification
//   GET  /api/vehicle/stream           SSE stream for the receiver dashboard
//   POST /api/vehicle/telemetry        Receive a telemetry packet (simulator → bridge)
//   POST /api/vehicle/accident         Receive an accident/SOS event  (simulator → bridge)
//   POST /api/vehicle/reserve-event-id Reserve the next deterministic Event ID
//   POST /api/vehicle/reset            RESET DEMO
// ============================================================================

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from './config.ts';
import { aiConfigured, summarizeIncident } from './ai.ts';
import { buildSimulationSpec } from './simulator.ts';
import { ECU_CHANNELS, EVIDENCE_WINDOW_FRAMES, type EcuScenario } from './ecu.ts';
import { vehicleAgent } from './agent.ts';
import { addLog, addSseClient, broadcast, connectionStatus, eventCount, forwardToRakshaSetuApi, getEvents, getLatestTelemetry, getLog, getTelemetryCount, probeRakshaSetu, recordEvent, recordTelemetry, removeSseClient, reserveEventId, resetState, sseClientCount } from './transport.ts';
import type { AccidentEvent, TelemetryPacket } from './types.ts';

// Vehicle Agent → bridge SSE: any agent state change is pushed to receivers.
vehicleAgent.onChange = () => broadcast('agent', vehicleAgent.snapshot());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

function send(res: http.ServerResponse, status: number, body: string, contentType = 'application/json; charset=utf-8'): void {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
  res.end(body);
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  send(res, status, JSON.stringify(payload));
}

// Client-caused request errors (bad JSON body, oversized payload) — answered
// with the proper 4xx status instead of the generic 500 bridge-error path.
// Plain functions (not classes with parameter properties) because this file must
// stay compatible with Node 24 native type-stripping.
function clientError(status: number, message: string): Error {
  const err = new Error(message);
  (err as Error & { httpStatus?: number }).httpStatus = status;
  return err;
}

function httpStatusOf(err: unknown): number | null {
  const status = (err as { httpStatus?: unknown } | null)?.httpStatus;
  return typeof status === 'number' ? status : null;
}

async function readJsonBody(req: http.IncomingMessage, limitBytes = 512 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limitBytes) throw clientError(413, 'Payload too large');
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw clientError(400, 'Request body is not valid JSON');
  }
}

function isTelemetryPacket(value: unknown): value is TelemetryPacket {
  const p = value as TelemetryPacket | undefined;
  return Boolean(p && typeof p.packetId === 'string' && typeof p.eventType === 'string' && typeof p.vehicleId === 'string' && p.risk && p.signals && p.vehicle);
}

async function serveStatic(res: http.ServerResponse, fileName: string): Promise<void> {
  const filePath = path.join(PUBLIC_DIR, fileName);
  try {
    const content = await readFile(filePath);
    send(res, 200, content.toString('utf8'), MIME[path.extname(filePath)] ?? 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }
}

// ---------------------------------------------------------------------------
// GET routing
// ---------------------------------------------------------------------------
async function handleGet(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  switch (url.pathname) {
    case '/':
    case '/index.html':
      await serveStatic(res, 'index.html');
      return true;

    case '/receiver':
      await serveStatic(res, 'receiver.html');
      return true;

    case '/app.apk':
    case '/user-app.apk': {
      // Binary download — must not go through serveStatic (it string-decodes).
      // /app.apk = the USER app (login, personal info, SOS, 30s cancel window).
      try {
        const apk = await readFile(path.join(PUBLIC_DIR, 'raksha-setu-user-app.apk'));
        res.writeHead(200, {
          'content-type': 'application/vnd.android.package-archive',
          'content-length': String(apk.length),
          'content-disposition': 'attachment; filename="raksha-setu-user-app.apk"',
          'cache-control': 'no-store',
        });
        res.end(apk);
        addLog('info', 'bridge', `User app APK downloaded (${apk.length} bytes)`);
      } catch {
        send(res, 404, 'APK not found on this machine — see APK-INSTALL.md', 'text/plain; charset=utf-8');
      }
      return true;
    }

    case '/dashboard.apk': {
      // The control-room operator dashboard APK.
      try {
        const apk = await readFile(path.join(PUBLIC_DIR, 'raksha-setu-dashboard.apk'));
        res.writeHead(200, {
          'content-type': 'application/vnd.android.package-archive',
          'content-length': String(apk.length),
          'content-disposition': 'attachment; filename="raksha-setu-dashboard.apk"',
          'cache-control': 'no-store',
        });
        res.end(apk);
        addLog('info', 'bridge', `Dashboard APK downloaded (${apk.length} bytes)`);
      } catch {
        send(res, 404, 'APK not found on this machine — see APK-INSTALL.md', 'text/plain; charset=utf-8');
      }
      return true;
    }

    case '/api/vehicle/simulation-spec':
      sendJson(res, 200, buildSimulationSpec());
      return true;

    // ------------------------------------------------------------------
    // Vehicle Agent (in-vehicle software) — live snapshot
    // ------------------------------------------------------------------
    case '/api/vehicle/agent':
      sendJson(res, 200, {
        agent: vehicleAgent.snapshot(),
        channels: ECU_CHANNELS,
        evidenceWindowFrames: EVIDENCE_WINDOW_FRAMES,
        alertConfidence: 75,
        reviewConfidence: 40,
      });
      return true;;

    case '/api/vehicle/health': {
      const probe = await probeRakshaSetu();
      sendJson(res, 200, connectionStatus(probe));
      return true;
    }

    case '/api/vehicle/status': {
      const probe = await probeRakshaSetu();
      sendJson(res, 200, {
        status: connectionStatus(probe),
        latestTelemetry: getLatestTelemetry(),
        telemetryCount: getTelemetryCount(),
        eventCount: eventCount(),
        events: getEvents(),
        log: getLog(),
      });
      return true;
    }

    case '/api/vehicle/events':
      sendJson(res, 200, { count: getEvents().length, events: getEvents() });
      return true;

    case '/api/vehicle/ai-status':
      sendJson(res, 200, { configured: aiConfigured(), model: CONFIG.ai.model, enabled: CONFIG.ai.enabled });
      return true;

    case '/api/vehicle/stream': {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store, no-transform',
        connection: 'keep-alive',
        'access-control-allow-origin': '*',
      });
      res.write(`event: hello\ndata: ${JSON.stringify({ at: new Date().toISOString(), clients: sseClientCount() })}\n\n`);
      const clientId = addSseClient(res);
      addLog('info', 'receiver', `Receiver dashboard subscribed (SSE client #${clientId}, ${sseClientCount()} watching)`);
      const keepAlive = setInterval(() => {
        try {
          res.write(`: keep-alive ${Date.now()}\n\n`);
        } catch {
          clearInterval(keepAlive);
        }
      }, 15000);
      req.on('close', () => {
        clearInterval(keepAlive);
        removeSseClient(clientId);
        addLog('info', 'receiver', `Receiver dashboard disconnected (SSE client #${clientId})`);
      });
      return true;
    }

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// POST routing (the actual data transfer: simulator → bridge)
// ---------------------------------------------------------------------------
async function handlePost(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  switch (url.pathname) {
    case '/api/vehicle/reserve-event-id': {
      const eventId = reserveEventId();
      sendJson(res, 200, { eventId });
      return true;
    }

    // ------------------------------------------------------------------
    // Vehicle Agent commands (in-vehicle software, demo controls)
    // ------------------------------------------------------------------
    case '/api/vehicle/agent/scenario': {
      const body = await readJsonBody(req);
      const scenario = body.scenario;
      const valid: EcuScenario[] = ['NORMAL_DRIVING', 'HARD_BRAKING', 'CRASH_IMPACT', 'POTHOLE_SHAKE', 'POST_CRASH_STOPPED'];
      if (typeof scenario !== 'string' || !valid.includes(scenario as EcuScenario)) {
        sendJson(res, 400, { ok: false, error: `scenario must be one of ${valid.join(', ')}` });
        return true;
      }
      vehicleAgent.setScenario(scenario as EcuScenario);
      addLog('info', 'bridge', `ECU scenario → ${scenario} (sensor bus feeds the Vehicle Agent at 10 Hz)`);
      sendJson(res, 200, { ok: true, scenario, agent: vehicleAgent.snapshot() });
      return true;
    }

    case '/api/vehicle/agent/sos': {
      if (vehicleAgent.phase === 'ALERT_SENT' || vehicleAgent.phase === 'ESCALATED') {
        sendJson(res, 409, { ok: false, error: 'Alert already active' });
        return true;
      }
      addLog('critical', 'bridge', 'MANUAL SOS pressed in the vehicle — agent bypasses confidence check and transmits');
      await vehicleAgent.manualSos();
      sendJson(res, 200, { ok: true, agent: vehicleAgent.snapshot() });
      return true;
    }

    case '/api/vehicle/agent/driver-safe': {
      if (vehicleAgent.phase !== 'ALERT_SENT') {
        sendJson(res, 409, { ok: false, error: 'No active cancellation window' });
        return true;
      }
      await vehicleAgent.driverSafe();
      addLog('success', 'bridge', `Driver responded I'M SAFE within the window — ${vehicleAgent.activeEventId ?? 'event'} cancelled`);
      sendJson(res, 200, { ok: true, agent: vehicleAgent.snapshot() });
      return true;
    }

    case '/api/vehicle/telemetry': {
      const started = Date.now();
      const body = await readJsonBody(req);
      if (!isTelemetryPacket(body.packet)) {
        sendJson(res, 400, { ok: false, error: 'Invalid telemetry packet' });
        return true;
      }
      const packet = body.packet;
      recordTelemetry(packet);
      sendJson(res, 200, {
        ok: true,
        receivedAt: new Date().toISOString(),
        bridge: 'vehicle-integration-bridge',
        latencyMs: Date.now() - started,
        packetId: packet.packetId,
      });
      return true;
    }

    case '/api/vehicle/accident': {
      const started = Date.now();
      const body = await readJsonBody(req);
      if (!isTelemetryPacket(body.packet)) {
        sendJson(res, 400, { ok: false, error: 'Invalid telemetry packet' });
        return true;
      }
      const packet = body.packet;
      const eventId = typeof body.eventId === 'string' && body.eventId.startsWith('EVT-') ? body.eventId : reserveEventId();
      const eventType = packet.eventType === 'MANUAL_SOS' ? 'MANUAL_SOS' : packet.eventType === 'TEST_TELEMETRY' ? 'TEST_TELEMETRY' : 'ACCIDENT_DETECTED';

      const event: AccidentEvent = {
        eventId,
        eventType,
        vehicleId: packet.vehicleId,
        createdAt: new Date().toISOString(),
        lifecycle: 'INCIDENT_GENERATED',
        riskScore: packet.risk.score,
        riskCategory: packet.risk.category,
        packet,
        ack: {
          bridge: 'vehicle-integration-bridge',
          receivedAt: new Date().toISOString(),
          httpStatus: 200,
          latencyMs: Date.now() - started,
        },
        rakshaSetuForward: null,
      };

      addLog('critical', 'bridge', `INBOUND EVENT ${eventId} · ${eventType} · POST /api/vehicle/accident · ${packet.risk.score}/100 (${packet.risk.category})`);

      // Best-effort, honest forwarding attempt towards the EXISTING api-server.
      event.rakshaSetuForward = await forwardToRakshaSetuApi(event);
      const forwardResult = event.rakshaSetuForward;
      addLog(forwardResult.ok ? 'success' : 'warn', 'bridge', `FORWARD ${eventId} → ${forwardResult.endpoint} → ${forwardResult.httpStatus ?? 'unreachable'} · ${forwardResult.note}`);

      recordEvent(event, { acknowledged: true });

      // Optional AI narration — best-effort, never blocks or breaks the demo.
      if (aiConfigured()) {
        summarizeIncident(event)
          .then((ai) => {
            if (ai) {
              event.aiSummary = ai;
              broadcast('event', event);
              addLog('success', 'bridge', `AI incident summary attached to ${eventId} (model ${ai.model})`);
            }
          })
          .catch(() => { /* AI is optional — demo continues */ });
      }

      sendJson(res, 200, {
        ok: true,
        eventId,
        receivedAt: event.ack.receivedAt,
        bridge: 'vehicle-integration-bridge',
        latencyMs: event.ack.latencyMs,
        lifecycle: event.lifecycle,
        rakshaSetuForward: event.rakshaSetuForward,
        // Echoed so the sender (e.g. the user app) can cancel within the 30s window.
        rakshaIncidentId: event.rakshaIncidentId ?? null,
        persistedToDatabase: event.persistedToDatabase ?? false,
        contactNotifications: event.contactNotifications ?? [],
      });
      return true;
    }

    case '/api/vehicle/reset': {
      resetState();
      sendJson(res, 200, { ok: true, resetAt: new Date().toISOString() });
      return true;
    }

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${CONFIG.port}`);
  try {
    const handled = req.method === 'GET' || req.method === 'HEAD'
      ? await handleGet(req, res, url)
      : req.method === 'POST'
        ? await handlePost(req, res, url)
        : false;
    if (!handled) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        });
        res.end();
        return;
      }
      sendJson(res, 404, { ok: false, error: `No route: ${req.method} ${url.pathname}` });
    }
  } catch (err) {
    // The simulator must never crash the demo — log and answer cleanly.
    const clientStatus = httpStatusOf(err);
    if (clientStatus !== null) {
      addLog('warn', 'bridge', `Bad request on ${req.method} ${url.pathname}: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) sendJson(res, clientStatus, { ok: false, error: err instanceof Error ? err.message : String(err) });
      else res.end();
      return;
    }
    addLog('warn', 'bridge', `Request error on ${req.method} ${url.pathname}: ${err instanceof Error ? err.message : String(err)}`);
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Bridge internal error (demo continued)' });
    else res.end();
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Vehicle integration bridge could not start: port ${CONFIG.port} is already in use.`);
    console.error('Stop the existing bridge or set VEHICLE_PORT to another port.');
  } else {
    console.error('Vehicle integration bridge failed to start:', err);
  }
  process.exitCode = 1;
});

server.listen(CONFIG.port, () => {
  const spec = buildSimulationSpec();
  vehicleAgent.start(); // the in-vehicle software begins reading the sensor bus
  console.log('============================================================');
  console.log(' RAKSHA SETU — VEHICLE INTEGRATION SIMULATOR (ISOLATED DEMO)');
  console.log('============================================================');
  console.log(` Vehicle dashboard : http://localhost:${CONFIG.port}/`);
  console.log(` Integration receiver: http://localhost:${CONFIG.port}/receiver`);
  console.log(` Existing RAKSHA SETU app (read-only probe): ${CONFIG.rakshaAppUrl}`);
  console.log(` Existing api-server (optional, read-only probe): ${CONFIG.rakshaApiUrl}`);
  console.log(` Simulated vehicle : ${spec.vehicle.id} · ${spec.vehicle.driver}`);
  console.log(` Simulated location: ${spec.location.latitude}, ${spec.location.longitude} (${spec.location.label})`);
  console.log(' Vehicle Agent     : RUNNING — 10 Hz ECU/OEM sensor loop + crash confidence check');
  console.log(' NOTE: Sensor frames are SIMULATED (no real ECU/CAN/OEM access in this demo).');
  console.log('============================================================');
});

// Periodic probe so the dashboards always show honest connection state.
setInterval(async () => {
  const probe = await probeRakshaSetu();
  broadcast('probe', connectionStatus(probe));
}, CONFIG.probeIntervalMs).unref();

