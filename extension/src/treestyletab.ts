// Themes Tree Style Tab's sidebar through TST's API: an extension registers
// itself with a `style`, and TST adds that CSS to its sidebar. The sidebar is
// TST's own extension page, so the --caelestia-* variables pages get never
// reach it; the colours go in as hex, and the wallpaper as a small data: URL.
import type { Scheme } from "./types.ts";

const TST = "treestyletab@piro.sakura.ne.jp";

// settings.treeStyleTab when nothing's been saved: the same choices as the
// new tab's background. A colour is dimmed towards the darkened surface, so
// dim 86 is a light tint; the wallpaper is dimmed towards the scheme's
// background, blurred and moved off centre (x and y, -100 to 100); none
// leaves TST alone.
export const TREE_STYLE_TAB = {
  source: "wallpaper" as "colour" | "wallpaper" | "none",
  colour: "surfaceContainerHighest",
  dim: 50,
  blur: 7,
  x: -50,
  y: 0,
};

// Earlier settings: { tint: false } meant off, and a "tint" source had a
// `strength`, the colour's share, which is 100 minus the dim.
export function tstOptions(saved: any): typeof TREE_STYLE_TAB {
  if (!saved) return { ...TREE_STYLE_TAB };
  const { tint, strength, ...rest } = saved;
  const old = saved.source === "tint" || (!saved.source && strength != null);
  return {
    ...TREE_STYLE_TAB,
    ...rest,
    ...(tint === false && !saved.source ? { source: "none" } : {}),
    ...(old ? { source: "colour", dim: 100 - (strength ?? 14) } : {}),
  };
}

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
  // The colour's share: what the dim leaves of it.
  const share = 100 - opts.dim;
  const text = `
  --tab-text-regular: ${c("onSurface")} !important;
  --tab-text-active: ${c("onSurface")} !important;
  --tab-border: ${c("outlineVariant")} !important;`;
  if (opts.source === "wallpaper" && wallpaper) {
    // The tab bar goes see-through over the wallpaper, dimmed towards the
    // scheme's background, and the tabs keep a translucent tint of the colour.
    const over = (n: number) => `color-mix(in srgb, ${tint} ${n}%, color-mix(in srgb, ${c("background")} 55%, transparent))`;
    return `:root {
  --browser-background: transparent !important;
  --tabbar-bg: transparent !important;
  --tab-like-surface: ${over(14)} !important;
  --tab-surface-active: ${over(42)} !important;${text}
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
  /* An offset of -100 lines the wallpaper's left or top edge up with the
     sidebar's and 100 its right or bottom: covering, it never leaves a gap. */
  background: url("${wallpaper}") ${50 + opts.x / 2}% ${50 + opts.y / 2}% / cover no-repeat;
  filter: blur(${opts.blur}px);
  transform: scale(1.05);
}
body::after {
  background: ${c("background")};
  opacity: ${opts.dim / 100};
}`;
  }
  return `:root {
  --browser-background: ${mix(share)} !important;
  --tabbar-bg: ${mix(share)} !important;
  --tab-like-surface: ${mix(Math.min(share + 6, 100))} !important;
  --tab-surface-active: ${mix(Math.min(share * 3, 60))} !important;${text}
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
