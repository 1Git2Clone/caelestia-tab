// Nerd Font glyphs for bookmark tiles. The font and its name index are
// vendored (scripts/vendor-nerd-fonts.sh), so nothing needs installing.

let names = null;

// { "fa-github": "f09b", … }, loaded the first time the editor needs it.
export const glyphNames = () => (names ??= fetch("vendor/nerd-fonts/glyphnames.json").then((r) => r.json()));

export const char = (code) => String.fromCodePoint(Number.parseInt(code, 16));

// What to suggest glyphs for: the host's labels without `www` and the TLD,
// split on hyphens, plus the bookmark's name. gist.github.com gives gist and
// github; music.hu-tao.dev gives music, and tao.
export function words(url, name = "") {
  let host = "";
  try {
    host = new URL(/^[a-z][\w+.-]*:/i.test(url) ? url : `https://${url}`).hostname;
  } catch {}
  const labels = host.split(".").slice(0, -1).filter((l) => l !== "www");
  const all = [...labels.flatMap((l) => l.split("-")), ...name.toLowerCase().split(/[^a-z0-9]+/)];
  return [...new Set(all.filter((w) => w.length >= 3))];
}

// Glyphs whose name has one of the words: a whole word first (fa-github),
// then a word inside another (dev-githubactions), each group alphabetical.
export function suggest(index, ws, limit = 48) {
  const hits = [];
  for (const [name, code] of Object.entries(index)) {
    const tokens = name.split(/[-_]/).slice(1);
    const joined = tokens.join("");
    let score = 0;
    for (const w of ws) score = Math.max(score, tokens.includes(w) ? 2 : joined.includes(w) ? 1 : 0);
    if (score) hits.push({ name, code, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}

export function search(index, query, limit = 96) {
  const q = query.trim().toLowerCase().replace(/^nf-/, "");
  if (!q) return [];
  return Object.entries(index)
    .filter(([name]) => name.includes(q))
    .slice(0, limit)
    .map(([name, code]) => ({ name, code }));
}

// The glyph a typed value means: the glyph itself, a name with or without the
// `nf-` prefix (nf-fa-github, fa-github), or a hex codepoint (f09b, U+F09B).
// null when it's none of those.
export function parse(index, input) {
  const v = input.trim();
  if (!v) return "";
  const byName = index[v.toLowerCase().replace(/^nf-/, "")];
  if (byName) return char(byName);
  const hex = v.match(/^(?:u\+|0x)?([0-9a-f]{4,6})$/i);
  if (hex) return char(hex[1]);
  return [...v].length === 1 ? v : null;
}
