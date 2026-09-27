// Talks to the helper and themes web pages.
//
// The helper's messages go straight into storage.local, which the new tab and
// the content scripts watch, so none of them depend on this page staying
// awake. The only other state here is a cache of compiled styles.
import { stable } from "./json.ts";
import { cssVars } from "./scheme.ts";
import { isTreeStyleTab, sidebarWallpaper, syncTreeStyleTab, tstOptions } from "./treestyletab.ts";
import { SITES, compile, cssFor, libFor, matches } from "./userstyles.ts";

const store = browser.storage.local;

// less.js is loaded as a classic script before this one (manifest.json).
declare const less: any;

let helper: any = null;

function connectHelper() {
  if (helper) return;
  helper = browser.runtime.connectNative("caelestia_tab");
  let parts: string[] = [];
  helper.onMessage.addListener((msg: any) => {
    // Messages over the browser's 1 MiB cap arrive in order, as parts.
    if ("part" in msg) {
      parts.push(msg.data);
      if (parts.length < msg.parts) return;
      msg = JSON.parse(parts.join(""));
      parts = [];
    }
    // The settings file is compared, not stored: see restore().
    if (msg.topic === "savedSettings") restore(msg.value);
    else store.set({ [msg.topic]: msg.value, helperError: null });
  });
  helper.onDisconnect.addListener((port: any) => {
    // Set when the helper isn't registered or died; the new tab shows it.
    if (port.error) store.set({ helperError: port.error.message });
    helper = null;
  });
}

connectHelper();
// Commands for the helper's plugins, from the new tab's widgets:
// { type: "helper", message: { topic, command, … } }.
browser.runtime.onMessage.addListener((msg: any) => {
  if (msg?.type !== "helper") return;
  connectHelper();
  helper.postMessage(msg.message);
});
// An open new tab holds a port to this page, which keeps it (and so the
// helper) running while there's a tab to update live.
browser.runtime.onConnect.addListener(connectHelper);

// The settings, kept in a file by the helper as well (src/plugins/settings.rs):
// storage.local goes when a temporary add-on is removed, which a browser
// restart does, and a file can live in someone's dotfiles. Every change is
// saved a moment after it's made; the file wins when storage has no settings
// (a fresh install, a restart) or when it changed after the last change here
// (edited by hand), so an older file never rolls back newer edits.
let saving: ReturnType<typeof setTimeout> | undefined;
store.onChanged.addListener((changes: any) => {
  if (!changes.settings) return;
  store.set({ settingsChangedAt: Date.now() });
  clearTimeout(saving);
  saving = setTimeout(async () => {
    const { settings } = await store.get("settings");
    if (!settings) return;
    connectHelper();
    helper.postMessage({ topic: "savedSettings", command: "save", settings });
  }, 1000);
});
async function restore(saved: { settings: any; mtime?: number } | null) {
  const { settings, settingsChangedAt = 0 } = await store.get(["settings", "settingsChangedAt"]);
  // No file yet, but settings here (from before the helper kept one): save
  // them now rather than at the next change.
  if (!saved?.settings) {
    if (settings) helper?.postMessage({ topic: "savedSettings", command: "save", settings });
    return;
  }
  if (settings && (saved.mtime ?? 0) <= settingsChangedAt) return;
  if (stable(settings) === stable(saved.settings)) return;
  store.set({ settings: saved.settings });
}

