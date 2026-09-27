// Every vendored site style, in a real headless Firefox with the extension:
// loads a page each style matches and reports whether the page's background
// became a scheme colour. Slow (the real sites, over the network) and logged
// out, so it's a manual check, not part of the hooks.
//
//   cargo build
//   nix shell nixpkgs#firefox nixpkgs#geckodriver -c node tests/sites-firefox.mjs [id…]
//
// A site that's themed only when logged in, or only on some pages, shows up
// as "unthemed"; look at those by hand before calling them broken.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const helper =
  process.env.HELPER ??
  path.join(JSON.parse(execFileSync("cargo", ["metadata", "--format-version=1", "--no-deps"], { cwd: root })).target_directory, "debug/caelestia-tab");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "caelestia-tab-sites-"));
const state = path.join(tmp, "state/caelestia");
fs.mkdirSync(state, { recursive: true });
fs.mkdirSync(path.join(tmp, "home/.mozilla/native-messaging-hosts"), { recursive: true });
fs.writeFileSync(path.join(tmp, "home/.mozilla/native-messaging-hosts/caelestia_tab.json"), execFileSync(helper, ["manifest"]));

// Every colour distinct and unlike any site's own, so a background that
// matches one can only have come from the scheme.
const { styles } = JSON.parse(fs.readFileSync(path.join(root, "extension/public/userstyles/index.json"), "utf8"));
const lib = fs.readFileSync(path.join(root, "extension/public/userstyles/lib.less"), "utf8");
// caelestia's Material colours as well as the catppuccin names, for the
// site overrides that use var(--caelestia-*) directly.
const MATERIAL = "primary onPrimary primaryContainer onPrimaryContainer secondary onSecondary tertiary background onBackground surface onSurface surfaceVariant onSurfaceVariant surfaceDim surfaceBright surfaceContainerLowest surfaceContainerLow surfaceContainer surfaceContainerHigh surfaceContainerHighest outline outlineVariant shadow".split(" ");
const names = [...new Set([...[...lib.matchAll(/@(\w+): #[0-9a-f]{6}/g)].map((m) => m[1]), ...MATERIAL])];
const colours = Object.fromEntries(names.map((n, i) => [n, `${(0x20 + i).toString(16)}${(0x10 + i).toString(16)}3${i % 10}`]));
fs.writeFileSync(path.join(state, "scheme.json"), JSON.stringify({ name: "sites", flavour: "default", mode: "dark", variant: "tonalspot", colours }));
const scheme = new Set(Object.values(colours).map((h) => `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`));

// Regexp rules have no URL to read off; these are pages they match.
const REGEXP = {
  crowdin: "https://crowdin.com/",
  deepl: "https://www.deepl.com/en/translator",
  desmos: "https://www.desmos.com/calculator",
  github: "https://github.com/catppuccin/userstyles",
  google: "https://www.google.com/",
  pinterest: "https://www.pinterest.com/",
  proton: "https://account.proton.me/login",
  "status.cafe": "https://status.cafe/",
};
const urlFor = (s) => {
  const m = s.matches[0];
  if (m.type === "regexp") return REGEXP[s.id];
  return m.type === "domain" ? `https://${m.value}/` : m.value;
};

const only = process.argv.slice(2);
// Self-hosted apps (placeholder domains, local addresses) and extension pages
// have no public page to load.
const todo = styles
  .filter((s) => (only.length ? only.includes(s.id) : true))
  .map((s) => [s.id, urlFor(s)])
  .filter(([, u]) => u?.startsWith("https://") && !/example\.com|127\.0\.0\.1|localhost/.test(u));

const PORT = 4456;
const W = `http://127.0.0.1:${PORT}`;
if (await fetch(`${W}/status`).then(() => true, () => false)) throw new Error(`something already listens on ${PORT}`);
const driver = spawn("geckodriver", ["--port", String(PORT)], {
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

// The page's own backgrounds, <html> and <body>, and the colour behind the
// middle of the viewport (the first opaque one walking up from the element
// there). Any of them being a scheme colour counts: a consent dialog or a hero
// image in the middle shouldn't fail a themed page.
const PROBE = `
  const opaque = (bg) => bg && bg !== "transparent" && !/^rgba\\(.*, 0\\)$/.test(bg);
  const out = [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor];
  for (let el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (opaque(bg)) { out.push(bg); break; }
  }
  return out;`;

let id;
const bad = [];
try {
  ({ sessionId: id } = await call("POST", "/session", {
    capabilities: { alwaysMatch: { pageLoadStrategy: "eager", timeouts: { pageLoad: 20000 }, "moz:firefoxOptions": { args: ["-headless"], prefs: { "extensions.webextensions.restrictedDomains": "" } } } },
  }));
  const s = `/session/${id}`;
  await call("POST", `${s}/moz/addon/install`, { path: path.join(root, "extension/dist"), temporary: true });
  // Site themes need <all_urls>, which a temporary add-on is granted.
  await sleep(3000);
  for (const [style, url] of todo) {
    let result;
    try {
      await call("POST", `${s}/url`, { url });
      await sleep(3500);
      const bg = await call("POST", `${s}/execute/sync`, { script: PROBE, args: [] });
      // A redirect (a consent page, a login, another domain) usually lands
      // somewhere the style doesn't cover; say where.
      const at = await call("GET", `${s}/url`);
      result = bg.some((c) => scheme.has(c)) ? "themed" : `unthemed (${bg.join(", ")})${new URL(at).host !== new URL(url).host ? ` at ${at.slice(0, 60)}` : ""}`;
    } catch (e) {
      result = `error (${e.message.split("\n")[0].slice(0, 80)})`;
    }
    if (result !== "themed") bad.push(style);
    console.log(`${result === "themed" ? "ok  " : "FAIL"} ${style.padEnd(22)} ${url}  ${result === "themed" ? "" : result}`);
  }
  console.log(`\n${todo.length - bad.length}/${todo.length} themed${bad.length ? `; check by hand: ${bad.join(" ")}` : ""}`);
} finally {
  if (id) await call("DELETE", `/session/${id}`).catch(() => {});
  driver.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
