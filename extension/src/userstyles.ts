// Compiles the vendored catppuccin userstyles against the live caelestia
// scheme, and picks out the parts of a compiled style that apply to a URL.
// Shared by background.ts and scripts/vendor-userstyles.mjs.
import type { Scheme } from "./types.ts";

export interface Rule {
  type: string;
  value: string;
}

// The catppuccin palette. caelestia's scheme carries every one of these names.
const NAMES = [
  "rosewater", "flamingo", "pink", "mauve", "red", "maroon", "peach", "yellow",
  "green", "teal", "sky", "sapphire", "blue", "lavender", "text", "subtext1",
  "subtext0", "overlay2", "overlay1", "overlay0", "surface2", "surface1",
  "surface0", "base", "mantle", "crust",
];

// settings.sites when nothing's been saved: every style on, accented with the
// scheme's primary.
export interface Override {
  domains?: string;
  when?: string;
  css?: string;
}
// `custom`: sites of the user's own, with no vendored style: each is its
// name, and its domains, selector and CSS are an override like any other's.
export const SITES = {
  enabled: true,
  off: [] as string[],
  accent: "primary",
  overrides: {
    codeberg: { css: "", domains: "", when: "" },
    "custom-44f18919-3b08-4c80-95f1-1127045dff85": {
      css: ":root {\n  /* Core */\n  --color-body: var(--caelestia-background) !important;\n  --color-footer: var(--caelestia-surface-container) !important;\n  --color-text: var(--caelestia-on-surface) !important;\n  --color-text-light: var(--caelestia-on-surface-variant) !important;\n  --color-text-dark: var(--caelestia-on-surface) !important;\n\n  /* Links */\n  --color-link: var(--caelestia-primary) !important;\n  --color-link-hover: var(--caelestia-primary) !important;\n\n  /* Borders */\n  --color-secondary: var(--caelestia-surface-container) !important;\n  --color-light-border: var(--caelestia-outline-variant) !important;\n  --color-light-border-hover: var(--caelestia-outline) !important;\n  --color-border: var(--caelestia-outline-variant) !important;\n\n  /* Navigation */\n  --color-nav-bg: var(--caelestia-surface-container) !important;\n  --color-nav-text: var(--caelestia-on-surface) !important;\n  --color-nav-hover-bg: var(--caelestia-surface-container-high) !important;\n\n  /* Secondary navigation */\n  --color-secondary-nav-bg: var(--caelestia-surface-container-low) !important;\n\n  /* Inputs / controls */\n  --color-input-background: var(--caelestia-surface-container-low) !important;\n  --color-input-border: var(--caelestia-outline-variant) !important;\n  --color-input-placeholder: var(--caelestia-on-surface-variant) !important;\n\n  /* Buttons */\n  --color-button: var(--caelestia-surface-container) !important;\n  --color-button-hover: var(--caelestia-surface-container-high) !important;\n  --color-button-text: var(--caelestia-on-surface) !important;\n\n  /* Primary */\n  --color-primary: var(--caelestia-primary) !important;\n  --color-primary-dark-1: var(--caelestia-primary) !important;\n  --color-primary-dark-2: var(--caelestia-primary) !important;\n  --color-primary-light-1: var(--caelestia-primary-container) !important;\n  --color-primary-light-2: var(--caelestia-primary-container) !important;\n  --color-primary-light-3: var(--caelestia-primary-container) !important;\n\n  /* Success */\n  --color-green: var(--caelestia-secondary) !important;\n\n  /* Warnings */\n  --color-yellow: var(--caelestia-tertiary) !important;\n  --color-orange: var(--caelestia-tertiary) !important;\n\n  /* Errors */\n  --color-red: var(--caelestia-error) !important;\n  --color-error: var(--caelestia-error) !important;\n\n  /* Code */\n  --color-code-bg: var(--caelestia-surface-container) !important;\n  --color-code-border: var(--caelestia-outline-variant) !important;\n\n  /* Cards / panels */\n  --color-box-header: var(--caelestia-surface-container-high) !important;\n  --color-box-body: var(--caelestia-surface-container) !important;\n\n  /* Selection */\n  --color-markup-table-row: var(--caelestia-surface-container-low) !important;\n  --color-markup-code-block: var(--caelestia-surface-container) !important;\n\n  /* Footer */\n  --color-footer-text: var(--caelestia-on-surface-variant) !important;\n\n  /* Shadows */\n  --color-shadow: var(--caelestia-shadow) !important;\n}\n\n/* Main page */\nbody {\n  color: var(--caelestia-on-surface) !important;\n  background: var(--caelestia-background) !important;\n}\n\n/* Navigation */\n#navbar {\n  background: var(--caelestia-surface-container) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\n#navbar a,\n#navbar button,\n#navbar details > summary {\n  color: var(--caelestia-on-surface) !important;\n}\n\n#navbar a:hover,\n#navbar button:hover,\n#navbar details > summary:hover {\n  background: var(--caelestia-surface-container-high) !important;\n}\n\n/* Links */\na {\n  color: var(--caelestia-primary) !important;\n}\n\na:hover {\n  color: var(--caelestia-primary) !important;\n}\n\n/* Main content boxes */\n.ui.segment,\n.ui.segments,\n.ui.menu,\n.ui.card,\n.ui.cards > .card {\n  background: var(--caelestia-surface-container) !important;\n  color: var(--caelestia-on-surface) !important;\n  border-color: var(--caelestia-outline-variant) !important;\n}\n\n/* Inputs */\ninput,\ntextarea,\nselect,\n.ui.input > input {\n  background: var(--caelestia-surface-container-low) !important;\n  color: var(--caelestia-on-surface) !important;\n  border-color: var(--caelestia-outline-variant) !important;\n}\n\ninput:focus,\ntextarea:focus,\nselect:focus {\n  border-color: var(--caelestia-primary) !important;\n}\n\n/* Code */\npre,\ncode,\n.highlight,\n.ui.code {\n  background: var(--caelestia-surface-container) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\n/* Tables */\ntable {\n  color: var(--caelestia-on-surface) !important;\n}\n\ntable th {\n  background: var(--caelestia-surface-container-high) !important;\n  border-color: var(--caelestia-outline-variant) !important;\n}\n\ntable td {\n  border-color: var(--caelestia-outline-variant) !important;\n}\n\ntable tr:nth-child(even) {\n  background: var(--caelestia-surface-container-low) !important;\n}\n\n/* Footer */\nfooter {\n  background: var(--caelestia-surface-container) !important;\n  color: var(--caelestia-on-surface-variant) !important;\n}\n\n/* Labels */\n.ui.label {\n  background: var(--caelestia-surface-container-high) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\n/* Primary buttons */\n.ui.primary.button,\n.ui.primary.buttons .button {\n  background: var(--caelestia-primary) !important;\n  color: var(--caelestia-on-primary) !important;\n}\n\n.ui.primary.button:hover,\n.ui.primary.buttons .button:hover {\n  background: var(--caelestia-primary-container) !important;\n  color: var(--caelestia-on-primary-container) !important;\n}",
      domains: "code.forgejo.org\ngit.hu-tao.dev",
      when: "",
    },
    "custom-d1925e53-f4e8-4ebd-a317-5c2464110178": {
      css: "/* ============================================================\n   CAELESTIA × NAVIDROME\n   ============================================================ */\n\n\n/* ============================================================\n   GLOBAL\n   ============================================================ */\n\nhtml,\nbody,\n#root {\n  background: var(--caelestia-background) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\n#main-content {\n  background: var(--caelestia-background) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\n\n/* ============================================================\n   NAVIDROME / MUI SURFACES\n   ============================================================ */\n\n.MuiPaper-root {\n  background-color: var(--caelestia-surface-container) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\n.MuiAppBar-root {\n  background-color: var(--caelestia-surface-container) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\n.MuiDrawer-paper {\n  background-color: var(--caelestia-surface-container) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\ndiv .jss67 {\n  background-color: var(--caelestia-background);\n}\n\n/* ============================================================\n   TEXT\n   ============================================================ */\n\n.MuiTypography-root {\n  color: var(--caelestia-on-surface) !important;\n}\n\n\n/* ============================================================\n   INPUTS / SELECTS\n   ============================================================ */\n\n.MuiInputBase-root {\n  color: var(--caelestia-on-surface) !important;\n  background-color: var(--caelestia-surface-container) !important;\n}\n\n.MuiInputBase-input {\n  color: var(--caelestia-on-surface) !important;\n}\n\n.MuiInputLabel-root {\n  color: var(--caelestia-on-surface-variant) !important;\n}\n\n.MuiOutlinedInput-notchedOutline {\n  border-color: var(--caelestia-outline-variant) !important;\n}\n\n.Mui-focused .MuiOutlinedInput-notchedOutline {\n  border-color: var(--caelestia-primary) !important;\n}\n\n.MuiInputLabel-root.Mui-focused {\n  color: var(--caelestia-primary) !important;\n}\n\n.MuiSelect-icon {\n  color: var(--caelestia-on-surface-variant) !important;\n}\n\n\n/* ============================================================\n   MENUS\n   ============================================================ */\n\n.MuiMenu-paper,\n.MuiPopover-paper {\n  background-color: var(--caelestia-surface-container) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\n.MuiMenuItem-root {\n  color: var(--caelestia-on-surface) !important;\n}\n\n.MuiMenuItem-root:hover,\n.MuiMenuItem-root.Mui-selected {\n  background-color: var(--caelestia-surface-container-high) !important;\n}\n\n.MuiMenuItem-root.Mui-selected:hover {\n  background-color: var(--caelestia-surface-container-highest) !important;\n}\n\n\n/* ============================================================\n   BUTTONS / ICONS\n   ============================================================ */\n\n.MuiButton-root {\n  color: var(--caelestia-primary) !important;\n}\n\n.MuiButton-contained {\n  background-color: var(--caelestia-primary) !important;\n  color: var(--caelestia-on-primary) !important;\n}\n\n.MuiButton-contained:hover {\n  background-color: var(--caelestia-primary-container) !important;\n}\n\n.MuiIconButton-root {\n  color: var(--caelestia-on-surface) !important;\n}\n\n.MuiIconButton-root:hover {\n  background-color: var(--caelestia-surface-container-high) !important;\n}\n\n\n/* ============================================================\n   LINKS\n   ============================================================ */\n\na {\n  color: var(--caelestia-primary) !important;\n}\n\n\n/* ============================================================\n   DIVIDERS\n   ============================================================ */\n\n.MuiDivider-root {\n  border-color: var(--caelestia-outline-variant) !important;\n}\n\n\n/* ============================================================\n   SWITCHES\n   ============================================================ */\n\n.MuiSwitch-track {\n  background-color: var(--caelestia-outline) !important;\n  opacity: 1 !important;\n}\n\n.MuiSwitch-switchBase {\n  color: var(--caelestia-on-surface-variant) !important;\n}\n\n.MuiSwitch-switchBase.Mui-checked {\n  color: var(--caelestia-primary) !important;\n}\n\n.MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track {\n  background-color: var(--caelestia-primary) !important;\n  opacity: 0.55 !important;\n}\n\n.MuiSwitch-switchBase.Mui-disabled {\n  color: var(--caelestia-on-surface-variant) !important;\n}\n\n.MuiSwitch-switchBase.Mui-disabled + .MuiSwitch-track {\n  background-color: var(--caelestia-outline-variant) !important;\n  opacity: 1 !important;\n}\n\n.MuiTableCell-head {\n  background:var(--caelestia-surface-container-high)!important\n}\n\n.MuiTableCell-root {\n  border-bottom: 1px solid color-mix(in srgb, var(--caelestia-secondary) 25%, transparent) !important;\n}\n\n/* ============================================================\n   NAVIDROME RC-SLIDER\n   This is what Navidrome's music player actually uses.\n   ============================================================ */\n\n.rc-slider-rail {\n  background-color: var(--caelestia-outline) !important;\n}\n\n.rc-slider-track {\n  background-color: var(--caelestia-primary) !important;\n}\n\n.rc-slider-handle {\n  background-color: var(--caelestia-primary) !important;\n  border-color: var(--caelestia-primary) !important;\n  box-shadow: none !important;\n}\n\n.rc-slider-handle:hover,\n.rc-slider-handle:focus,\n.rc-slider-handle:active {\n  border-color: var(--caelestia-primary) !important;\n  box-shadow:\n    0 0 0 5px color-mix(\n      in srgb,\n      var(--caelestia-primary) 20%,\n      transparent\n    ) !important;\n}\n\n\n/* ============================================================\n   PLAYER\n   Only target Navidrome's actual player classes.\n   ============================================================ */\n\n.react-jinke-music-player-main {\n  color: var(--caelestia-on-surface) !important;\n}\n\n.react-jinke-music-player-main .rc-slider-rail {\n  background-color: var(--caelestia-outline) !important;\n}\n\n.react-jinke-music-player-main .rc-slider-track {\n  background-color: var(--caelestia-primary) !important;\n}\n\n.react-jinke-music-player-main .rc-slider-handle {\n  background-color: var(--caelestia-primary) !important;\n  border-color: var(--caelestia-primary) !important;\n  box-shadow: none !important;\n}\n\n\n/* Expanded/mobile player */\n\n.react-jinke-music-player-mobile {\n  background-color: var(--caelestia-surface-container) !important;\n  color: var(--caelestia-on-surface) !important;\n}\n\n.react-jinke-music-player-mobile .rc-slider-rail {\n  background-color: var(--caelestia-outline) !important;\n}\n\n.react-jinke-music-player-mobile .rc-slider-track {\n  background-color: var(--caelestia-primary) !important;\n}\n\n.react-jinke-music-player-mobile .rc-slider-handle {\n  background-color: var(--caelestia-primary) !important;\n  border-color: var(--caelestia-primary) !important;\n  box-shadow: none !important;\n}\n\n\n/* ============================================================\n   PLAYER TEXT / ICONS\n   ============================================================ */\n\n.react-jinke-music-player-main button,\n.react-jinke-music-player-main svg {\n  color: var(--caelestia-on-surface) !important;\n}\n\n.react-jinke-music-player-mobile button,\n.react-jinke-music-player-mobile svg {\n  color: var(--caelestia-on-surface) !important;\n}\n\n\n/* ============================================================\n   FOCUS\n   ============================================================ */\n\n*:focus-visible {\n  outline-color: var(--caelestia-primary) !important;\n}\n\n\n/* ============================================================\n   SELECTION\n   ============================================================ */\n\n::selection {\n  background: var(--caelestia-primary) !important;\n  color: var(--caelestia-on-primary) !important;\n}",
      domains: "music.hu-tao.dev",
      when: "",
    },
    mdbook: {
      css: ":root {\n  /* Core */\n  --bg: var(--caelestia-background) !important;\n  --fg: var(--caelestia-on-surface) !important;\n\n  /* Sidebar */\n  --sidebar-bg: var(--caelestia-surface-container) !important;\n  --sidebar-fg: var(--caelestia-on-surface) !important;\n  --sidebar-non-existant: var(--caelestia-on-surface-variant) !important;\n  --sidebar-active: var(--caelestia-primary) !important;\n  --sidebar-spacer: var(--caelestia-outline) !important;\n\n  /* UI */\n  --scrollbar: var(--caelestia-outline) !important;\n  --icons: var(--caelestia-on-surface-variant) !important;\n  --icons-hover: var(--caelestia-on-surface) !important;\n\n  /* Links */\n  --links: var(--caelestia-primary) !important;\n  --inline-code-color: var(--caelestia-primary) !important;\n\n  /* Theme popup */\n  --theme-popup-bg: var(--caelestia-surface-container) !important;\n  --theme-popup-border: var(--caelestia-outline) !important;\n  --theme-hover: var(--caelestia-surface-container-high) !important;\n\n  /* Quotes */\n  --quote-bg: var(--caelestia-surface-container) !important;\n  --quote-border: var(--caelestia-outline) !important;\n\n  /* Tables */\n  --table-border-color: var(--caelestia-outline) !important;\n  --table-header-bg: var(--caelestia-surface-container-high) !important;\n  --table-alternate-bg: var(--caelestia-surface-container) !important;\n\n  /* Search */\n  --searchbar-border-color: var(--caelestia-outline) !important;\n  --searchbar-bg: var(--caelestia-surface-container) !important;\n  --searchbar-fg: var(--caelestia-on-surface) !important;\n  --searchbar-shadow-color: var(--caelestia-shadow) !important;\n\n  --searchresults-header-fg: var(--caelestia-on-surface) !important;\n  --searchresults-border-color: var(--caelestia-outline) !important;\n  --searchresults-li-bg: var(--caelestia-surface-container) !important;\n\n  /* Accents */\n  --sidebar-header-border-color: var(--caelestia-primary) !important;\n  --search-mark-bg: var(--caelestia-primary-container) !important;\n  --warning-border: var(--caelestia-tertiary) !important;\n\n  /* Admonitions */\n  --blockquote-note-color: var(--caelestia-primary) !important;\n  --blockquote-tip-color: var(--caelestia-secondary) !important;\n  --blockquote-important-color: var(--caelestia-tertiary) !important;\n  --blockquote-warning-color: var(--caelestia-tertiary) !important;\n  --blockquote-caution-color: var(--caelestia-error) !important;\n\n  --mdbook-incorrect: var(--caelestia-error) !important;\n  --mdbook-correct: var(--caelestia-primary) !important;\n}",
      domains: "",
      when: "#mdbook-body-container",
    },
    "spotify-web": { css: "", domains: "", when: "" },
  } as Record<string, Override>,
  custom: [
    { id: "custom-d1925e53-f4e8-4ebd-a317-5c2464110178", name: "Navidome" },
    { id: "custom-44f18919-3b08-4c80-95f1-1127045dff85", name: "Forgejo" },
  ] as { id: string; name: string }[],
};

