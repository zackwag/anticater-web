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
- A small set of Ctrl/Shift/Alt-style combos (see below — this device uses a fixed
  lookup table, not composable modifier bits, so only combos that have been captured
  are supported)
- Selecting one of the 6 built-in LED modes
- Exporting/importing your configuration as JSON, as a portable backup

Not supported (out of scope for now): the Procreate action-preset tab, the delay/macro
recording tab, and RGB palette editing.

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

## Contributing a new combo code

The `Ctrl+Shift+Alt` combo tab in `ANTICATER.app` doesn't compose modifiers the way
you'd expect — each combo (e.g. `Ctrl+C`) is sent as a single fixed byte code, from
what looks like a small firmware-side lookup table (roughly 24 possible values). We
can only support combos that have actually been captured off the wire.

If you want a combo that isn't in [`protocol.js`](./protocol.js)'s `COMBO_CODES` table,
please [open an issue](../../issues/new) with:

1. The exact combo text as typed into `ANTICATER.app`'s Ctrl/Shift/Alt tab (e.g. `Ctrl+V`)
2. The resulting byte, captured by intercepting the native app's HID writes (see
   `protocol.js` header comments for the report format — the combo code is the last
   non-zero byte before the padding in the `0xFD` "set binding" packet)

## Credits

- Read protocol (query + input-report responses) discovered by
  [x0rloser/anticater_vk01](https://github.com/x0rloser/anticater_vk01)

## License

MIT
