// Talks to the helper and themes web pages.
//
// The helper's messages go straight into storage.local, which the new tab and
// the content scripts watch, so none of them depend on this page staying
// awake. The only other state here is a cache of compiled styles.
import "./vendor/less.min.js";
import { cssVars } from "./scheme.js";
import { SITES, compile, cssFor, libFor, matches } from "./userstyles.js";

const store = browser.storage.local;

let helper = null;

function connectHelper() {
  if (helper) return;
  helper = browser.runtime.connectNative("caelestia_tab");
  let parts = [];
  helper.onMessage.addListener((msg) => {
    // Messages over the browser's 1 MiB cap arrive in order, as parts.
    if ("part" in msg) {
      parts.push(msg.data);
      if (parts.length < msg.parts) return;
      msg = JSON.parse(parts.join(""));
      parts = [];
    }
    store.set({ [msg.topic]: msg.value, helperError: null });
  });
  helper.onDisconnect.addListener((port) => {
    // Set when the helper isn't registered or died; the new tab shows it.
    if (port.error) store.set({ helperError: port.error.message });
    helper = null;
  });
}

connectHelper();
// An open new tab holds a port to this page, which keeps it (and so the
// helper) running while there's a tab to update live.
browser.runtime.onConnect.addListener(connectHelper);

const index = fetch("userstyles/index.json").then((r) => r.json());
const lib = fetch("userstyles/lib.less").then((r) => r.text());
// id -> { key, css: Promise<string> }, recompiled when the scheme changes.
const compiled = new Map();

async function themeFor(url) {
  const { scheme, settings } = await store.get(["scheme", "settings"]);
  if (!scheme) return "";
  const sites = { ...SITES, ...settings?.sites };
  let css = cssVars(scheme);
  if (!sites.enabled) return css;
  const key = JSON.stringify([scheme.mode, scheme.colours, sites.accent]);
  for (const style of (await index).styles) {
    if (sites.off.includes(style.id) || !matches(style.matches, url)) continue;
    let hit = compiled.get(style.id);
    if (hit?.key !== key) {
      const source = fetch(`userstyles/${style.id}.less`).then((r) => r.text());
      hit = {
        key,
        css: source.then(async (s) => compile(less, libFor(await lib, scheme, sites.accent), s, style.vars, scheme.mode)),
      };
      compiled.set(style.id, hit);
    }
    try {
      css += `\n${cssFor(await hit.css, url)}`;
    } catch (e) {
      console.warn(`caelestia-tab: ${style.id}:`, e.message ?? e);
    }
  }
  return css;
}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "theme") return;
  return (async () => {
    const css = await themeFor(msg.url);
    if (css === msg.applied) return css;
    // insertCSS rather than a <style> from the content script: it isn't
    // subject to the page's Content-Security-Policy.
    const target = { tabId: sender.tab.id, frameIds: [sender.frameId] };
    if (msg.applied) await browser.scripting.removeCSS({ target, css: msg.applied }).catch(() => {});
    if (css) await browser.scripting.insertCSS({ target, css });
    return css;
  })();
});
