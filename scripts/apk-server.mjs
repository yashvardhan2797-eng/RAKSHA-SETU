// ============================================================================
// RAKSHA SETU — standalone APK download server (zero dependencies)
//
// Serves the built APK files over the local network so any phone can download
// them directly. Runs as an ordinary Node process — it does NOT depend on the
// Freebuff desktop app, the bridge, or the cloud server. As long as this
// laptop is on, the download link works.
//
//   Start:   pnpm apk-server        (or: node scripts/apk-server.mjs)
//   Phone:   http://<laptop-ip>:8081/raksha-setu-user-app.apk
//
// ============================================================================
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const PORT = Number(process.env.APK_PORT ?? 8081);
const HOST = "0.0.0.0"; // reachable from phones on the same Wi-Fi

const APK_DIR = process.env.APK_DIR
  ? path.resolve(process.env.APK_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "vehicle-integration", "public");

const FILES = {
  "/raksha-setu-user-app.apk": "raksha-setu-user-app.apk",
  "/app.apk": "raksha-setu-user-app.apk", // alias
  "/raksha-setu-dashboard.apk": "raksha-setu-dashboard.apk",
  "/dashboard.apk": "raksha-setu-dashboard.apk", // alias
};

const APK_MIME = "application/vnd.android.package-archive";

function lanAddresses() {
  const out = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === "IPv4" && !i.internal) out.push(i.address);
    }
  }
  return out;
}

function landingPage() {
  const ips = lanAddresses();
  const primary = ips[0] ?? "localhost";
  const links = Object.keys(FILES)
    .filter((k) => !k.startsWith("/app") && !k.startsWith("/dash"))
    .map(
      (route) => `<a class="btn" href="http://${primary}:${PORT}${route}" download>⬇ ${FILES[route]}</a>`,
    )
    .join("\n      ");
  const allIps = ips.map((ip) => `<code>http://${ip}:${PORT}/raksha-setu-user-app.apk</code>`).join("<br/>");
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>RAKSHA SETU — APK Downloads</title>
<style>
  body{background:#0b1220;color:#e8eefc;font-family:system-ui,sans-serif;display:flex;
       min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{background:#141d33;border:1px solid #2a3a5f;border-radius:16px;padding:32px;
        max-width:640px;text-align:center}
  h1{color:#f5c518;margin:0 0 4px;font-size:22px}
  p{color:#9fb0d0;font-size:14px;line-height:1.6}
  .btn{display:block;margin:10px auto;padding:14px 18px;background:#f5c518;color:#0b1220;
       font-weight:700;text-decoration:none;border-radius:10px;font-size:15px}
  code{display:inline-block;background:#0b1220;padding:4px 8px;border-radius:6px;
       margin:3px 0;font-size:12px;color:#7fd4a0}
  .warn{color:#f0a35e;font-size:13px}
</style></head>
<body><div class="card">
  <h1>🛡 RAKSHA SETU — APK Downloads</h1>
  <p>Open this page <b>on your phone</b> (same Wi-Fi as this laptop), tap a button,
     allow "install from unknown sources" when asked.</p>
      ${links}
  <p class="warn">If the button does nothing, type this in your phone browser:</p>
  <p>${allIps}</p>
</div></body></html>`;
}

const server = createServer(async (req, res) => {
  const url = (req.url ?? "/").split("?")[0];
  try {
    if (url === "/" || url === "/index.html") {
      const html = landingPage();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    const fileName = FILES[url];
    if (!fileName) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found. Try / for the download page.\n");
      return;
    }
    const filePath = path.join(APK_DIR, fileName);
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end(`APK missing on server: ${filePath}\nBuild it first (see D:\\apk-build\\build-user-app.sh).`);
      return;
    }
    const buf = await readFile(filePath);
    res.writeHead(200, {
      "content-type": APK_MIME,
      "content-length": buf.length,
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    });
    res.end(buf);
    console.log(`[apk-server] ${new Date().toISOString()} ${req.socket.remoteAddress} downloaded ${fileName} (${buf.length} bytes)`);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(`Server error: ${err?.message ?? err}`);
  }
});

server.listen(PORT, HOST, () => {
  const ips = lanAddresses();
  console.log("============================================================");
  console.log(" RAKSHA SETU — APK DOWNLOAD SERVER (standalone)");
  console.log("============================================================");
  console.log(" This laptop : http://localhost:" + PORT + "/");
  ips.forEach((ip) => console.log(` Phones      : http://${ip}:${PORT}/  (same Wi-Fi)`));
  console.log(" Independent of Freebuff — keep this laptop on and it stays up.");
  console.log("============================================================");
});
