#!/usr/bin/env python3
"""Sets the ANTICATER LED mode based on macOS screen lock state. Runs
forever -- intended to be launched via the LaunchAgent that install.sh sets
up (see README.md in this directory).

Usage: lock_watch.py [--lock-mode N] [--unlock-mode N]
"""
import argparse
import subprocess
import sys
from pathlib import Path

from Foundation import NSDistributedNotificationCenter, NSObject
from PyObjCTools import AppHelper

SCRIPT_DIR = Path(__file__).resolve().parent
LED_MODE_SCRIPT = SCRIPT_DIR / "led_mode.py"
PYTHON = sys.executable


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--lock-mode", type=int, default=0, choices=range(6))
    p.add_argument("--unlock-mode", type=int, default=2, choices=range(6))
    return p.parse_args()


def set_mode(mode):
    subprocess.run([PYTHON, str(LED_MODE_SCRIPT), str(mode)], check=False)


class Watcher(NSObject):
    def screenLocked_(self, notification):
        set_mode(self.lock_mode)

    def screenUnlocked_(self, notification):
        set_mode(self.unlock_mode)


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
    AppHelper.runConsoleEventLoop()


if __name__ == "__main__":
    main()
