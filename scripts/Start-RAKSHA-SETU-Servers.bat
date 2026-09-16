@echo off
title RAKSHA SETU Launcher
REM ============================================================
REM  RAKSHA SETU — starts the 3 demo servers + web app + 3
REM  PUBLIC tunnels (Cloudflare). Double-click this file.
REM  Public links work from ANY network (mobile data included)
REM  for as long as this window stays open.
REM ============================================================

set REPO=C:\Users\DEEPAKSINGHRATHORE\OneDrive\Desktop\raksha-setu
set BIN=%REPO%\.freebuff\bin\cloudflared.exe
set LOGS=%REPO%\.freebuff\logs
set OUT=%USERPROFILE%\OneDrive\Desktop\RAKSHA-SETU-APK\PUBLIC-LINKS.txt

echo [1/6] Stopping any old tunnels/servers from a previous run...
taskkill /F /IM cloudflared.exe >nul 2>&1
if exist "%LOGS%\tunnel-web.log.err" del "%LOGS%\tunnel-web.log.err" >nul 2>&1
if exist "%LOGS%\tunnel-vehicle.log.err" del "%LOGS%\tunnel-vehicle.log.err" >nul 2>&1
if exist "%LOGS%\tunnel-apk.log.err" del "%LOGS%\tunnel-apk.log.err" >nul 2>&1

echo [2/6] Starting APK download server (port 8081)...
start "RAKSHA APK Server" /min cmd /c "node "%REPO%\scripts\apk-server.mjs""

echo [3/6] Starting vehicle bridge (port 8080)...
start "RAKSHA Vehicle Bridge" /min cmd /c "cd /d "%REPO%\vehicle-integration" && node src\server.ts"

echo [4/6] Starting cloud api-server (port 3000)...
start "RAKSHA Cloud" /min cmd /c "cd /d "%REPO%\artifacts\api-server" && set PORT=3000&& node --enable-source-maps dist\index.mjs"

echo [5/6] Starting web app (Vite, port 5173)...
start "RAKSHA Web App" /min cmd /c "cd /d "%REPO%\artifacts\raksha-setu" && npm run dev"

echo [6/6] Opening 3 PUBLIC tunnels (Cloudflare)...
start "" /min "%BIN%" tunnel --url http://localhost:5173   >"%LOGS%\tunnel-web.log"     2>"%LOGS%\tunnel-web.log.err"
start "" /min "%BIN%" tunnel --url http://localhost:8080   >"%LOGS%\tunnel-vehicle.log" 2>"%LOGS%\tunnel-vehicle.log.err"
start "" /min "%BIN%" tunnel --url http://localhost:8081   >"%LOGS%\tunnel-apk.log"     2>"%LOGS%\tunnel-apk.log.err"

echo Waiting for public URLs (about 12 seconds)...
timeout /t 12 /nobreak >nul

set WEBURL=
set VEHURL=
set APKURL=
for /f "delims=" %%u in ('powershell -NoProfile -Command "(Select-String -Path '%LOGS%\tunnel-web.log.err' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1).Matches.Value"') do set WEBURL=%%u
for /f "delims=" %%u in ('powershell -NoProfile -Command "(Select-String -Path '%LOGS%\tunnel-vehicle.log.err' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1).Matches.Value"') do set VEHURL=%%u
for /f "delims=" %%u in ('powershell -NoProfile -Command "(Select-String -Path '%LOGS%\tunnel-apk.log.err' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1).Matches.Value"') do set APKURL=%%u

(
echo RAKSHA SETU - PUBLIC LINKS
echo Generated: %date% %time%
echo ------------------------------------------
echo Web app           : %WEBURL%
echo Vehicle dashboard : %VEHURL%
echo APK download page : %APKURL%
echo APK direct file   : %APKURL%/raksha-setu-user-app.apk
echo Dashboard APK file: %APKURL%/raksha-setu-dashboard.apk
echo ------------------------------------------
echo Links work from any phone/network while the
echo launcher windows are open. Local fallbacks:
echo   http://localhost:5173/  (web app)
echo   http://localhost:8080/  (vehicle dashboard)
echo   http://localhost:8081/  (APK downloads)
) > "%OUT%"

cls
echo ============================================================
echo  ALL SERVICES + PUBLIC TUNNELS RUNNING
echo ------------------------------------------------------------
type "%OUT%"
echo ============================================================
echo  Keep the minimized windows OPEN to keep links alive.
echo  This file is also saved to: PUBLIC-LINKS.txt
echo ============================================================
pause
