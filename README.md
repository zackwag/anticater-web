# anticater-web

An unofficial, browser-based configurator for the **ANTICATER VK-01** dial/macro-pad,
built as a replacement for the bundled `ANTICATER.app` (which requires Rosetta and is
fairly clunky). Uses the [WebHID API](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API),
so it only works in Chromium-based browsers (Chrome, Edge, Opera).

If you own an ANTICATER VK-01 (USB vendor/product ID `0x514C:0x8850`) and found this by
searching for it, you're in the right place.

This is **not affiliated with or endorsed by the device's manufacturer**. The write
side of the protocol was reverse-engineered by intercepting `libhidapi` calls in the
native app with a debugger; the read side comes from
[x0rloser/anticater_vk01](https://github.com/x0rloser/anticater_vk01), who found the
device responds to queries via plain input reports rather than `GET_FEATURE` requests.
See [`protocol.js`](./protocol.js) for the documented wire format.

## Using it

WebHID requires a secure context, so you can't just open `index.html` as a `file://`
URL — it needs to be served and opened from `localhost`.

**With Docker** (no need to clone this repo — just run this):

```sh
docker run -p 127.0.0.1:8743:80 zackwag/anticater-web
```

**Without Docker**, from a checkout of this repo:

```sh
python3 -m http.server 8743
```

Either way, open `http://localhost:8743/` in Chrome, Edge, or Opera, click
**Connect device**, and pick the device from the browser's picker (it'll show up as
"USB Composite Device" — that's the device's own USB descriptor, not something this
app controls).

## What it supports

- Reading your current bindings and LED mode from the device on connect, so the UI
  reflects what's actually set rather than a locally-cached guess
- Binding a keyboard key or media key to each of the dial's 5 gestures (Scroll Left,
  Press, Scroll Right, Press+Scroll Left, Press+Scroll Right)
- Binding a single modifier hold (Ctrl/Shift/Alt/Win, either side) to a gesture —
  this is the full extent of what the device's "combo" feature actually does; despite
  the UI implying otherwise, it can't send real modifier+key combos like Ctrl+C (see
  `protocol.js` for how this was verified)
- Selecting one of the 6 built-in LED modes, including custom per-LED colors and
  presets for Mode 3
- Exporting/importing your configuration as JSON, as a portable backup

Not supported (out of scope for now): the Procreate action-preset tab and the
delay/macro recording tab.

## Automation

There's a macOS script to automatically change the LED mode when your screen
locks/unlocks, independent of the browser — see [`scripts/`](./scripts).

## Troubleshooting

**LED mode gets stuck / stops responding to changes.** The device itself can hang in
this state (not this app or your browser) — unplug it and plug it back in. Bindings and
LED mode persist through the power cycle since they live in the device's own memory.

**Console shows `NotAllowedError: Failed to write the report` right after the page
auto-reconnects.** The cached WebHID connection from a previous page load can go stale.
Click **Disconnect**, then **Connect device** again to get a fresh connection — no
need to unplug the device for this one.

**Connecting fails, or every write silently does nothing.** Only one program can
hold the device's USB HID connection at a time — close `ANTICATER.app` (and any other
tool talking to the device) before connecting here.

## Related projects

This tool is a straightforward configurator — bind the 5 gestures, pick an LED mode.
For deeper, per-application remapping and other transports, other people have built:

- [x0rloser/anticater_vk01](https://github.com/x0rloser/anticater_vk01) — the Python
  reverse-engineering this project's read protocol is based on
- [frostvalley-hussey/vk01-anticater](https://github.com/frostvalley-hussey/vk01-anticater) —
  a macOS daemon that binds the 5 gestures to fixed chords once, then remaps them
  per-app with layers, since the device's own firmware can't be replaced
- [dreamug/anticater-knob-control](https://github.com/dreamug/anticater-knob-control) —
  a native macOS app with a similar per-application remapping approach, plus a GUI
- [zerni/ha-ble-knob](https://github.com/zerni/ha-ble-knob) — a Home Assistant
  integration for the device's Bluetooth HID mode (a different transport than the USB
  connection this tool uses)
- [afcragg78/Wireless-Smart-Home-Volume-Knob-Anticater-VK-01-to-Music-Assistant-](https://github.com/afcragg78/Wireless-Smart-Home-Volume-Knob-Anticater-VK-01-to-Music-Assistant-) —
  routes the knob's Bluetooth media keys on Windows into Home Assistant / Music
  Assistant via MQTT

## Credits

- Read protocol (query + input-report responses) discovered by
  [x0rloser/anticater_vk01](https://github.com/x0rloser/anticater_vk01)

## License

MIT
