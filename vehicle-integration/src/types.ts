// ============================================================================
// RAKSHA SETU — Vehicle Integration Simulator (ISOLATED DEMO COMPONENT)
// Shared types for the vehicle-side simulation, bridge and receiver dashboards.
// NOTE: Node 24 native type-stripping is used at runtime — keep this file
// type-only (no enums / no runtime code) and import it with `import type`.
// ============================================================================

export type SeverityCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type VehicleStatus =
  | 'NORMAL'
  | 'SUDDEN_DECELERATION'
  | 'ABNORMAL_ORIENTATION'
  | 'IMPACT_DETECTED'
  | 'STOPPED'
  | 'IGNITION_OFF';

export type DriverResponse = 'OK' | 'PENDING' | 'NO_RESPONSE';

export type SignalFlags = {
  crashSignal: boolean;
  impactDetected: boolean;
  sos: boolean;
  abnormalOrientation: boolean;
  unexpectedStop: boolean;
};

// ----------------------------------------------------------------------------
// ECU / OEM TELEMATICS UNIT LAYER (flowchart step ① sensor acquisition)
// ----------------------------------------------------------------------------
// The Vehicle Agent reads sensor frames from the car's ECU/CAN bus and from the
// OEM telematics unit (T-Box). In this prototype both arrive through a
// SIMULATED source so the demo runs without any real vehicle hardware; in a
// production build the same EcuFrame interface would be fed by CAN (ISO 15765)
// or the OEM cloud/telematics API. Every value stays traceable to its source.

/** Where a sensor frame originated. */
export type EcuSource = 'CAN' | 'OEM-TBOX' | 'GNSS';

/** One multi-sensor frame captured by the Vehicle Agent (10 Hz in the demo). */
export type EcuFrame = {
  /** monotonic agent timestamp (ISO string) */
  t: string;
  source: EcuSource;
  /** speedometer / wheel-speed sensors (km/h) */
  speedKmh: number;
  /** longitudinal acceleration from the IMU (g, + = accelerating) */
  accelLongitudinalG: number;
  /** lateral acceleration from the IMU (g) */
  accelLateralG: number;
  /** vertical acceleration from the IMU (g) */
  accelVerticalG: number;
  /** yaw rate from the gyro (°/s) — sudden heading change / rollover hint */
  yawRateDegPerSec: number;
  /** OEM airbag control module flag (crash signal) */
  airbagDeploySignal: boolean;
  /** belt pretensioner fired (strong secondary crash indicator) */
  seatbeltPretensionFired: boolean;
  /** door/hood contact evidence (deformation hint) */
  impactContact: boolean;
  /** GNSS fix + speed cross-check */
  gps: { latitude: number; longitude: number; fix: boolean; speedKmh: number };
  /** true when this frame came from the simulated source (never claim real data) */
  simulated: boolean;
};

/** Rolling window of ECU evidence the crash-confidence check evaluates. */
export type EcuEvidence = {
  /** peak absolute longitudinal deceleration inside the window (g) */
  peakDecelerationG: number;
  /** peak |lateral| acceleration (g) */
  peakLateralG: number;
  /** peak |yaw rate| (°/s) */
  peakYawRateDegPerSec: number;
  /** peak |vertical| acceleration (g) — pothole/shake guard */
  peakVerticalG: number;
  /** any-frame flags observed inside the window */
  airbagDeploySignal: boolean;
  seatbeltPretensionFired: boolean;
  impactContact: boolean;
  /** pre-crash speed (max speed in the window, km/h) — 0 when driving from rest */
  preCrashSpeedKmh: number;
  /** post-crash speed (latest speed, km/h) */
  postSpeedKmh: number;
  /** ΔV estimate across the window (km/h) — from wheel-speed delta */
  deltaSpeedKmh: number;
  /** number of frames in the rolling window */
  windowFrames: number;
};

export type TelemetryEventType =
  | 'NORMAL_TELEMETRY'
  | 'TEST_TELEMETRY'
  | 'SUDDEN_DECELERATION'
  | 'ABNORMAL_ORIENTATION'
  | 'IMPACT_DETECTED'
  | 'VEHICLE_STOPPED'
  | 'ACCIDENT_DETECTED'
  | 'MANUAL_SOS'
  | 'DRIVER_SAFE'
  | 'DRIVER_NO_RESPONSE';

