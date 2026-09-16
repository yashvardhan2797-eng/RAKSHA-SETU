Raksha Setu 🚨


Intelligent Vehicle Accident Detection & Emergency Response System

Raksha Setu is a software-based intelligent emergency response platform designed to reduce the delay between a serious road accident and the arrival of appropriate emergency assistance.

The system is designed to integrate with vehicle ECU/OEM telemetry and sensors already available in the vehicle, analyze accident-related data, verify whether an incident is likely to be a genuine crash, and automatically initiate an emergency communication workflow.

Important: Raksha Setu does not require users to install custom hardware or external sensors. The proposed system is designed around data obtained through authorized vehicle/OEM interfaces.

| Component | Path | What it does |
|---|---|---|
| **Web control center** | `artifacts/raksha-setu` | React + Vite dashboard: live incidents, 30-s cancel window, personal info, Crash Lab (physics/servility simulation), engine reports, telemetry |
| **Cloud API** | `artifacts/api-server` | Express + Zod + Drizzle: incident ingest, lifecycle (active → cancelled / escalated), contact dispatch |
| **Vehicle integration** | `vehicle-integration` | The in-vehicle agent simulates ECU/CAN + OEM telematics + GNSS (bus 10) for crash-event detection, driver HMI (`public/index.html`), SSE receiver dashboard (`public/receiver.html`) |
| **Android apps** | `apk-dist/`, `D:\apk-build` | User app (SOS, profile, contacts) + operator dashboard app. ~40 KB each |
| **Ops scripts** | `scripts/` | Standalone APK server (`apk-server.js`), public publisher (`publish-apk.js`), one-click server launcher |

## Run it (from repo root)

bash
pnpm install

# web app — http://localhost:5173
pnpm --filter @raksha-setu/web run dev

# cloud API — http://localhost:3000
pnpm --filter @workspace/api-server run build
node --enable-source-maps artifacts/api-server/dist/index.js # (PORT=3000)

# vehicle bridge — http://localhost:8080
node vehicle-integration/src/index.js

# standalone APK download server — http://localhost:8081
pnpm apk-server



##Crash pipeline (demo flow)

@ ECU/CAN + OEM T-Box + GNSS (10 Hz)
@ On-board crash-confidence check (3 sensor families, 2-of-3 gate, false-positive guards)
@ Confidence ≥ 75 → alert preserved & transmitted to cloud
@ 30-second driver window → “I AM SAFE” + cancel cloud-side
@ If no response → escalate (contacts + control center)
@ Incident lifecycle tracked in cloud + dashboards (SSE) → Android apps

Docs
APK-INSTALL.md — install the Android apps (public links, file share, LAN)
DEPLOYMENT.md — architecture, deployment, SMS wiring, legal roadmap
#freebuff/full.md — preview/dev-server runbook
Verified physics

The Crash Lab reproduces the reference case dynamically (never hard-coded): 1500 kg, 80–60 km/h, 0.15 s → ΔV 5.56 m/s · 370 g · 3.78 g · 55.6 kN estimated average impact force.


**One thing to flag:** the screenshot text is quite small, so a few characters in the first table/Crash Pipeline lines are difficult to distinguish with absolute certainty. I have kept the transcription as close to the visible README as possible rather than silently rewriting it.
