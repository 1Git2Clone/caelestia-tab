#!/usr/bin/env bash
# Vendors the Nerd Fonts symbols into extension/vendor/nerd-fonts/: the
# symbols-only font as WOFF2, and a compact name -> codepoint index of every
# glyph, which the bookmark editor searches and suggests from. Run from the
# repo root, in the dev shell:
#
#   sh scripts/vendor-nerd-fonts.sh
set -euo pipefail

VERSION=v3.5.1
out=extension/vendor/nerd-fonts
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

base=https://github.com/ryanoasis/nerd-fonts
curl -fsSL "$base/releases/download/$VERSION/NerdFontsSymbolsOnly.tar.xz" | tar -xJ -C "$tmp"
curl -fsSL -o "$tmp/glyphnames.json" "https://raw.githubusercontent.com/ryanoasis/nerd-fonts/$VERSION/glyphnames.json"

rm -rf "$out"
mkdir -p "$out"
woff2_compress "$tmp/SymbolsNerdFont-Regular.ttf" >/dev/null
cp "$tmp/SymbolsNerdFont-Regular.woff2" "$tmp/LICENSE" "$out/"
# { "fa-github": "f09b", ... }, without the METADATA entry.
jq -c 'del(.METADATA) | map_values(.code)' "$tmp/glyphnames.json" > "$out/glyphnames.json"
echo "vendored Nerd Fonts $VERSION: $(jq length "$out/glyphnames.json") glyphs"
