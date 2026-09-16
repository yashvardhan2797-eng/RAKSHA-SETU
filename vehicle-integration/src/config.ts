// ============================================================================
// RAKSHA SETU — Vehicle Integration Simulator (ISOLATED DEMO COMPONENT)
// ----------------------------------------------------------------------------
// This file is part of a SEPARATE, demonstration-only integration layer.
// It does NOT modify the existing RAKSHA SETU application in any way.
//
// ALL vehicle identity + location values below are DEMO/SIMULATED placeholders.
// Nothing here connects to a real ECU, CAN bus, OEM backend or emergency service.
// ============================================================================

// Load the OPTIONAL local .env (vehicle-integration/.env, gitignored).
// Used only for the optional AI narration key. Never committed to git.
import { fileURLToPath } from 'node:url';
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // no .env present — every feature except AI narration still works
}

export const CONFIG = {
  /** Port for the isolated vehicle-integration bridge server. */
  port: Number(process.env.VEHICLE_PORT || 8080),

  /** Base URL the Vehicle Agent uses to reach the bridge (same process). */
  bridgeSelfUrl: process.env.BRIDGE_SELF_URL || 'http://localhost:8080',

  /** Existing RAKSHA SETU frontend (Vite dev server). Probed read-only. Never modified. */
  rakshaAppUrl: process.env.RAKSHA_APP_URL || 'http://localhost:5173',

  /**
   * Existing express API server (artifacts/api-server), IF the operator starts it.
   * Probed read-only (GET /api/healthz). Accident events are best-effort forwarded
   * there for demonstration; the bridge records the HTTP result honestly.
   */
  rakshaApiUrl: process.env.RAKSHA_API_URL || 'http://localhost:3000',

  /** DEMO vehicle identity — clearly simulated, not real hardware. */
  vehicle: {
    id: 'RS-VHC-001',
    driver: 'Demo Driver',
    model: 'Demo Connected Vehicle',
    telematicsUnit: 'Simulated OEM / Telematics Gateway v0.1',
  },

  /** SIMULATED VEHICLE LOCATION — fixed demo coordinates (Jaipur corridor). */
  location: {
    latitude: 26.9124,
    longitude: 75.7873,
    label: 'SIMULATED VEHICLE LOCATION',
  },

  /** Telemetry cadence while driving normally. */
  normalTelemetryIntervalMs: 2000,

  /** Duration of each deterministic accident-timeline step. */
  accidentStepMs: 1000,

  /** Time without a driver response before the escalation step fires. */
  driverResponseTimeoutMs: 6000,

  /** Simulated emergency contacts — notification events are QUEUED ONLY. Never sent. */
  contacts: {
    primary: { name: 'Primary Emergency Contact', relation: 'Family', phone: '+91 90000 00001' },
    secondary: { name: 'Secondary Emergency Contact', relation: 'Colleague', phone: '+91 90000 00002' },
  },

  /**
   * OPTIONAL AI incident narration (Groq API, native fetch — zero dependencies).
   * The key is read from the local, gitignored vehicle-integration/.env file
   * (GROQ_API_KEY=...). If absent or unreachable, the demo continues without it.
   */
  ai: {
    enabled: true,
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  },

  maxStoredEvents: 200,
  maxLogEntries: 300,
  probeIntervalMs: 5000,
  probeTimeoutMs: 1500,
} as const;
