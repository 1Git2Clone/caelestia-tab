// node --test tests/*.test.mjs
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
});

test("the vendored lib takes the scheme's colours and accent", () => {
  const lib = fs.readFileSync(new URL("../extension/userstyles/lib.less", import.meta.url), "utf8");
  const colours = new Proxy({}, { get: (_, name) => (name === "primary" ? "abcdef" : "123456") });
  const out = libFor(lib, { colours });
  assert.match(out, /@catppuccin: \{ @latte: \{ @rosewater: #123456;/);
  assert.match(out, /@accent: #abcdef;/);
  assert.doesNotMatch(out, /#dc8a78/, "catppuccin's own latte rosewater is gone");
});
