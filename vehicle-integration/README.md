# RAKSHA SETU — Vehicle Integration Simulator

> **ISOLATED DEMO COMPONENT.** This folder is a completely separate vehicle-side
> software/integration **simulation layer** for hackathon (SIH) demonstration.
> It does **not** modify, import, or depend on any existing RAKSHA SETU
> application file. The existing application keeps working exactly as before.

---

## 1. Purpose

Visually and *technically* demonstrate the data flow:

```
VEHICLE
  ↓
VEHICLE TELEMATICS / OEM INTERFACE      (simulated)
  ↓
VEHICLE INTEGRATION SOFTWARE            ← THIS COMPONENT
  ↓
LOCAL API / SSE CHANNEL                 (real HTTP between processes)
  ↓
RAKSHA SETU INTEGRATION RECEIVER        (receiving side, isolated)
  ↓
INCIDENT EVENT · RISK SCORE
  ↓
EMERGENCY WORKFLOW (existing RAKSHA SETU concept)
```

**What this IS:** a deterministic, jury-ready vehicle telemetry + accident
detection simulator with a real local HTTP bridge.

**What this is NOT:** no real ECU/CAN-bus access, no OEM integration, no
certified crash detection, no real emergency dispatch/SMS/voice, no ML model.

---

## 2. Architecture

```
             VEHICLE SIDE (simulated)                    INTEGRATION SIDE
┌────────────────────────────────────────┐   ┌──────────────────────────────────┐
│  Simulator Dashboard  (http://…:8080/) │   │  Receiver Dashboard              │
│  ────────────────────────────────────  │   │  (http://…:8080/receiver)        │
│  Simulated OEM/Telematics data         │   │                                  │
│        ↓                               │   │  ┌────────────────────────────┐  │
│  Telemetry Generator                   │   │  │ Existing RAKSHA SETU app   │  │
│        ↓                               │   │  │ embedded read-only         │  │
│  Accident Detection (deterministic)    │   │  │ (localhost:5173 iframe)    │  │
│        ↓                               │   │  └────────────────────────────┘  │
│  Risk Calculation (rule-based)         │   │  Lifecycle · Risk · Raw packet   │
└──────────────────┬─────────────────────┘   └───────────────▲────────────────┘
                   │  POST /api/vehicle/telemetry            │ SSE
                   │  POST /api/vehicle/accident             │ (server-sent events)
                   ▼                                         │
         ┌───────────────────────────────────────────────────┴──┐
         │  VEHICLE-INTEGRATION BRIDGE  (src/server.ts, :8080)  │
         │  Event ID · Vehicle ID · Timestamp · Crash signal ·  │
         │  Risk score · honest forward-attempt log             │
         └───────────────────────────────────────────────────────┘
```

*Everything between the dashboards is **real network traffic** (HTTP POST +
Server-Sent Events). Nothing is a fake animation.*

## 3. Vehicle simulator

Simulated vehicle (all values are demo placeholders):

| Field | Value |
|---|---|
| Vehicle ID | `RS-VHC-001` |
| Driver | `Demo Driver` |
| Vehicle | `Demo Connected Vehicle` |
| Telematics unit | `Simulated OEM / Telematics Gateway v0.1` |
| Location | `26.9124, 75.7873` — **SIMULATED VEHICLE LOCATION** |

Normal driving telemetry (every 2 s): speed `62 km/h`, accel `0.4 m/s²`,
decel `0.1 m/s²`, heading `142°`, crash `FALSE`, SOS `FALSE`.

## 4. Telemetry model

Every packet is a structured JSON object (see `src/types.ts`):

```json
{
  "packetId": "PKT-0007",
  "eventType": "ACCIDENT_DETECTED",
  "vehicleId": "RS-VHC-001",
  "timestamp": "2026-09-12T10:41:00.000Z",
  "location": { "latitude": 26.9124, "longitude": 75.7873, "simulated": true,
                "label": "SIMULATED VEHICLE LOCATION" },
  "vehicle": { "speedKmh": 0, "acceleration": -8.2, "deceleration": 8.2,
               "heading": 142, "status": "STOPPED", "ignition": "ON" },
  "signals": { "crashSignal": true, "impactDetected": true, "sos": false,
               "abnormalOrientation": true, "unexpectedStop": true },
  "driver": { "response": "PENDING" },
  "risk": { "score": 65, "category": "HIGH",
            "factors": ["Sudden Deceleration (+30)", "Abnormal Orientation (+20)",
                        "Unexpected Stop (+15)"],
            "model": "Prototype / Demo Risk Model (not certified crash detection)" }
}
```

