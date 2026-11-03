#!/usr/bin/env bash
# Builds the CSS-only Zen Mods store version of a mod into dist/zen-store/<name>/:
# open.css becomes chrome.css, and preferences that only matter for the
# Sine script (close animation) are dropped. Paste these files into the
# theme-store submission form.
#
# Usage: scripts/build-zen-store.sh command-palette-fade
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
name="${1:?usage: $0 <mod-folder-name>}"
src="$root/$name"
out="$root/dist/zen-store/$name"

rm -rf "$out"
mkdir -p "$out"

cp "$src/open.css" "$out/chrome.css"
cp "$src/zen-store.readme.md" "$out/readme.md"
jq '[.[] | select(.property | test("close") | not)]' "$src/preferences.json" > "$out/preferences.json"

echo "Built $out"
ls "$out"
