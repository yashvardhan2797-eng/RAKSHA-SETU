// ============================================================================
// RAKSHA SETU — publish APKs to permanent public file hosts (no account).
//
// Uploads the two APKs to TWO hosts and prints both links:
//   1. gofile.io  — CDN-backed, reachable on Indian mobile networks (primary)
//   2. catbox.moe — simple permanent host (alternate; blocked by some ISPs)
// Re-run after every rebuild — each run produces FRESH links; old ones keep
// working too, so share the newest page when you ship an update.
//
//   pnpm publish-apk
//
// Requires: apk-dist/raksha-setu-user-app.apk + raksha-setu-dashboard.apk
// (copy them from D:\apk-build\ after building).
// ============================================================================
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apk-dist");

const FILES = [
  "raksha-setu-user-app.apk",
  "raksha-setu-dashboard.apk",
];

async function uploadGofile(fileName) {
  const buf = await readFile(path.join(DIST, fileName));
  const serversRes = await fetch("https://api.gofile.io/servers");
  const serversJson = await serversRes.json();
  const server = serversJson?.data?.servers?.[0]?.name;
  if (!server) throw new Error("gofile: no upload server available");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "application/vnd.android.package-archive" }), fileName);
  const res = await fetch(`https://${server}.gofile.io/contents/uploadfile`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`gofile: HTTP ${res.status}`);
  const json = await res.json();
  const page = json?.data?.downloadPage;
  if (!page) throw new Error(`gofile: ${json?.status ?? "unknown error"}`);
  return page;
}

async function uploadCatbox(fileName) {
  const buf = await readFile(path.join(DIST, fileName));
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", new Blob([buf], { type: "application/vnd.android.package-archive" }), fileName);
  const res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: form });
  if (!res.ok) throw new Error(`catbox: HTTP ${res.status}`);
  const url = (await res.text()).trim();
  if (!url.startsWith("http")) throw new Error(`catbox: unexpected response "${url}"`);
  return url;
}

console.log("RAKSHA SETU — publishing APKs to permanent public hosts...\n");
const results = [];
for (const f of FILES) {
  const entry = { file: f };
  try {
    entry.gofile = await uploadGofile(f);
    console.log(`✔ ${f}  ->  gofile: ${entry.gofile}`);
  } catch (err) {
    console.error(`✘ ${f} gofile: ${err.message}`);
  }
  try {
    entry.catbox = await uploadCatbox(f);
    console.log(`   (alt)            ->  catbox: ${entry.catbox}`);
  } catch (err) {
    console.error(`✘ ${f} catbox: ${err.message}`);
  }
  results.push(entry);
  console.log("");
}

if (results.length) {
  console.log("------------------------------------------------------------");
  console.log("Share these — they work on mobile data (gofile = primary):");
  results.forEach((r) => {
    if (r.gofile) console.log(`  ${r.file}\n    gofile : ${r.gofile}`);
    if (r.catbox) console.log(`    catbox : ${r.catbox}`);
  });
  console.log("------------------------------------------------------------");
  console.log("Then update apk-dist/index.html + APK-INSTALL.md with the new URLs.");
}
