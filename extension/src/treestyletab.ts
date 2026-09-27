// Themes Tree Style Tab's sidebar through TST's API: an extension registers
// itself with a `style`, and TST adds that CSS to its sidebar. The sidebar is
// TST's own extension page, so the --caelestia-* variables pages get never
// reach it; the colours go in as hex, and the wallpaper as a small data: URL.
import type { Scheme } from "./types.ts";

const TST = "treestyletab@piro.sakura.ne.jp";

// settings.treeStyleTab when nothing's been saved. The same choices as the
// new tab's background: a colour tinted over a darkened surface, the
// wallpaper, or TST left alone.
export const TREE_STYLE_TAB = {
  source: "tint" as "tint" | "wallpaper" | "none",
  colour: "primary",
  strength: 14,
  dim: 45,
  blur: 0,
};

// Settings from before `source`: { tint: false } meant off.
export const tstOptions = (saved: any) => ({ ...TREE_STYLE_TAB, ...(saved?.tint === false && !saved.source ? { source: "none" } : {}), ...saved });

const hex = (scheme: Scheme, token: string) => (token.startsWith("#") ? token : `#${scheme.colours[token]}`);

// TST paints the sidebar with var(--browser-background, var(--tabbar-bg)),
// and sets --browser-background inline from the browser theme whenever there
// is one, so both are overridden. !important beats that inline value and the
// :root rules TST sets under several selectors of its own.
export function tstStyle(scheme: Scheme, opts: typeof TREE_STYLE_TAB, wallpaper: string | null) {
  const c = (name: string) => `#${scheme.colours[name]}`;
  // Darker than the surface in both modes, so the sidebar sits below the page:
  // towards the scheme's shadow, less in light mode, where it greys quickly.
  const base = `color-mix(in srgb, ${c("surface")}, ${c("shadow")} ${scheme.mode === "light" ? 12 : 40}%)`;
  const tint = hex(scheme, opts.colour);
  const mix = (n: number) => `color-mix(in srgb, ${tint} ${n}%, ${base})`;
  const text = `
  --tab-text-regular: ${c("onSurface")} !important;
  --tab-text-active: ${c("onSurface")} !important;
  --tab-border: ${c("outlineVariant")} !important;`;
  if (opts.source === "wallpaper" && wallpaper) {
    // The tab bar goes see-through over the wallpaper, dimmed towards the
    // scheme's background, and the tabs keep a tinted, translucent surface.
    const over = (n: number) => `color-mix(in srgb, ${tint} ${n}%, color-mix(in srgb, ${c("background")} 55%, transparent))`;
    return `:root {
  --browser-background: transparent !important;
  --tabbar-bg: transparent !important;
  --tab-like-surface: ${over(opts.strength)} !important;
  --tab-surface-active: ${over(Math.min(opts.strength * 3, 60))} !important;${text}
}
body {
  isolation: isolate;
  background: transparent !important;
}
body::before,
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}
body::before {
  background: url("${wallpaper}") center / cover no-repeat;
  filter: blur(${opts.blur}px);
  transform: scale(1.05);
}
body::after {
  background: ${c("background")};
  opacity: ${opts.dim / 100};
}`;
  }
  return `:root {
  --browser-background: ${mix(opts.strength)} !important;
  --tabbar-bg: ${mix(opts.strength)} !important;
  --tab-like-surface: ${mix(opts.strength + 6)} !important;
  --tab-surface-active: ${mix(Math.min(opts.strength * 3, 60))} !important;${text}
}`;
}

// The wallpaper scaled down for the sidebar: TST keeps the style in memory
// and in every sidebar, so a full-size image would be several MB each time.
export async function sidebarWallpaper(url: string) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  return new Promise<string>((done) => {
    const reader = new FileReader();
    reader.onload = () => done(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// Registers, or clears, the style. TST keeps a registered style until the
// next register-self, so turning it off sends an empty one. Resolves false
// when TST isn't there to answer (not installed, or not started yet).
export async function syncTreeStyleTab(scheme: Scheme | null, settings: any, wallpaper: string | null): Promise<boolean> {
  const opts = tstOptions(settings?.treeStyleTab);
  const style = scheme && opts.source !== "none" ? tstStyle(scheme, opts, wallpaper) : "";
  return browser.runtime
    .sendMessage(TST, { type: "register-self", name: "caelestia-tab", listeningTypes: ["ready", "sidebar-show"], style })
    .then(
      () => true,
      () => false,
    );
}

export const isTreeStyleTab = (sender: { id: string }) => sender.id === TST;