// Tree Style Tab: re-send the tint on every scheme or settings change, and
// when TST (re)starts or opens a sidebar.
let tstSent: string | null = null;
// The sidebar's copy of the wallpaper, scaled down once per wallpaper.
let small: { url: string; data: Promise<string> } | null = null;
async function syncTst(force = false) {
  const { scheme, settings, wallpaper } = await store.get(["scheme", "settings", "wallpaper"]);
  const opts = tstOptions(settings?.treeStyleTab);
  const url = opts.source === "wallpaper" ? (wallpaper?.url ?? null) : null;
  // Settings change on every keystroke in the new tab's forms; only a change
  // to what TST would get is worth a message.
  const key = JSON.stringify([scheme?.colours, opts, url?.length, url?.slice(-64)]);
  if (!force && key === tstSent) return;
  tstSent = key;
  if (url && small?.url !== url) small = { url, data: sidebarWallpaper(url).catch(() => "") };
  const data = url ? (await small!.data) || null : null;
  if (!(await syncTreeStyleTab(scheme, settings, data))) tstSent = null;
}
// TST only sends `ready` to extensions it already knows, so the first
// registration can't wait for it. When both start with the browser, TST may
// not be listening yet: retry for a minute, then leave it to the next change.
//
// A sidebar that is still starting also loses a registration: it replaces its
// list of extensions with a snapshot it asked TST for, and a registration that
// landed in between isn't in it (TST's initAsFrontend, 2026-09-27). So once
// registered, send again a little later.
// ponytail: one fixed 5s re-send; a sidebar slower than that to start stays
// untinted until the next scheme or settings change.
(async () => {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  for (let i = 0; i < 20 && tstSent === null; i++) {
    await syncTst();
    if (tstSent === null) await sleep(3000);
  }
  if (tstSent !== null) {
    await sleep(5000);
    await syncTst(true);
  }
})();
store.onChanged.addListener((changes: any) => {
  if (changes.scheme || changes.settings || changes.wallpaper) syncTst();
});
// Re-send when a sidebar opens, too: a new window's sidebar starts with the
// same race.
browser.runtime.onMessageExternal.addListener((msg: any, sender: any) => {
  if (isTreeStyleTab(sender) && (msg?.type === "ready" || msg?.type === "sidebar-show")) syncTst(true);
});

const index = fetch("/userstyles/index.json").then((r) => r.json());
const lib = fetch("/userstyles/lib.less").then((r) => r.text());
// id -> { key, css: Promise<string> }, recompiled when the scheme changes.
const compiled = new Map<string, { key: string; css: Promise<string> }>();

async function themeFor(url: string, detected: string[] | undefined) {
  const { scheme, settings } = await store.get(["scheme", "settings"]);
  if (!scheme) return "";
  const sites = { ...SITES, ...settings?.sites };
  let css = cssVars(scheme);
  if (!sites.enabled) return css;
  const key = JSON.stringify([scheme.mode, scheme.colours, sites.accent]);
  for (const style of (await index).styles) {
    // The user's override: more domains, pages matching a selector, their CSS.
    const own = sites.overrides?.[style.id] ?? {};
    const domains = (own.domains ?? "").split(/\s+/).filter(Boolean).map((value: string) => ({ type: "domain", value }));
    const anywhere = (own.when && detected?.includes(style.id)) || matches(domains, url);
    if (sites.off.includes(style.id) || !(anywhere || matches(style.matches, url))) continue;
    let hit = compiled.get(style.id);
    if (hit?.key !== key) {
      const source = fetch(`/userstyles/${style.id}.less`).then((r) => r.text());
      hit = {
        key,
        css: source.then(async (s) => compile(less, libFor(await lib, scheme, sites.accent), s, style.vars, scheme.mode)),
      };
      compiled.set(style.id, hit);
    }
    try {
      css += `\n${cssFor(await hit.css, url, anywhere)}`;
    } catch (e) {
      console.warn(`caelestia-tab: ${style.id}:`, (e as Error).message ?? e);
    }
    if (own.css) css += `\n${own.css}`;
  }
  return css;
}

browser.runtime.onMessage.addListener((msg: any, sender: any) => {
  if (msg.type !== "theme") return;
  return (async () => {
    const css = await themeFor(msg.url, msg.detected);
    if (css === msg.applied) return css;
    // insertCSS rather than a <style> from the content script: it isn't
    // subject to the page's Content-Security-Policy.
    const target = { tabId: sender.tab.id, frameIds: [sender.frameId] };
    if (msg.applied) await browser.scripting.removeCSS({ target, css: msg.applied }).catch(() => {});
    if (css) await browser.scripting.insertCSS({ target, css });
    return css;
  })();
});
