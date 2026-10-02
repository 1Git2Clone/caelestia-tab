// node --test tests/*.test.mjs: userstyles.ts, glyphs.ts, bookmarks.ts and layout.ts.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { cssFor, documents, libFor, matches } from "../extension/src/userstyles.ts";

test("splits @-moz-document blocks and matches them like Stylus", () => {
  const css = `@import url("x.css");
@-moz-document /* note */ domain("example.com"), regexp("https?://a\\\\.test/.*") {
  a { content: "}"; } /* } */
  b { c: d; }
}
@-moz-document url-prefix("https://other.org/docs") { e { f: g; } }`;
  const { global, blocks } = documents(css);
  assert.equal(global.trim(), '@import url("x.css");');
  assert.deepEqual(blocks[0].rules, [
    { type: "domain", value: "example.com" },
    { type: "regexp", value: "https?://a\\.test/.*" },
  ]);
  assert.match(blocks[0].body, /b \{ c: d; \}/);
  assert.ok(matches(blocks[0].rules, "https://www.example.com/x"));
  assert.ok(matches(blocks[0].rules, "http://a.test/page"));
  assert.ok(!matches(blocks[0].rules, "http://aXtest/page"));
  assert.ok(!matches(blocks[0].rules, "https://notexample.com/"));
  assert.equal(cssFor(css, "https://nowhere.net/"), "");
  assert.match(cssFor(css, "https://other.org/docs/a"), /e \{ f: g; \}/);
  // An override that matched the page some other way takes every block.
  const all = cssFor(css, "https://nowhere.net/", true);
  assert.match(all, /b \{ c: d; \}/);
  assert.match(all, /e \{ f: g; \}/);
});

test("the vendored lib takes the scheme's colours and accent", () => {
  const lib = fs.readFileSync(new URL("../extension/public/userstyles/lib.less", import.meta.url), "utf8");
  const colours = new Proxy({}, { get: (_, name) => (name === "primary" ? "abcdef" : "123456") });
  const out = libFor(lib, { colours });
  assert.match(out, /@catppuccin: \{ @latte: \{ @rosewater: #123456;/);
  assert.match(out, /@accent: #abcdef;/);
  assert.doesNotMatch(out, /#dc8a78/, "catppuccin's own latte rosewater is gone");
});

test("glyph suggestions follow the bookmark's host and name", async () => {
  const { words, suggest } = await import("../extension/src/glyphs.ts");
  const index = JSON.parse(fs.readFileSync(new URL("../extension/public/vendor/nerd-fonts/glyphnames.json", import.meta.url), "utf8"));
  assert.deepEqual(words("https://gist.github.com/x", "Gists"), ["gist", "github", "gists"]);
  assert.deepEqual(words("music.hu-tao.dev", ""), ["music", "tao"]);
  const names = suggest(index, words("https://github.com", "GitHub")).map((g) => g.name);
  assert.ok(names.includes("fa-github") && names.includes("dev-github") && names.includes("md-github"));
  assert.ok(names.indexOf("fa-github") < names.indexOf("dev-githubactions"), "whole-word matches come first");
});

test("bookmarks saved as CSS strings load as numbers, and junk as the defaults", async () => {
  const { bookmarkOptions } = await import("../extension/src/bookmarks.ts");
  assert.deepEqual(bookmarkOptions({ even: true, tileWidth: "11rem", columns: "repeat(5, minmax(0, 1fr))", rows: "8.75rem", gap: "1.25rem", flow: "row dense", items: [] }), {
    count: 5,
    rowHeight: 8.75,
    gap: 1.25,
    flow: "row",
    items: [],
  });
  assert.deepEqual(bookmarkOptions({ columns: "200px 1fr 2fr", rows: "minmax(3.25rem, auto)", gap: "0.75rem 1.5rem", flow: "column dense" }), { flow: "column" }, "unparseable: left for the defaults");
  const now = { flow: "column", count: 3, rowHeight: 4, gap: 0.5, placement: "docked", hidden: true };
  assert.deepEqual(bookmarkOptions(now), now, "today's shape passes through");
});

test("the Tree Style Tab sidebar follows the background's choices", async () => {
  const { tstStyle, tstOptions, TREE_STYLE_TAB } = await import("../extension/src/treestyletab.ts");
  const colours = new Proxy({}, { get: (_, n) => ({ primary: "aa0000", tertiary: "00aa00" })[n] ?? "111111" });
  const scheme = { mode: "dark", colours };
  const tint = tstStyle(scheme, tstOptions({ source: "colour", colour: "tertiary", dim: 80 }), null);
  assert.match(tint, /--tabbar-bg: color-mix\(in srgb, #00aa00 20%/);
  // x and y seeded at 0 (today's default is -50, moved): this is testing the
  // centring behaviour, not the default's own offset.
  const wall = tstStyle(scheme, tstOptions({ source: "wallpaper", dim: 30, blur: 4, x: 0, y: 0 }), "data:image/jpeg;base64,x");
  assert.match(wall, /--tabbar-bg: transparent !important/);
  assert.match(wall, /url\("data:image\/jpeg;base64,x"\)/);
  assert.match(wall, /blur\(4px\)/);
  assert.match(wall, /opacity: 0.3/);
  assert.match(wall, /\) 50% 50% \/ cover/, "centred unless moved");
  const moved = tstStyle(scheme, tstOptions({ source: "wallpaper", x: -100, y: 40 }), "data:image/jpeg;base64,x");
  assert.match(moved, /\) 0% 70% \/ cover/);
  assert.equal(tstOptions({ tint: false }).source, "none", "the old off switch still means off");
  assert.deepEqual(
    tstOptions({ source: "tint", strength: 20 }),
    { ...TREE_STYLE_TAB, source: "colour", dim: 80 },
    "an old tint's strength becomes its dim, the rest from the defaults",
  );
});

test("the defaults are the maintainer's own setup: Tree Style Tab and the sites", async () => {
  const { TREE_STYLE_TAB } = await import("../extension/src/treestyletab.ts");
  assert.deepEqual(TREE_STYLE_TAB, { source: "wallpaper", colour: "surfaceContainerHighest", dim: 50, blur: 7, x: -50, y: 0 });

  const { SITES } = await import("../extension/src/userstyles.ts");
  assert.equal(SITES.enabled, true);
  assert.deepEqual(SITES.off, []);
  assert.equal(SITES.accent, "primary");
  assert.deepEqual(
    SITES.custom.map((c) => c.name).sort(),
    ["Forgejo", "Navidome"].sort(),
    "kept verbatim, typo and all",
  );
  assert.equal(SITES.overrides.mdbook.when, "#mdbook-body-container");
  assert.equal(SITES.overrides.codeberg.css, "", "no override CSS of its own");
  assert.equal(SITES.overrides["spotify-web"].domains, "");
  const forgejoId = SITES.custom.find((c) => c.name === "Forgejo").id;
  assert.match(SITES.overrides[forgejoId].domains, /git\.hu-tao\.dev/);
});
