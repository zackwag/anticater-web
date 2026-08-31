#!/usr/bin/env python3
"""Sets the ANTICATER LED mode based on macOS screen lock state. Runs
forever -- intended to be launched via the LaunchAgent that install.sh sets
up (see README.md in this directory).

Usage: lock_watch.py [--lock-mode N] [--unlock-mode N]
"""
import argparse
import datetime
import time

from AppKit import NSWorkspace
from Foundation import NSDistributedNotificationCenter, NSObject
from PyObjCTools import AppHelper

from led_mode import set_led_mode

MIN_WRITE_INTERVAL = 1.0
_last_write = 0.0


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--lock-mode", type=int, default=0, choices=range(6))
    p.add_argument("--unlock-mode", type=int, default=2, choices=range(6))
    return p.parse_args()


def set_mode(event, mode):
    global _last_write
    ts = datetime.datetime.now().isoformat()
    print(f"[{ts}] {event} notification received, setting mode {mode}")
    elapsed = time.monotonic() - _last_write
    if elapsed < MIN_WRITE_INTERVAL:
        time.sleep(MIN_WRITE_INTERVAL - elapsed)
    set_led_mode(mode)
    _last_write = time.monotonic()


class Watcher(NSObject):
    def screensaverStarted_(self, notification):
        set_mode("screensaver started", self.lock_mode)

    def screensaverStopped_(self, notification):
        set_mode("screensaver stopped", self.unlock_mode)

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
    set_mode("startup", args.unlock_mode)

    watcher = Watcher.alloc().init()
    watcher.lock_mode = args.lock_mode
    watcher.unlock_mode = args.unlock_mode

    center = NSDistributedNotificationCenter.defaultCenter()
    center.addObserver_selector_name_object_(
        watcher, "screensaverStarted:", "com.apple.screensaver.didstart", None
    )
    center.addObserver_selector_name_object_(
        watcher, "screensaverStopped:", "com.apple.screensaver.didstop", None
    )
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
