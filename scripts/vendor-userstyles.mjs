#!/usr/bin/env node
// Vendors catppuccin/userstyles at a pinned commit into extension/userstyles/
// and less.js into extension/vendor/. Run from the repo root, in the dev shell:
//
//   node scripts/vendor-userstyles.mjs
//
// The styles are copied as-is; the extension compiles them against the live
// caelestia scheme (extension/userstyles.js). What this adds is index.json: per
// style its name, its @var defaults and the URL rules of its @-moz-document
// blocks, which the extension needs to know which styles a page wants before
// it compiles any of them. The rules are read from a compiled copy, because
// some styles build them with LESS (syncthing's come from an @var).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

import { compile, documents } from "../extension/userstyles.js";

const REV = "5307c4e5e98a0ea623114ec31102f575104a368e";
// What catppuccin itself lints with (its deno.json), so a style that compiles
// there compiles here.
const LESS = "4.2.2";
const USERCSS_META = "0.12.0";

const out = path.resolve("extension/userstyles");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "caelestia-tab-"));
const run = (cmd, args, cwd = tmp) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "ignore", "inherit"] });

run("git", ["init", "-q", "cup"]);
const cup = path.join(tmp, "cup");
run("git", ["fetch", "-q", "--depth=1", "https://github.com/catppuccin/userstyles", REV], cup);
run("git", ["checkout", "-q", "FETCH_HEAD"], cup);
run("npm", ["install", "--silent", "--no-save", "--prefix", tmp, `less@${LESS}`, `usercss-meta@${USERCSS_META}`]);

const require = createRequire(path.join(tmp, "node_modules/"));
const less = require("less");
const { parse } = require("usercss-meta");

const lib = fs.readFileSync(path.join(cup, "lib/std/v1.less"), "utf8");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(cup, "LICENSE"), path.join(out, "LICENSE"));
fs.writeFileSync(path.join(out, "lib.less"), lib);

const index = [];
for (const id of fs.readdirSync(path.join(cup, "styles")).sort()) {
  const file = path.join(cup, "styles", id, "catppuccin.user.less");
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  const { metadata } = parse(source.match(/\/\* ==UserStyle==[\s\S]*?==\/UserStyle== \*\//)[0]);
  const vars = Object.fromEntries(Object.entries(metadata.vars ?? {}).map(([k, v]) => [k, String(v.default)]));
  let css;
  try {
    css = await compile(less, lib, source, vars, "dark");
  } catch (e) {
    console.warn(`skipping ${id}: ${e.message}`);
    continue;
  }
  const matches = documents(css).blocks.flatMap((b) => b.rules);
  fs.writeFileSync(path.join(out, `${id}.less`), source);
  index.push({ id, name: metadata.name.replace(/ Catppuccin$/, ""), vars, matches });
}
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify({ rev: REV, styles: index }, null, 1) + "\n");

const vendor = path.resolve("extension/vendor");
fs.mkdirSync(vendor, { recursive: true });
fs.copyFileSync(path.join(tmp, "node_modules/less/dist/less.min.js"), path.join(vendor, "less.min.js"));
// The npm package ships without its licence file.
const licence = await fetch(`https://raw.githubusercontent.com/less/less.js/v${LESS}/LICENSE`);
if (!licence.ok) throw new Error(`less.js LICENSE: HTTP ${licence.status}`);
fs.writeFileSync(path.join(vendor, "less.LICENSE"), await licence.text());

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`vendored ${index.length} styles from catppuccin/userstyles@${REV.slice(0, 7)}`);