export type TelemetryPacket = {
  packetId: string;
  eventType: TelemetryEventType;
  vehicleId: string;
  timestamp: string;
  location: { latitude: number; longitude: number; simulated: true; label: string };
  vehicle: {
    speedKmh: number;
    acceleration: number;
    deceleration: number;
    heading: number;
    status: VehicleStatus;
    ignition: 'ON' | 'OFF';
  };
  signals: SignalFlags;
  driver: { response: DriverResponse };
  risk: { score: number; category: SeverityCategory; factors: string[]; model: string };
  /** Raw ECU/OEM sensor evidence snapshot attached by the Vehicle Agent (optional for legacy packets). */
  ecu?: { confidence: number; decision: string; evidence: EcuEvidence; model: string };
  relatedEventId?: string;
};

export type LifecycleStage =
  | 'NORMAL'
  | 'ABNORMAL_TELEMETRY'
  | 'POSSIBLE_INCIDENT'
  | 'IMPACT_DETECTED'
  | 'INCIDENT_GENERATED'
  | 'TELEMETRY_TRANSMITTED'
  | 'RAKSHA_SETU_ACKNOWLEDGED'
  | 'DRIVER_VERIFICATION_PENDING'
  | 'ESCALATED'
  | 'DRIVER_SAFE_CANCELLED';

export type AccidentEventType = 'ACCIDENT_DETECTED' | 'MANUAL_SOS' | 'TEST_TELEMETRY';

export type AccidentEvent = {
  eventId: string;
  eventType: AccidentEventType;
  vehicleId: string;
  createdAt: string;
  lifecycle: LifecycleStage;
  riskScore: number;
  riskCategory: SeverityCategory;
  packet: TelemetryPacket;
  ack: {
    bridge: 'vehicle-integration-bridge';
    receivedAt: string;
    httpStatus: number;
    latencyMs: number;
  };
  rakshaSetuForward: {
    attempted: boolean;
    endpoint: string;
    httpStatus: number | null;
    ok: boolean;
    note: string;
  } | null;
  /** Database id assigned by the RAKSHA SETU api-server (when forwarded). */
  rakshaIncidentId?: number;
  /** True when the api-server persisted the incident to Postgres. */
  persistedToDatabase?: boolean;
  /** Per-contact dispatch log (flow step 7A): name/phone/channel/status. */
  contactNotifications?: Array<{
    contactName: string;
    contactPhone: string;
    channel: 'sms' | 'queued';
    status: 'sent' | 'failed' | 'simulated';
    providerMessageId?: string | null;
    errorMessage?: string | null;
  }>;
  /** Optional AI narration (Groq) — attached asynchronously after acknowledgement. */
  aiSummary?: { model: string; summary: string; generatedAt: string } | null;
};

export type LogEntry = {
  id: number;
  time: string;
  level: 'info' | 'warn' | 'success' | 'critical';
  source: 'vehicle' | 'bridge' | 'receiver';
  message: string;
};

export type ConnectionStatus = {
  bridge: 'CONNECTED' | 'DISCONNECTED';
  rakshaSetuApp: 'CONNECTED' | 'WAITING';
  rakshaSetuApi: 'CONNECTED' | 'WAITING';
  checkedAt: string;
  appUrl: string;
  apiUrl: string;
  sseClients: number;
};

export type SimulationSpec = {
  vehicle: { id: string; driver: string; model: string; telematicsUnit: string };
  location: { latitude: number; longitude: number; label: string };
  contacts: Record<string, { name: string; relation: string; phone: string }>;
  normalTelemetryIntervalMs: number;
  accidentStepMs: number;
  driverResponseTimeoutMs: number;
  baseline: {
    speedKmh: number;
    acceleration: number;
    deceleration: number;
    heading: number;
  };
  accidentSequence: Array<{
    atMs: number;
    eventType: TelemetryEventType;
    log: string;
    transmit: boolean;
    createsEvent: boolean;
    speedKmh: number;
    acceleration: number;
    deceleration: number;
    heading: number;
    status: VehicleStatus;
    signals: SignalFlags;
    driverResponse: DriverResponse;
    risk: { suddenDeceleration: boolean; abnormalOrientation: boolean; unexpectedStop: boolean; driverNoResponse: boolean; manualSos: boolean };
  }>;
  riskRules: Array<{ id: string; label: string; weight: number }>;
  riskModelLabel: string;
};
