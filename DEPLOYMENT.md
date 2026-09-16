# RAKSHA SETU — Deployment & Operations Guide

How to run the full stack locally, deploy it to production, wire real SMS, and
the legal roadmap for alerting official emergency services.

---

## Architecture at a glance

```
Vehicle / phone sensor                                  Demo laptop or small VPS
  │ POST telemetry + accident (JSON)                       ┌────────────────────┐
  ▼                                                        │ vehicle-integration│
vehicle-integration bridge ──SSE──► receiver dashboards    │ bridge  (:8080)    │
  │                                                        └─────────┬──────────┘
  │ POST {RAKSHA_API_URL}/api/vehicle/accident                       │ forwards
  ▼                                                                  ▼
┌───────────────────────────┐   Drizzle   ┌──────────────┐    ┌─────────────┐
│ api-server  (Railway/Render│────────────►│  PostgreSQL  │    │  Frontend   │
│ Express 5, this repo)      │             │ Neon/Supabase│    │ Vercel/Net  │
└──────────┬────────────────┘             └──────────────┘    └─────────────┘
           │ SMS on confirmed emergency (step 7A)
           ▼
   Saved emergency contacts (Twilio / MSG91)  — relatives, legal for any product
```

Official emergency services (112/100/108) are **never auto-messaged** by this
code. See the [Legal roadmap](#legal-roadmap-contacting-emergency-services)
below.

---

## 1. Run locally (no database needed)

```bash
pnpm install

# Terminal 1 — frontend (http://localhost:5173)
pnpm --filter @workspace/raksha-setu run dev

# Terminal 2 — vehicle bridge (http://localhost:8080)
cd vehicle-integration && node src/server.ts

# Terminal 3 — api-server (optional locally; needs PORT)
PORT=3000 pnpm --filter @workspace/api-server run dev
```

Without `DATABASE_URL` the api-server runs in **in-memory mode**: every route
works, incidents are stored in memory, and responses say `"persisted": false`.
Point the bridge at it with:

```bash
RAKSHA_API_URL=http://localhost:3000 node src/server.ts
```

---

## 2. Database (Neon / Supabase / Railway — free tiers)

1. Create a Postgres instance (e.g. [neon.tech](https://neon.tech)).
2. Copy the connection string.
3. Push the schema:

```bash
DATABASE_URL="postgresql://…" pnpm --filter @workspace/db run push
```

This creates `owners`, `emergency_contacts`, `incidents`,
`contact_notifications`. Re-run after schema changes.

---

## 3. Deploy the api-server (Railway / Render / Fly.io)

1. Create a service from this repo (root = repository root).
2. Build: `pnpm install && pnpm --filter @workspace/api-server run build`
3. Start: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
4. Env vars:

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port (Railway/Render inject this) |
| `DATABASE_URL` | `postgresql://…` | Enables persistence |
| `TWILIO_ACCOUNT_SID` | `AC…` | SMS provider (optional) |
| `TWILIO_AUTH_TOKEN` | `…` | SMS provider (optional) |
| `TWILIO_FROM_NUMBER` | `+1…` or Messaging Service SID | SMS provider (optional) |
| `MSG91_AUTH_KEY` | `…` | Alternative SMS provider (optional) |

5. Health check path: `/api/healthz`.

## 4. Deploy the frontend (Vercel / Netlify)

- Build command: `pnpm install && pnpm --filter @workspace/raksha-setu run build`
- Output directory: `artifacts/raksha-setu/dist/public`
- The frontend is a mock-data SPA; to show live incidents it would fetch
  `GET {API_URL}/api/vehicle/incidents` — set the API base URL when you wire
  that (see `artifacts/raksha-setu/src/data/mock-data.ts`).
- CORS is already open (`app.use(cors())`) — tighten `origin` before going live.

## 5. Deploy the vehicle bridge

The bridge is dependency-free Node ≥ 24:

```bash
RAKSHA_APP_URL=https://your-frontend.vercel.app \
RAKSHA_API_URL=https://your-api.up.railway.app \
VEHICLE_PORT=8080 \
node src/server.ts
```

Run it on your demo laptop (with a tmux session) or any small VPS. For a public
URL during demos, use a tunnel (`ngrok http 8080`).

---

## 6. Real SMS to saved contacts (legal today)

Dispatch targets **saved personal emergency contacts** (relatives) — sending
them an accident alert with location is legal for any product. Without provider
keys the api-server queues alerts as `simulated` (visible in every UI log).

**Twilio (fastest to start):**
1. Sign up, buy/claim a number or Messaging Service.
2. Set the three `TWILIO_*` env vars above — dispatch switches automatically.
3. Trial accounts can only text **verified** numbers — fine for a demo.

**MSG91 (cheaper for Indian routes):**
1. Register, complete **TRAI DLT registration** (required for transactional
   SMS in India — do this early, it takes days).
2. Set `MSG91_AUTH_KEY`, optionally `MSG91_SENDER` (6 chars, DLT-approved)
   and `MSG91_ROUTE` (`4` = transactional).

---

## Legal roadmap: contacting emergency services

| Stage | Mechanism | Legal status |
|---|---|---|
| Prototype (now) | Alerts to saved contacts only; services simulated | ✅ Legal today |
| v1 (product) | **User-confirmed dialer handoff**: after the 30-second window, the app offers `tel:112` — the user's own phone places the call | ✅ Legal (user-initiated call) |
| v2 (revenue) | **Contracted private responders**: ambulance fleets / roadside assistance integrate via your API and dispatch | ✅ Legal (contract) |
| v3 (full) | **ERSS-112 MoU**: incorporate → DPIIT recognition → MoU with State Police/MHA → C-DAC grants an NDERSS integration endpoint | Requires MoU |

Compliance checklist for v1+:
- **DPDP Act 2023**: health + location are sensitive — explicit consent,
  purpose limitation, deletion rights. Consent screen at registration.
- **TRAI DLT**: register templates for the crash-alert SMS.
- **Security audit** before the police MoU (they will require it).

The dispatch layer in `artifacts/api-server/src/lib/dispatch.ts` is
provider-swappable by design: for v3 you add an `erss` provider that posts to
the C-DAC endpoint — no other code changes.

---

## 7. Verification checklist

```bash
# Schema pushed and tables exist
psql "$DATABASE_URL" -c '\dt'

# Ingest round-trip (bridge running, api deployed or local)
curl -X POST "http://localhost:8080/api/vehicle/accident" \
  -H 'content-type: application/json' \
  -d '{"eventId":"EVT-TEST-1","packet":{…telemetry packet…}}'
# → {"ok":true,"incidentId":1,"persisted":true,"notifications":[…]}

# Frontend: Personal Info → add contacts; Demo Simulator → Simulate Crash;
# incident drawer shows "Emergency contacts notified" with per-contact status.
```
