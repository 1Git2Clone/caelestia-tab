// How long a new tab takes, in a real, headless Firefox with the extension
// and the helper, and a real wallpaper: opens a few new tabs and prints when
// each one's state was loaded and its page mounted, in ms from navigation.
// Isolated like tests/e2e-firefox.mjs, under a throwaway HOME.
//
//   cargo build && npm run --prefix extension build
//   WALLPAPER=~/Pictures/wall.png nix shell nixpkgs#firefox nixpkgs#geckodriver -c node tests/newtab-speed.mjs
//
// WALLPAPER defaults to caelestia's current one.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const helper =
  process.env.HELPER ??
  path.join(JSON.parse(execFileSync("cargo", ["metadata", "--format-version=1", "--no-deps"], { cwd: root })).target_directory, "debug/caelestia-tab");
const real = path.join(os.homedir(), ".local/state/caelestia");
const wallpaper = process.env.WALLPAPER ?? fs.readFileSync(path.join(real, "wallpaper/path.txt"), "utf8").trim();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "caelestia-tab-speed-"));
const state = path.join(tmp, "state/caelestia");
fs.mkdirSync(path.join(state, "wallpaper"), { recursive: true });
fs.mkdirSync(path.join(tmp, "home/.mozilla/native-messaging-hosts"), { recursive: true });
fs.copyFileSync(path.join(real, "scheme.json"), path.join(state, "scheme.json"));
fs.writeFileSync(path.join(state, "wallpaper/path.txt"), wallpaper);
fs.writeFileSync(path.join(tmp, "home/.mozilla/native-messaging-hosts/caelestia_tab.json"), execFileSync(helper, ["manifest"]));
// Your settings too (SETTINGS=none for the defaults): the background's blur
// and dim are what a wallpaper costs to paint.
const saved = process.env.SETTINGS ?? path.join(os.homedir(), ".config/caelestia-tab/settings.json");
if (saved !== "none" && fs.existsSync(saved)) {
  fs.mkdirSync(path.join(tmp, "home/.config/caelestia-tab"), { recursive: true });
  fs.copyFileSync(saved, path.join(tmp, "home/.config/caelestia-tab/settings.json"));
  const bg = JSON.parse(fs.readFileSync(saved, "utf8")).background;
  console.log(`settings: ${saved}, background ${JSON.stringify(bg)}`);
}
console.log(`wallpaper: ${wallpaper} (${(fs.statSync(wallpaper).size / 1e6).toFixed(1)} MB)`);

const PORT = 4456;
const W = `http://127.0.0.1:${PORT}`;
const driver = spawn("geckodriver", ["--allow-system-access", "--port", String(PORT)], {
  env: { ...process.env, HOME: path.join(tmp, "home"), XDG_STATE_HOME: path.join(tmp, "state"), XDG_CACHE_HOME: path.join(tmp, "cache") },
  stdio: "ignore",
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1000);
async function call(method, route, body) {
  const r = await fetch(W + route, { method, headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) });
  const { value } = await r.json();
  if (value?.error) throw new Error(`${route}: ${value.error}: ${value.message}`);
  return value;
}

let id;
try {
  ({ sessionId: id } = await call("POST", "/session", { capabilities: { alwaysMatch: { "moz:firefoxOptions": { args: ["-headless"] } } } }));
  const s = `/session/${id}`;
  await call("POST", `${s}/moz/addon/install`, { path: path.join(root, "extension/dist"), temporary: true });
  const open = async () => {
    await call("POST", `${s}/moz/context`, { context: "chrome" });
    await call("POST", `${s}/execute/sync`, { script: "BrowserCommands.openTab();", args: [] });
    await call("POST", `${s}/moz/context`, { context: "content" });
    await call("POST", `${s}/window`, { handle: (await call("GET", `${s}/window/handles`)).at(-1) });
  };
  // The first tab lets the helper fill storage (the wallpaper among it).
  await open();
  await sleep(5000);
  for (let i = 0; i < 5; i++) {
    await open();
    await sleep(2500);
    const t = await call("POST", `${s}/execute/sync`, {
      script: `const m = (n) => Math.round(performance.getEntriesByName(n)[0]?.startTime ?? -1);
        const fcp = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
        const slow = performance.getEntriesByType("resource").sort((a, b) => b.responseEnd - a.responseEnd).slice(0, 3).map((r) => r.name.split("/").pop() + " " + Math.round(r.responseEnd));
        return { html: Math.round(performance.getEntriesByType("navigation")[0]?.domInteractive ?? -1), start: m("ct-start"), state: m("ct-state"), mounted: m("ct-mounted"), wallpaper: m("ct-wallpaper"), fcp: Math.round(fcp?.startTime ?? -1), fonts: document.fonts.status, slow };`,
      args: [],
    });
    console.log(`tab ${i + 1}: script ran at ${t.start}ms, state at ${t.state}ms, mounted at ${t.mounted}ms, wallpaper at ${t.wallpaper}ms, first paint ${t.fcp}ms, fonts ${t.fonts}; last resources: ${t.slow.join(", ")}`);
  }
} finally {
  if (id) await call("DELETE", `/session/${id}`).catch(() => {});
  driver.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
