// Tints Tree Style Tab's sidebar towards the scheme's primary, through TST's
// API: an extension registers itself with a `style`, and TST adds that CSS to
// its sidebar. The sidebar is TST's own extension page, so the --caelestia-*
// variables pages get never reach it; the colours go in as hex.
const TST = "treestyletab@piro.sakura.ne.jp";

// settings.treeStyleTab when nothing's been saved.
export const TREE_STYLE_TAB = { tint: true, strength: 14 };

// TST paints the sidebar with var(--browser-background, var(--tabbar-bg)),
// and sets --browser-background inline from the browser theme whenever there
// is one, so both are overridden. !important beats that inline value and the
// :root rules TST sets under several selectors of its own.
export function tstStyle(scheme, { strength }) {
  const c = (name) => `#${scheme.colours[name]}`;
  // Darker than the surface in both modes, so the sidebar sits below the page:
  // towards the scheme's shadow, less in light mode, where it greys quickly.
  const base = `color-mix(in srgb, ${c("surface")}, ${c("shadow")} ${scheme.mode === "light" ? 12 : 40}%)`;
  const mix = (n) => `color-mix(in srgb, ${c("primary")} ${n}%, ${base})`;
  return `:root {
  --browser-background: ${mix(strength)} !important;
  --tabbar-bg: ${mix(strength)} !important;
  --tab-like-surface: ${mix(strength + 6)} !important;
  --tab-surface-active: ${mix(Math.min(strength * 3, 60))} !important;
  --tab-text-regular: ${c("onSurface")} !important;
  --tab-text-active: ${c("onSurface")} !important;
  --tab-border: ${c("outlineVariant")} !important;
}`;
}

// Registers, or clears, the tint. TST keeps a registered style until the
// next register-self, so turning the tint off sends an empty one. Resolves
// false when TST isn't there to answer (not installed, or not started yet).
export async function syncTreeStyleTab(scheme, settings) {
  const opts = { ...TREE_STYLE_TAB, ...settings?.treeStyleTab };
  const style = scheme && opts.tint ? tstStyle(scheme, opts) : "";
  return browser.runtime
    .sendMessage(TST, { type: "register-self", name: "caelestia-tab", listeningTypes: ["ready", "sidebar-show"], style })
    .then(
      () => true,
      () => false,
    );
}

export const isTreeStyleTab = (sender) => sender.id === TST;
