# RAKSHA SETU — Android Apps (APK) Install & Use Guide

Two native Android apps (zero external dependencies, Android 7.0+), both built and signed:

| APK | Who it's for | What it does | Permanent public link |
|---|---|---|---|
| **`raksha-setu-user-app.apk`** (37 KB, **v1.2 light UI** — matches the web control center) | **The vehicle user / potential crash victim** | Login → Personal Info (name, age, gender, blood group, diseases, medication, address, GPS, emergency contacts) → big **SOS button** → **30-second cancel window** → incident history | **https://gofile.io/d/N1JMwM7a** |
| **`raksha-setu-dashboard.apk`** (21 KB) | Control-room operator / demo spectator | Live view of ALL incidents across vehicles with risk scores, notified contacts, map links | **https://gofile.io/d/clNf4SQe** |

Files also live at:
- **`Desktop\RAKSHA-SETU-APK\`** ← real files, share by USB / WhatsApp / Drive / email
- `vehicle-integration/public/raksha-setu-user-app.apk` and `...-dashboard.apk`
- `D:\apk-build\raksha-setu-user-app.apk` and `...-dashboard.apk`

---

## 0. View the LIVE dashboards from anywhere (public links) 🌍

The three services are exposed through Cloudflare tunnels — they work on **any
network, including mobile data**, for as long as the launcher is running on the
laptop. The current links are always saved in
**`Desktop\RAKSHA-SETU-APK\PUBLIC-LINKS.txt`** (regenerated on every launch).

| Service | Open on any phone/PC |
|---|---|
| **Web app** (control center) | see `PUBLIC-LINKS.txt` → *Web app* |
| **Vehicle dashboard** (ECU agent, sensors, crash flow) | see `PUBLIC-LINKS.txt` → *Vehicle dashboard* |
| **APK download page** (install both apps) | see `PUBLIC-LINKS.txt` → *APK download page* |

To (re)start everything and regenerate fresh links: double-click
**`Desktop\RAKSHA-SETU-APK\Start-RAKSHA-SETU-Servers.bat`** — it starts the four
servers **plus** the tunnels, then prints and saves the URLs.

> Tunnel URLs change every restart (free Quick Tunnels — no account needed).
> The APK *file* links in section 1 (gofile) are permanent and never change.

---

## 1. Install on a phone (2 minutes each)

Three ways — use whichever is easiest:

### Way 0 — PERMANENT PUBLIC LINKS (works anywhere, even on mobile data) ✅
Uploaded to a permanent file host — no Wi-Fi, no laptop, no account needed. Share these
on WhatsApp and anyone, anywhere can install:

```
User app      : https://gofile.io/d/N1JMwM7a   (primary — works on Indian mobile data)
Dashboard app : https://gofile.io/d/clNf4SQe
Mirrors       : https://files.catbox.moe/l97bs6.apk  ·  .../q9fkmv.apk
                (catbox is blocked by some Indian ISPs — use gofile first)
```

> **v1.2 note:** if you installed v1.0/v1.1 earlier, Android installs this as an
> update (same signature) — the app switches from dark-navy to the light
> web-control-center theme. If the app still looks dark after updating, you're
> opening an old copy of the file; re-download from the link above.

Phone → open link → tap the file on the gofile page → download → allow
"Install unknown apps" → Install.
Re-publish after rebuilding with `pnpm publish-apk` (uploads to BOTH hosts and
prints fresh links).

### Way A — copy the FILE (works with zero servers, recommended offline)
The APK is a normal file. From **`Desktop\RAKSHA-SETU-APK\`**, send it by WhatsApp /
USB cable / Google Drive / email to any phone, then tap the file on the phone →
allow **Install unknown apps** → Install. No laptop, no Wi-Fi, no links needed.

### Way B — download from the standalone APK server (phones on same Wi-Fi)
Start it **without Freebuff**: double-click **`Desktop\RAKSHA-SETU-APK\Start-RAKSHA-SETU-Servers.bat`
(or `pnpm apk-server` in the repo). Then on the phone's Chrome:

```
http://<laptop-ip>:8081/            ← download page with big buttons
http://<laptop-ip>:8081/raksha-setu-user-app.apk   ← direct file
```

The laptop's current IP is printed when the server starts (it was `192.168.1.3`);
run `ipconfig` if it changed. This server is independent of the Freebuff desktop
app — **closing Freebuff does NOT stop it**.

On a *different* network (mobile data etc.), use the **public tunnel** link for
the APK page from section 0 instead.

### Way C — from the vehicle bridge (also independent once started by the .bat)
Same as Way B but port 8080: `http://<laptop-ip>:8080/app.apk`.

