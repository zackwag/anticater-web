#!/usr/bin/env bash
# Installs the ANTICATER lock/unlock LED automation as a macOS LaunchAgent
# that starts automatically at login. Safe to re-run (replaces any existing
# install).
#
# Usage: ./install.sh [--lock-mode N] [--unlock-mode N]
#   Defaults: lock -> mode 0 (off), unlock -> mode 2

set -euo pipefail

LOCK_MODE=0
UNLOCK_MODE=2
while [[ $# -gt 0 ]]; do
  case "$1" in
    --lock-mode) LOCK_MODE="$2"; shift 2 ;;
    --unlock-mode) UNLOCK_MODE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.anticater-web.led-watch"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_PATH="/tmp/anticater-led-watch.log"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required (for hidapi). Install it from https://brew.sh first." >&2
  exit 1
fi

if ! brew list hidapi >/dev/null 2>&1; then
  echo "Installing hidapi..."
  brew install hidapi
fi

if [[ ! -d "$SCRIPT_DIR/.venv" ]]; then
  echo "Creating virtualenv..."
  python3 -m venv "$SCRIPT_DIR/.venv"
fi

echo "Installing Python dependencies..."
"$SCRIPT_DIR/.venv/bin/pip" install --quiet -r "$SCRIPT_DIR/requirements.txt"

echo "Writing $PLIST_PATH..."
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$SCRIPT_DIR/.venv/bin/python3</string>
        <string>$SCRIPT_DIR/lock_watch.py</string>
        <string>--lock-mode</string>
        <string>$LOCK_MODE</string>
        <string>--unlock-mode</string>
        <string>$UNLOCK_MODE</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_PATH</string>
    <key>StandardErrorPath</key>
    <string>$LOG_PATH</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

# You're presumably unlocked while running this, so apply the unlock mode
# immediately rather than waiting for the next actual lock/unlock cycle.
"$SCRIPT_DIR/.venv/bin/python3" "$SCRIPT_DIR/led_mode.py" "$UNLOCK_MODE" || true

echo "Installed and running. Lock mode: $LOCK_MODE, unlock mode: $UNLOCK_MODE."
echo "Logs: $LOG_PATH"
echo "To change modes later, re-run this script with different --lock-mode/--unlock-mode."
echo "To uninstall: ./uninstall.sh"
