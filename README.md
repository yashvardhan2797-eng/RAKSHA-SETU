🚨 Raksha Setu
Intelligent Vehicle Accident Detection & Emergency Response Platform

Raksha Setu is a software-based vehicle safety platform designed to detect potential accidents from vehicle telemetry, evaluate the severity of an incident, verify the event, and initiate an emergency communication workflow automatically.

The system is designed to work with existing vehicle ECU/OEM data and sensors through an authorized vehicle-data interface. The current prototype uses simulated vehicle telemetry to demonstrate the complete software workflow without requiring additional hardware.

✨ Features
🚗 Vehicle Telemetry Integration — Designed to receive data from existing vehicle systems through authorized interfaces.

🧠 Accident Detection — Analyzes vehicle parameters to identify potentially dangerous events.

🤖 AI-Assisted Verification — Helps distinguish genuine accident events from abnormal but non-critical driving events.

⏱️ Emergency Verification Window — Provides a short cancellation period before an emergency alert is initiated.

📍 Location Handling — Supports transmitting available incident-location information.

📡 Emergency Communication — Designed to communicate incident information to configured emergency contacts/services.

🔄 Communication Fallback — Supports a fallback communication architecture when the primary channel is unavailable.

📊 Real-Time Dashboard — Displays vehicle status, detected events, risk level, and emergency workflow status.

🧪 Vehicle Data Simulator — Allows the complete system to be tested without physical vehicle hardware.

📝 Incident Logging — Maintains structured information about detected events and response states.

## What's inside

| Component | Path | What it does |
|---|---|---|
| **Web control center** | `artifacts/raksha-setu` | React + Vite dashboard: live incidents, 30-s cancel window, personal info, **Crash Lab** (physics/severity/simulation engines, reports, telemetry) |
| **Cloud API** | `artifacts/api-server` | Express + Zod + Drizzle: incident ingest, lifecycle (active → cancelled / escalated), contact dispatch |
| **Vehicle integration** | `vehicle-integration` | The **in-vehicle agent**: simulated ECU/CAN + OEM telematics + GNSS on a 10 Hz bus, on-board crash-confidence check, alert transmission, driver HMI (`public/index.html`), SSE receiver dashboard (`public/receiver.html`) |
| **Android apps** | `apk-dist/` | User app (SOS, profile, contacts) + operator dashboard app, ~40 KB each |
| **Ops scripts** | `scripts/` | Standalone APK server (`apk-server.mjs`), public publisher (`publish-apk.mjs`), one-click server launcher (`Start-RAKSHA-SETU-Servers.bat`) |

## Run it (from repo root)

```bash
pnpm install

# web app — http://localhost:5173
pnpm --filter @workspace/raksha-setu run dev

# cloud API — http://localhost:3000
pnpm --filter @workspace/api-server run build
node --enable-source-maps artifacts/api-server/dist/index.mjs   # (PORT=3000)

# vehicle bridge — http://localhost:8080
node vehicle-integration/src/server.ts

# standalone APK download server — http://localhost:8081
pnpm apk-server
```

Web app demo login: `admin@rakshasetu.in` / `raksha123`.

## Crash pipeline (demo flow)

```
① ECU/CAN + OEM T-Box + GNSS frames (10 Hz)
② On-board crash-confidence check (3 sensor families, 2-of-3 gate, false-positive guards)
③ Confidence ≥ 75 → alert reserved & transmitted to cloud
④ 30-second driver window → 5A "I'M SAFE" → cancel cloud-side
                           → 5B no response → escalate (contacts + control center)
⑤ Incident lifecycle tracked in cloud + dashboards (SSE) → Android apps
```

## Docs

- `APK-INSTALL.md` — install the Android apps (public links, file share, LAN)
- `DEPLOYMENT.md` — architecture, deployment, SMS wiring, legal roadmap

## Verified physics

The Crash Lab reproduces the reference case dynamically (never hard-coded):
1500 kg, 80→60 km/h, 0.15 s → ΔV 5.56 m/s · 37.0 m/s² · 3.78 g · 55.6 kN estimated average impact force.