**If a phone still can't reach the laptop:** the firewall rule
"RAKSHA SETU Node" (ports 3000/5173/8080/8081) must exist — it was added on
2026-09-16. If it was removed, re-add it as Administrator:
`netsh advfirewall firewall add rule name="RAKSHA SETU Node" dir=in action=allow protocol=TCP localport=3000,5173,8080,8081 profile=private,public`.
If the router has AP isolation, use Windows **Mobile Hotspot**: phone joins the
laptop's hotspot, URL becomes `http://192.168.137.1:8081/`.

## 2. The USER app — what the person does in an accident

**First run (one time):** Sign in (demo: `admin@rakshasetu.in` / `raksha123`) → **My Info** tab →
fill name, age, gender, blood group, diseases, medication, address → add emergency contacts
(name/relation/phone) → 📍 **Capture** GPS → **Save**. Everything is stored on the phone.

**In a crash (or to trigger a demo SOS):**
1. Open app → Home tab → tap the red **SOS** button → confirm.
2. The app grabs fresh GPS, then sends the full package to the server:
   **profile (blood group, diseases, medication) + exact coordinates + all emergency contacts**,
   as a `MANUAL_SOS` CRITICAL incident. Contacts are alerted immediately (SMS via Twilio/MSG91
   when configured, simulated in demo).
3. **⏱ 30-second cancellation window** appears with a live countdown — if it's a false alarm,
   tap **✔ I'M SAFE — CANCEL** and the incident is marked false-alarm on the server and
   dispatch stops. If not cancelled, the banner reads "dispatch confirmed" and help workflow proceeds.
4. **Incidents** tab: the person's own incident history — status, risk, false-alarm badge,
   and 📍 crash location on a map.

Server address defaults to `http://192.168.1.3:8080`; change it in My Info → ⚙ (works against
the bridge `:8080` or the api-server `:3000` directly).

## 3. The DASHBOARD app — operator view

Read-only monitoring: ● LIVE/OFFLINE, auto-refresh 5s, every vehicle's incidents with risk
score badges, lifecycle status, 💾 database marker, 📍 map button, 📱 notified contacts.
Vibrates + toast on new CRITICAL incidents. ⚙ Change server to repoint.

## 4. Rebuilding after code changes

No Gradle/Android Studio needed — toolchain lives in `D:\apk-build` (portable JDK 17 +
build-tools 34). One command each:

```
bash /d/apk-build/build-user-app.sh     # -> D:\apk-build\raksha-setu-user-app.apk
bash /d/apk-build/build.sh              # -> D:\apk-build\raksha-setu-dashboard.apk
cp /d/apk-build/*.apk vehicle-integration/public/
```

Sources: `D:\apk-build\raksha-user-app\...` (user app), `D:\apk-build\raksha-app\...` (dashboard).
Signing keystore: `D:\apk-build\raksha-release.keystore` (alias `raksha`, pass `raksha2026`) —
**keep it**: installing an update signed with a different key requires uninstalling first.

## 5. Notes

- HTTP (cleartext) to LAN IPs is intentional for demo use; front with HTTPS (e.g. Cloudflare
  Tunnel) for anything public.
- SOS alerts reach contacts while the app is open (and via the server's SMS dispatch regardless);
  locked-screen/headless alerting needs a foreground service — the next upgrade.
- Play Store distribution needs an AAB + data-safety declarations; for the SIH demo, direct
  APK install is the right path.
