#!/usr/bin/env bash
# Installs a mod folder from this workspace into Sine in the local Zen profile,
# so it can be tested without publishing it. Works for both Zen-format mods
# and Sine mods with scripts. Scripts only run when
# "Enable installing JS from unofficial sources" is on in Sine's settings.
#
# Usage: scripts/install-local.sh command-palette-fade
# Override the profile with ZEN_PROFILE=/path/to/profile if needed.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
mod_dir="$root/${1:?usage: $0 <mod-folder-name>}"
zen_dir="$HOME/Library/Application Support/zen"

[[ -f "$mod_dir/theme.json" ]] || { echo "No theme.json in $mod_dir" >&2; exit 1; }

if [[ -z "${ZEN_PROFILE:-}" ]]; then
  rel="$(awk -F= '/^Default=/{print $2; exit}' "$zen_dir/installs.ini")"
  ZEN_PROFILE="$zen_dir/$rel"
fi

sine_dir="$ZEN_PROFILE/chrome/sine-mods"
registry="$sine_dir/mods.json"
[[ -f "$registry" ]] || { echo "Sine is not installed in $ZEN_PROFILE (no $registry)" >&2; exit 1; }

mod_id="$(jq -r .id "$mod_dir/theme.json")"
target="$sine_dir/$mod_id"

# Copied, not symlinked: removing a mod from Sine's settings deletes its folder recursively.
mkdir -p "$target"
rsync -a --delete --exclude theme.json "$mod_dir/" "$target/"

has_chrome=false
[[ -f "$mod_dir/chrome.css" ]] && has_chrome=true

tmp="$(mktemp)"
jq --slurpfile mod "$mod_dir/theme.json" --argjson hasChrome "$has_chrome" '
  .[$mod[0].id] = (
    $mod[0]
    + (if $hasChrome then {style: {chrome: "chrome.css"}} else {} end)
    + {enabled: (.[$mod[0].id].enabled // true), "no-updates": true}
  )
' "$registry" > "$tmp"
mv "$tmp" "$registry"

echo "Installed '$mod_id' into Sine ($ZEN_PROFILE)"
echo "Reload: toggle it off and on in Settings > Sine Mods, or restart Zen."
