// node --test tests/*.test.mjs: userstyles.js and glyphs.js.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { cssFor, documents, libFor, matches } from "../extension/userstyles.js";

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
  const lib = fs.readFileSync(new URL("../extension/userstyles/lib.less", import.meta.url), "utf8");
  const colours = new Proxy({}, { get: (_, name) => (name === "primary" ? "abcdef" : "123456") });
  const out = libFor(lib, { colours });
  assert.match(out, /@catppuccin: \{ @latte: \{ @rosewater: #123456;/);
  assert.match(out, /@accent: #abcdef;/);
  assert.doesNotMatch(out, /#dc8a78/, "catppuccin's own latte rosewater is gone");
});

test("glyph suggestions follow the bookmark's host and name", async () => {
  const { words, suggest, parse } = await import("../extension/glyphs.js");
  const index = JSON.parse(fs.readFileSync(new URL("../extension/vendor/nerd-fonts/glyphnames.json", import.meta.url), "utf8"));
  assert.deepEqual(words("https://gist.github.com/x", "Gists"), ["gist", "github", "gists"]);
  assert.deepEqual(words("music.hu-tao.dev", ""), ["music", "tao"]);
  const names = suggest(index, words("https://github.com", "GitHub")).map((g) => g.name);
  assert.ok(names.includes("fa-github") && names.includes("dev-github") && names.includes("md-github"));
  assert.ok(names.indexOf("fa-github") < names.indexOf("dev-githubactions"), "whole-word matches come first");
  assert.equal(parse(index, "nf-fa-github"), "");
  assert.equal(parse(index, "f09b"), "");
  assert.equal(parse(index, ""), "");
  assert.equal(parse(index, "not a glyph"), null);
});

test("even rows never leave one tile alone on a row", async () => {
  const { evenColumns } = await import("../extension/plugins/bookmarks.js");
  const five = [1, 1, 1, 1, 1];
  assert.equal(evenColumns(1000, 176, 20, five), 5, "all five fit");
  assert.equal(evenColumns(800, 176, 20, five), 3, "four fit: 3 and 2, not 4 and 1");
  assert.equal(evenColumns(150, 176, 20, five), 1, "narrower than one tile: one column");
  assert.equal(evenColumns(1000, 176, 20, [1, 2, 1, 1]), 5, "a wide tile counts its span");
  assert.equal(evenColumns(1000, 176, 20, [1, 1]), 2, "few tiles: only as many columns as tiles");
});
