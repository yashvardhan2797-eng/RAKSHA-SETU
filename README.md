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

```bash
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

Web app demo login: admin@rakshasetu.in / raksha123

