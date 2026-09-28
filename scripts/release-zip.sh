#!/bin/sh
# The addons.mozilla.org zips for a tagged version, byte for byte the same
# on every run: the extension, built without anyone's own components, and
# its source. `web-ext build` can't do the first, since it stamps each entry
# with the time it zips and adds them in whatever order its directory walk
# finishes; so every file takes the tagged commit's time, and zip takes them
# sorted, without extra attributes.
#
#   scripts/release-zip.sh 0.1.0      (in the dev shell, with zip on PATH)
#
# Writes release/caelestia-tab-<version>.zip, -source.zip and SHA256SUMS.
set -eu
version=$1
tag=v$version
root=$(git rev-parse --show-toplevel)
cd "$root"
[ "$(git rev-parse HEAD)" = "$(git rev-parse "$tag^{commit}")" ] || { echo "check out $tag first" >&2; exit 1; }
git diff --quiet HEAD -- extension || { echo "extension/ has changes $tag doesn't" >&2; exit 1; }

time=$(git log -1 --format=%ct "$tag")
empty=$(mktemp -d)
npm ci --prefix extension --silent
CAELESTIA_TAB_COMPONENTS=$empty npm run --prefix extension --silent build >/dev/null
rmdir "$empty"

mkdir -p release
out=$root/release/caelestia-tab-$version.zip
rm -f "$out"
# render.js is the unused SSR build: nothing in the extension loads it.
(cd extension/dist && find . -exec touch -h -d "@$time" {} + &&
  find . -type f ! -name render.js | LC_ALL=C sort | TZ=UTC zip -q -X -D -9 -@ "$out")
git archive --format=zip --mtime="@$time" -o "release/caelestia-tab-$version-source.zip" "$tag"
(cd release && sha256sum "caelestia-tab-$version.zip" "caelestia-tab-$version-source.zip" > SHA256SUMS && cat SHA256SUMS)
