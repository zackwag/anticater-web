# Lock/unlock LED automation

Sets the ANTICATER dial's LED mode automatically when your Mac's screen locks
and unlocks (e.g. off while locked, a distinct color while unlocked) — no
browser tab needs to stay open. Talks to the device directly over HID, using
the same protocol as the web app (see `../protocol.js`).

macOS only.

## Install

```sh
brew install hidapi   # if you don't already have it
./install.sh
```

This sets mode 0 on lock and mode 2 on unlock by default. To use different
modes:

```sh
./install.sh --lock-mode 0 --unlock-mode 3
```

Re-running `install.sh` at any time replaces the running configuration — safe
to use whenever you want to change modes.

This registers a `launchd` LaunchAgent (`com.anticater-web.led-watch`) that
starts automatically at every login. Logs go to `/tmp/anticater-led-watch.log`.

## Uninstall

```sh
./uninstall.sh
```

## Using the pieces independently

- `led_mode.py <mode 0-5>` sets the LED mode once and exits — useful on its
  own for any other scripting (a cron job, a keyboard shortcut, etc).
- `lock_watch.py [--lock-mode N] [--unlock-mode N]` is the long-running
  watcher; `install.sh` just wraps it in a LaunchAgent.

Both require the `hid` and `pyobjc-framework-Cocoa` Python packages
(`pip install -r requirements.txt` into a venv — `install.sh` does this for
you).