const IMPORT = /@import\s+["']https:\/\/userstyles\.catppuccin\.com\/lib\/std\/v1\.less["'];/;

// Swaps catppuccin's palette in lib.less for the scheme's colours, and the
// accent for a scheme colour (primary by default) instead of a catppuccin one.
//
// ponytail: the `@<name>-filter` values stay catppuccin's own (a CSS filter
// chain per colour, precomputed upstream), so the few icons styles tint with a
// filter come out in catppuccin's shade, not the scheme's. Computing filter
// chains for arbitrary colours needs a solver; add one if that shows.
export function libFor(lib: string, scheme: Scheme, accent = "primary") {
  const c = scheme.colours;
  const colours = NAMES.map((n) => `@${n}: #${c[n]};`).join(" ");
  return lib
    .replace(/@catppuccin: \{[\s\S]*?\n\};/, `@catppuccin: { @latte: { ${colours} }; @mocha: { ${colours} }; };`)
    .replace("@accent: @catppuccin[@@flavor][@@accentColor];", `@accent: #${c[accent]};`);
}

// Both flavour variables are set to the scheme's mode, so a site's own light
// or dark toggle doesn't pick a branch the colours weren't made for. The
// flavour now only decides `if(@flavor = latte, ...)` branches.
export async function compile(less: any, lib: string, source: string, vars: Record<string, string>, mode: string): Promise<string> {
  const flavour = mode === "light" ? "latte" : "mocha";
  const { css } = await less.render(source.replace(IMPORT, lib), {
    globalVars: { ...vars, lightFlavor: flavour, darkFlavor: flavour },
  });
  return css;
}

// Splits compiled CSS into its @-moz-document blocks and whatever sits outside
// them. Web pages ignore @-moz-document, so the extension injects the bodies
// of the matching blocks instead of the whole sheet.
export function documents(css: string) {
  const blocks: { rules: Rule[]; body: string }[] = [];
  let global = "";
  let i = 0;
  const RULE = /\s*,?\s*(?:\/\*[\s\S]*?\*\/\s*)*(domain|url-prefix|url|regexp)\(\s*(["'])((?:\\.|(?!\2)[^\\])*)\2\s*\)/y;
  while (i < css.length) {
    const at = css.indexOf("@-moz-document", i);
    if (at < 0) {
      global += css.slice(i);
      break;
    }
    global += css.slice(i, at);
    let j = at + "@-moz-document".length;
    const rules: Rule[] = [];
    for (let m: RegExpExecArray | null; ((RULE.lastIndex = j), (m = RULE.exec(css))); j = RULE.lastIndex) {
      // CSS string escapes: `\\.` is a backslash and a dot.
      rules.push({ type: m[1], value: m[3].replace(/\\(.)/g, "$1") });
    }
    const open = css.indexOf("{", j);
    const close = closing(css, open);
    blocks.push({ rules, body: css.slice(open + 1, close) });
    i = close + 1;
  }
  return { global, blocks };
}

// The brace that closes the one at `open`, skipping strings and comments.
function closing(css: string, open: number) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      for (i++; i < css.length && css[i] !== ch; i++) if (css[i] === "\\") i++;
    } else if (ch === "/" && css[i + 1] === "*") {
      i = css.indexOf("*/", i + 2) + 1 || css.length;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}" && --depth === 0) {
      return i;
    }
  }
  return css.length;
}

// Stylus's semantics: a regexp must match the whole URL.
export function matches(rules: Rule[], url: string) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return rules.some(({ type, value }) => {
    if (type === "domain") return host === value || host.endsWith(`.${value}`);
    if (type === "url") return url === value;
    if (type === "url-prefix") return url.startsWith(value);
    try {
      return new RegExp(`^(?:${value})$`).test(url);
    } catch {
      return false;
    }
  });
}

// The CSS one compiled style contributes to a page, or "" when none of its
// blocks match the URL. `all` takes every block, for a page the user's
// override matched by its content or an extra domain.
export function cssFor(compiled: string, url: string, all = false) {
  const { global, blocks } = documents(compiled);
  const bodies = blocks.filter((b) => all || matches(b.rules, url)).map((b) => b.body);
  return bodies.length ? global + bodies.join("\n") : "";
}
