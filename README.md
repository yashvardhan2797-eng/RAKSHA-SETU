# Raksha Setu 🚨

**Intelligent Vehicle Accident Detection & Emergency Response System**

Raksha Setu is a software-based intelligent emergency response platform designed to reduce the delay between a serious road accident and the arrival of appropriate emergency assistance.

The system is designed to integrate with vehicle ECU/OEM telemetry and sensors already available in the vehicle, analyze accident-related data, verify whether an incident is likely to be a genuine crash, and automatically initiate an emergency communication workflow.

> **Important:** Raksha Setu does not require users to install custom hardware or external sensors. The proposed system is designed around data obtained through authorized vehicle/OEM interfaces.

> ⚠️ **Demo/educational project.** It does **not** contact real emergency services.
> Severity classifications are demonstration rules, not certified crashworthiness or
> medical assessments.

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
