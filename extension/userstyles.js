// Compiles the vendored catppuccin userstyles against the live caelestia
// scheme, and picks out the parts of a compiled style that apply to a URL.
// Shared by background.js and scripts/vendor-userstyles.mjs.

// The catppuccin palette. caelestia's scheme carries every one of these names.
const NAMES = [
  "rosewater", "flamingo", "pink", "mauve", "red", "maroon", "peach", "yellow",
  "green", "teal", "sky", "sapphire", "blue", "lavender", "text", "subtext1",
  "subtext0", "overlay2", "overlay1", "overlay0", "surface2", "surface1",
  "surface0", "base", "mantle", "crust",
];

// settings.sites when nothing's been saved: every style on, accented with the
// scheme's primary.
export const SITES = { enabled: true, off: [], accent: "primary" };

const IMPORT = /@import\s+["']https:\/\/userstyles\.catppuccin\.com\/lib\/std\/v1\.less["'];/;

// Swaps catppuccin's palette in lib.less for the scheme's colours, and the
// accent for a scheme colour (primary by default) instead of a catppuccin one.
//
// ponytail: the `@<name>-filter` values stay catppuccin's own (a CSS filter
// chain per colour, precomputed upstream), so the few icons styles tint with a
// filter come out in catppuccin's shade, not the scheme's. Computing filter
// chains for arbitrary colours needs a solver; add one if that shows.
export function libFor(lib, scheme, accent = "primary") {
  const c = scheme.colours;
  const colours = NAMES.map((n) => `@${n}: #${c[n]};`).join(" ");
  return lib
    .replace(/@catppuccin: \{[\s\S]*?\n\};/, `@catppuccin: { @latte: { ${colours} }; @mocha: { ${colours} }; };`)
    .replace("@accent: @catppuccin[@@flavor][@@accentColor];", `@accent: #${c[accent]};`);
}

// Both flavour variables are set to the scheme's mode, so a site's own light
// or dark toggle doesn't pick a branch the colours weren't made for. The
// flavour now only decides `if(@flavor = latte, ...)` branches.
export async function compile(less, lib, source, vars, mode) {
  const flavour = mode === "light" ? "latte" : "mocha";
  const { css } = await less.render(source.replace(IMPORT, lib), {
    globalVars: { ...vars, lightFlavor: flavour, darkFlavor: flavour },
  });
  return css;
}

// Splits compiled CSS into its @-moz-document blocks and whatever sits outside
// them. Web pages ignore @-moz-document, so the extension injects the bodies
// of the matching blocks instead of the whole sheet.
export function documents(css) {
  const blocks = [];
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
    const rules = [];
    for (let m; ((RULE.lastIndex = j), (m = RULE.exec(css))); j = RULE.lastIndex) {
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
function closing(css, open) {
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
export function matches(rules, url) {
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
// blocks match the URL.
export function cssFor(compiled, url) {
  const { global, blocks } = documents(compiled);
  const bodies = blocks.filter((b) => matches(b.rules, url)).map((b) => b.body);
  return bodies.length ? global + bodies.join("\n") : "";
}
