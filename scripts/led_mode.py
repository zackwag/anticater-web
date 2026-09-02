#!/usr/bin/env python3
"""Set the ANTICATER dial's LED mode directly over HID, no browser required.

Mirrors the protocol documented in protocol.js (buildLedPackets). Requires
the `hid` package (pip install hid) and the hidapi C library (brew install
hidapi).

Usage: led_mode.py <mode 0-5>
"""
import datetime
import signal
import sys
import time

import hid

VENDOR_ID = 0x514C
PRODUCT_ID = 0x8850
USAGE_PAGE = 0xFF00
REPORT_ID = 0x03

LED_DEFAULT_COLORS = [
    (0xff, 0x00, 0x00), (0xff, 0x80, 0x30), (0xff, 0xff, 0x30),
    (0x00, 0xff, 0x00), (0x00, 0xff, 0xff), (0x00, 0x00, 0xff),
]


def build_led_packets(mode, palette=LED_DEFAULT_COLORS):
    packets = []
    for idx in range(3):
        p = bytearray(65)
        p[0] = REPORT_ID
        p[1] = 0xfe
        p[2] = 0xb0
        p[3] = idx
        p[4] = mode if idx == 0 else 0x00
        off = 5
        for r, g, b in palette:
            p[off], p[off + 1], p[off + 2] = r, g, b
            off += 3
        packets.append(bytes(p))
    return packets


def find_device_path():
    for d in hid.enumerate(VENDOR_ID, PRODUCT_ID):
        if d.get("usage_page") == USAGE_PAGE:
            return d["path"]
    return None


def set_led_mode(mode, retries=2, retry_delay=0.5):
    for attempt in range(1 + retries):
        ts = datetime.datetime.now().isoformat()
        path = find_device_path()
        if path is None:
            if attempt < retries:
                time.sleep(retry_delay)
                continue
            print(f"[{ts}] set_led_mode({mode}): device not found", file=sys.stderr)
            return False
        try:
            with hid.Device(path=path) as h:
                # Block SIGTERM during the multi-packet write so a
                # launchctl stop can't kill us mid-sequence and leave
                # the device with a partial command (which hangs it).
                prev = signal.signal(signal.SIGTERM, signal.SIG_IGN)
                try:
                    for pkt in build_led_packets(mode):
                        h.write(pkt)
                finally:
                    signal.signal(signal.SIGTERM, prev)
            print(f"[{ts}] set_led_mode({mode}): ok")
            return True
        except Exception as e:
            if attempt < retries:
                time.sleep(retry_delay)
            else:
                print(f"[{ts}] set_led_mode({mode}): write failed: {e}", file=sys.stderr)
                return False


if __name__ == "__main__":
    if len(sys.argv) != 2 or not sys.argv[1].isdigit() or not (0 <= int(sys.argv[1]) <= 5):
        print("usage: led_mode.py <mode 0-5>", file=sys.stderr)
        sys.exit(1)
    sys.exit(0 if set_led_mode(int(sys.argv[1])) else 1)
