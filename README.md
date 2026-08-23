# anticater-web

An unofficial, browser-based configurator for the ANTICATER dial/macro-pad, built as a
replacement for the bundled `ANTICATER.app` (which requires Rosetta and is fairly
clunky). Uses the [WebHID API](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API),
so it only works in Chromium-based browsers (Chrome, Edge, Opera).

This is **not affiliated with or endorsed by the device's manufacturer**. The protocol
was reverse-engineered by intercepting `libhidapi` calls in the native app with a
debugger — see [`protocol.js`](./protocol.js) for the documented wire format.

## Using it

WebHID requires a secure context, so you can't just open `index.html` as a `file://`
URL. Serve the folder locally and open it from `localhost`:

```sh
python3 -m http.server 8743
```

Then open `http://localhost:8743/` in Chrome, Edge, or Opera, click **Connect device**,
and pick the device from the browser's picker (it'll show up as "USB Composite Device"
— that's the device's own USB descriptor, not something this app controls).

## What it supports

- Binding a keyboard key or media key to each of the dial's 5 gestures (Scroll Left,
  Press, Scroll Right, Press+Scroll Left, Press+Scroll Right)
- A small set of Ctrl/Shift/Alt-style combos (see below — this device uses a fixed
  lookup table, not composable modifier bits, so only combos that have been captured
  are supported)
- Selecting one of the 6 built-in LED modes
- Exporting/importing your configuration as JSON (the device has no readable
  persisted state, so this is the only backup mechanism available)

Not supported (out of scope for now): the Procreate action-preset tab, the delay/macro
recording tab, and RGB palette editing.

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

## License

MIT
