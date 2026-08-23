#!/usr/bin/env python3
"""Sets the ANTICATER LED mode based on macOS screen lock state. Runs
forever -- intended to be launched via the LaunchAgent that install.sh sets
up (see README.md in this directory).

Usage: lock_watch.py [--lock-mode N] [--unlock-mode N]
"""
import argparse
import datetime
import subprocess
import sys
from pathlib import Path

from Foundation import NSDistributedNotificationCenter, NSObject, NSWorkspace
from PyObjCTools import AppHelper

SCRIPT_DIR = Path(__file__).resolve().parent
LED_MODE_SCRIPT = SCRIPT_DIR / "led_mode.py"
PYTHON = sys.executable


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--lock-mode", type=int, default=0, choices=range(6))
    p.add_argument("--unlock-mode", type=int, default=2, choices=range(6))
    return p.parse_args()


def set_mode(event, mode):
    ts = datetime.datetime.now().isoformat()
    print(f"[{ts}] {event} notification received, setting mode {mode}")
    subprocess.run([PYTHON, str(LED_MODE_SCRIPT), str(mode)], check=False)


class Watcher(NSObject):
    def screenLocked_(self, notification):
        set_mode("lock", self.lock_mode)

    def screenUnlocked_(self, notification):
        set_mode("unlock", self.unlock_mode)

    def systemDidWake_(self, notification):
        # A distributed notification posted while this process was itself
        # asleep (e.g. after full system sleep, as opposed to an explicit
        # Ctrl+Cmd+Q lock which keeps the Mac awake) can be missed entirely.
        # macOS locks the screen by default on sleep, so treat waking up as
        # a safety-net "assume locked" -- the real unlock notification still
        # fires normally once you actually enter your password.
        set_mode("wake (safety net, assuming locked)", self.lock_mode)


def main():
    args = parse_args()
    watcher = Watcher.alloc().init()
    watcher.lock_mode = args.lock_mode
    watcher.unlock_mode = args.unlock_mode

    center = NSDistributedNotificationCenter.defaultCenter()
    center.addObserver_selector_name_object_(
        watcher, "screenLocked:", "com.apple.screenIsLocked", None
    )
    center.addObserver_selector_name_object_(
        watcher, "screenUnlocked:", "com.apple.screenIsUnlocked", None
    )
    NSWorkspace.sharedWorkspace().notificationCenter().addObserver_selector_name_object_(
        watcher, "systemDidWake:", "NSWorkspaceDidWakeNotification", None
    )
    AppHelper.runConsoleEventLoop()


if __name__ == "__main__":
    main()
