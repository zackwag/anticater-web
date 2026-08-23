#!/usr/bin/env bash
# Removes the LaunchAgent installed by install.sh.
set -euo pipefail

LABEL="com.anticater-web.led-watch"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "Uninstalled."
