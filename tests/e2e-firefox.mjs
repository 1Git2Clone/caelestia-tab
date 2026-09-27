// End to end in a real, headless Firefox: the helper, the new tab override, a
// live scheme switch and a themed site. Isolated from your own browser and
// caelestia: it runs under a throwaway HOME and XDG_STATE_HOME.
//
//   cargo build
//   nix shell nixpkgs#firefox nixpkgs#geckodriver -c node tests/e2e-firefox.mjs
//
// HELPER overrides the helper binary (default: cargo's debug build).
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const helper =
  process.env.HELPER ??
  path.join(JSON.parse(execFileSync("cargo", ["metadata", "--format-version=1", "--no-deps"], { cwd: root })).target_directory, "debug/caelestia-tab");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "caelestia-tab-e2e-"));
const state = path.join(tmp, "state/caelestia");
fs.mkdirSync(path.join(state, "wallpaper"), { recursive: true });
fs.mkdirSync(path.join(tmp, "home/.mozilla/native-messaging-hosts"), { recursive: true });

// A small scheme with every colour the site themes use, and a 1x1 wallpaper.
const names = "rosewater flamingo pink mauve red maroon peach yellow green teal sky sapphire blue lavender text subtext1 subtext0 overlay2 overlay1 overlay0 surface2 surface1 surface0 base mantle crust primary background".split(" ");
const scheme = { name: "e2e", flavour: "default", mode: "dark", variant: "tonalspot", colours: Object.fromEntries(names.map((n) => [n, "334455"])) };
scheme.colours.primary = "d3beea";
const schemeFile = path.join(state, "scheme.json");
fs.writeFileSync(schemeFile, JSON.stringify(scheme));
const wall = path.join(tmp, "wall.png");
fs.writeFileSync(wall, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
fs.writeFileSync(path.join(state, "wallpaper/path.txt"), wall);
fs.writeFileSync(path.join(tmp, "home/.mozilla/native-messaging-hosts/caelestia_tab.json"), execFileSync(helper, ["manifest"]));

// InvokeAI's style matches http://127.0.0.1:9090/, so a local page there
// stands in for a themed site. (Not syncthing's 8384: a real Syncthing may be
// listening there.)
const site = http.createServer((_, res) => res.end("<!doctype html><title>site</title><h1>site</h1>")).listen(9090, "127.0.0.1");

const PORT = 4455;
const W = `http://127.0.0.1:${PORT}`;
// A geckodriver left over from an interrupted run would answer instead, with
// its own HOME and state, and the test would watch the wrong files.
if (await fetch(`${W}/status`).then(() => true, () => false)) throw new Error(`something already listens on ${PORT}`);
// --allow-system-access lets the test open a real new tab from the browser
// chrome; WebDriver refuses to navigate to moz-extension:// URLs itself.
const driver = spawn("geckodriver", ["--allow-system-access", "--port", String(PORT)], {
  env: { ...process.env, HOME: path.join(tmp, "home"), XDG_STATE_HOME: path.join(tmp, "state") },
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
  const js = (body) =>
    call("POST", `${s}/execute/async`, {
      script: `const done = arguments[arguments.length - 1]; (async () => { ${body} })().then(done, (e) => done("ERR " + e));`,
      args: [],
    });
  const primary = () => js(`return getComputedStyle(document.documentElement).getPropertyValue("--caelestia-primary")`);

  await call("POST", `${s}/moz/addon/install`, { path: path.join(root, "extension/dist"), temporary: true });
  await call("POST", `${s}/moz/context`, { context: "chrome" });
  await call("POST", `${s}/execute/sync`, { script: "BrowserCommands.openTab();", args: [] });
  await call("POST", `${s}/moz/context`, { context: "content" });
  await call("POST", `${s}/window`, { handle: (await call("GET", `${s}/window/handles`)).at(-1) });
  await sleep(3000);

  assert.match(await call("GET", `${s}/url`), /^moz-extension:\/\/.*\/newtab\.html$/, "the new tab is ours");
  const stored = JSON.parse(await js(`const s = await browser.storage.local.get(null); return JSON.stringify({ name: s.scheme?.name, wallpaper: s.wallpaper?.url?.slice(0, 22), error: s.helperError })`));
  assert.deepEqual(stored, { name: "e2e", wallpaper: "data:image/png;base64,", error: null }, "the helper's scheme and wallpaper arrived");
  assert.equal(await primary(), "#d3beea");

  // caelestia replaces the file by renaming a new one over it.
  scheme.colours.primary = "ff3355";
  fs.writeFileSync(`${schemeFile}.tmp`, JSON.stringify(scheme));
  fs.renameSync(`${schemeFile}.tmp`, schemeFile);
  await sleep(1500);
  assert.equal(await primary(), "#ff3355", "the new tab followed the switch live");

  // Settings are kept in a file by the helper too, both ways: a change here
  // is saved to it, and a hand edit of it reaches the new tab.
  const saved = path.join(tmp, "home/.config/caelestia-tab/settings.json");
  await js(`const { settings } = await browser.storage.local.get("settings"); await browser.storage.local.set({ settings: { ...settings, font: "E2E Sans" } });`);
  await sleep(2500);
  assert.equal(JSON.parse(fs.readFileSync(saved, "utf8")).font, "E2E Sans", "a settings change is saved to the file");
  const edited = { ...JSON.parse(fs.readFileSync(saved, "utf8")), font: "Hand Edited" };
  fs.writeFileSync(`${saved}.tmp`, JSON.stringify(edited));
  fs.renameSync(`${saved}.tmp`, saved);
  await sleep(1500);
  assert.equal(await js(`return (await browser.storage.local.get("settings")).settings.font`), "Hand Edited", "a hand edit of the file reaches the extension");

  await call("POST", `${s}/url`, { url: "http://127.0.0.1:9090/" });
  await sleep(2500);
  assert.equal(await primary(), "#ff3355", "the page got the variables");
  // What catppuccin's lib adds to every style: color-scheme from the flavour,
  // and a selection tinted with the accent. (InvokeAI's own rules nest :root
  // inside :root upstream and never match, so they can't be checked here.)
  assert.equal(await js(`return getComputedStyle(document.documentElement).colorScheme`), "dark", "the style compiled for the scheme's mode");
  assert.equal(
    await js(`return getComputedStyle(document.body, "::selection").backgroundColor`),
    "rgba(255, 51, 85, 0.3)",
    "the style's accent is the scheme's primary",
  );
  console.log("e2e: ok");
} finally {
  if (id) await call("DELETE", `/session/${id}`).catch(() => {});
  driver.kill();
  site.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