## 5. Accident simulation (deterministic)

`SIMULATE ACCIDENT` always runs the **same predictable T0→T6 sequence**
(no randomness):

| Step | t | What happens | Speed | Decel | Crash | Risk |
|---|---|---|---|---|---|---|
| T0 | +0 ms | Normal telemetry | 62 | 0.1 | FALSE | 0 LOW |
| T1 | +1 s | Sudden deceleration | 41 | 4.6 | FALSE | 30 MEDIUM |
| T2 | +2 s | Abnormal orientation | 18 | 6.4 | FALSE | 50 HIGH |
| T3 | +3 s | **Impact detected** | 0 | 8.2 | **TRUE** | 65 HIGH |
| T4 | +4 s | Unexpected stop | 0 | 8.2 | TRUE | 65 HIGH |
| T5 | +5 s | **ACCIDENT event created + transmitted** | 0 | 8.2 | TRUE | 65 HIGH |
| T6 | +6 s | Driver no response → escalation | 0 | 8.2 | TRUE | **90 CRITICAL** |

The driver can press **I'M SAFE** during the pending window — the escalation is
cancelled (mirrors RAKSHA SETU's driver-verification concept).

## 6. Risk engine (Prototype / Demo Risk Model)

Explainable rule-based scoring, clamped to 0–100
(`src/risk.ts` — **not** certified crash detection):

| Rule | Weight |
|---|---|
| Sudden Deceleration | +30 |
| Abnormal Orientation | +20 |
| Unexpected Stop | +15 |
| Driver No Response | +25 |
| Manual SOS | +30 |

Categories: `0–24 LOW` · `25–49 MEDIUM` · `50–74 HIGH` · `75–100 CRITICAL`.

## 7. Communication protocol

Chosen for **reliability first** (SIH live demo):

* **HTTP REST (POST)** — telemetry + emergency events, simulator → bridge.
* **Server-Sent Events (SSE)** — bridge → receiver dashboards (one-way, auto-reconnect,
  simpler and more robust than WebSockets for a live demo).

## 8. RAKSHA SETU integration — honest integration statement

**Inspection result (verified before building):**

* The existing app (`artifacts/raksha-setu`) is a mock-data-driven frontend.
  It has **no external ingest endpoint** — data cannot be injected into its UI
  without changing protected source files.
* The existing backend (`artifacts/api-server`, express) exposes **only
  `GET /api/healthz`**, needs a Postgres DB, and has no vehicle route.

**Therefore, per the protection rules, ZERO existing files were modified.**
The bridge instead:

1. **Probes** the existing app read-only (`GET /` on `:5173`) and shows an
   honest `CONNECTED / WAITING` pill.
2. **Embeds** the existing app read-only in the receiver page (iframe) so the
   jury sees both systems on one screen.
3. **Best-effort forwards** every accident event to the existing api-server
   (`POST {RAKSHA_API_URL}/api/vehicle/accident`) and **records the honest HTTP
   result** (currently `404 / unreachable` — documented, not faked).
4. **Documents the production integration point:**
   * Backend: a `POST /api/vehicle/accident` route in
     `artifacts/api-server/src/routes` → incident creation via the existing
     incident system.
   * Frontend: the mock-data boundary
     (`artifacts/raksha-setu/src/data/mock-data.ts`) would be replaced by a
     fetch of real incidents from the API client
     (`@workspace/api-client-react`).

## 9. API endpoints (bridge, default `http://localhost:8080`)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Vehicle Integration **Simulator dashboard** |
| GET | `/receiver` | RAKSHA SETU **Integration Receiver dashboard** |
| GET | `/api/vehicle/health` | Connection snapshot (probes existing app) |
| GET | `/api/vehicle/status` | Full snapshot: status, events, log |
| GET | `/api/vehicle/events` | All recorded integration events |
| GET | `/api/vehicle/simulation-spec` | Deterministic demo spec (single source of truth) |
| GET | `/api/vehicle/stream` | SSE stream (receiver dashboards) |
| POST | `/api/vehicle/telemetry` | Receive a telemetry packet (real transfer) |
| POST | `/api/vehicle/accident` | Receive an accident/SOS event (real transfer) |
| POST | `/api/vehicle/reserve-event-id` | Reserve next `EVT-####` id |
| POST | `/api/vehicle/reset` | **RESET DEMO** |

## 10. Commands

**Requirements:** Node.js **≥ 24** (native TypeScript execution). No `pnpm
install` needed — **zero runtime dependencies**.

```bash
# Terminal 1 — existing RAKSHA SETU app (from the repository root)
pnpm --filter @workspace/raksha-setu run dev        # → http://localhost:5173

# Terminal 2 — vehicle integration simulator (from repository root)
cd vehicle-integration
node src/server.ts                                  # or: pnpm dev  /  npm run dev
# → Simulator: http://localhost:8080/   Receiver: http://localhost:8080/receiver
```

Environment overrides (optional): `VEHICLE_PORT` (default 8080),
`RAKSHA_APP_URL` (default `http://localhost:5173`),
`RAKSHA_API_URL` (default `http://localhost:3000`).

### Optional: AI incident narration (Groq)

When an accident event is acknowledged, the bridge can additionally ask the
**Groq API** (Llama) for a short control-room incident summary. It is attached
to the event, shown on the receiver dashboard and clearly labelled
*“AI-generated · simulated data”*.

* Key is read from the **local, gitignored** `vehicle-integration/.env`:
  `GROQ_API_KEY=gsk_…` (+ optional `GROQ_MODEL`, default `openai/gpt-oss-20b`).
* **Zero dependencies** — plain REST call via Node's native `fetch`.
* **Optional by design**: with no key or no network the demo runs identically,
  the summary is simply skipped (`GET /api/vehicle/ai-status` reports it).
* The narration never claims a real emergency service was contacted.

## 11. Exact SIH demo sequence

1. Start both terminals (commands above). Both dashboards show **CONNECTED**.
2. Simulator runs **NORMAL DRIVE** automatically — packets every 2 s, risk 0.
3. Press **💥 SIMULATE ACCIDENT** → watch T0→T6: deceleration spikes, IMPACT
   YES, crash TRUE, risk climbs 0 → 30 → 50 → 65 → 90 **CRITICAL**.
4. Transmission pipeline lights up: **PACKET GENERATED → TRANSMITTING
   (POST /api/vehicle/accident) → HTTP 200 → EVENT EVT-0001 CREATED →
   RECEIVER NOTIFIED**.
5. Switch to the **Receiver dashboard**: the event arrived live via SSE with
   lifecycle `RAKSHA_SETU_ACKNOWLEDGED → DRIVER_VERIFICATION_PENDING`, full
   packet JSON, risk breakdown, and the real RAKSHA SETU app embedded beside it.
6. Do nothing for 6 s → lifecycle becomes **ESCALATED** (driver no response).
   (Or press **I'M SAFE** in the simulator to cancel escalation.)
7. Also available: **MANUAL SOS** (+30, SOS TRUE), **SEND TEST TELEMETRY**,
   **⟲ RESET DEMO** (returns everything to NORMAL, risk 0, log cleared).

## 12. Limitations & future OEM integration

* Simulation only — **no ECU/CAN-bus/OEM access**, no real telemetry hardware.
* Risk model is rule-based demo logic, **not** certified crash detection.
* In-memory store — no database (intentional for the prototype).
* No authentication/encryption — localhost demo channel; production requires
  a secure authenticated API.
* No real SMS/voice/dispatch — contacts are **queued-only simulated events**.
* Production path: authorized OEM/telematics feed → vehicle-integration
  adapter → secure API (`artifacts/api-server`) → RAKSHA SETU incident system.

