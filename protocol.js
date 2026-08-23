// Reverse-engineered ANTICATER VK-01 dial protocol.
// Device: VID 0x514C / PID 0x8850, HID usage page 0xFF00, usage 0x01.
// Output report ID 0x03. All report bytes below EXCLUDE the report ID
// (WebHID's sendReport(reportId, data) takes it separately).

const REPORT_ID = 0x03;

const CONTROL = {
  scrollLeft: 0x02,
  press: 0x03,
  scrollRight: 0x04,
  pressScrollLeft: 0x05,
  pressScrollRight: 0x06,
};

const BINDING_TYPE = {
  key: 0x01,
  media: 0x02,
  mouse: 0x03, // not implemented in the UI; documented for completeness
};

// Bindings live in one of 3 on-device layers/profiles. We only use layer 1.
const LAYER = 1;

// Standard USB HID keyboard usage IDs (subset in common use).
const KEYCODES = {
  A: 0x04, B: 0x05, C: 0x06, D: 0x07, E: 0x08, F: 0x09, G: 0x0a, H: 0x0b,
  I: 0x0c, J: 0x0d, K: 0x0e, L: 0x0f, M: 0x10, N: 0x11, O: 0x12, P: 0x13,
  Q: 0x14, R: 0x15, S: 0x16, T: 0x17, U: 0x18, V: 0x19, W: 0x1a, X: 0x1b,
  Y: 0x1c, Z: 0x1d,
  '1': 0x1e, '2': 0x1f, '3': 0x20, '4': 0x21, '5': 0x22,
  '6': 0x23, '7': 0x24, '8': 0x25, '9': 0x26, '0': 0x27,
  Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b, Space: 0x2c,
  Minus: 0x2d, Equal: 0x2e, BracketLeft: 0x2f, BracketRight: 0x30,
  Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
  Comma: 0x36, Period: 0x37, Slash: 0x38, CapsLock: 0x39,
  F1: 0x3a, F2: 0x3b, F3: 0x3c, F4: 0x3d, F5: 0x3e, F6: 0x3f,
  F7: 0x40, F8: 0x41, F9: 0x42, F10: 0x43, F11: 0x44, F12: 0x45,
  PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48, Insert: 0x49,
  Home: 0x4a, PageUp: 0x4b, Delete: 0x4c, End: 0x4d, PageDown: 0x4e,
  ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
};

// USB HID Consumer Page usage codes that fit in one byte (0x00-0xFF).
const MEDIACODES = {
  PlayPause: 0xcd,
  Stop: 0xb7,
  PreviousTrack: 0xb6,
  NextTrack: 0xb5,
  FastForward: 0xb3,
  Rewind: 0xb4,
  Record: 0xb2,
  Eject: 0xb8,
  Mute: 0xe2,
  VolumeUp: 0xe9,
  VolumeDown: 0xea,
};

// 16-color palette as observed in a native-app capture. Order/meaning of
// each slot beyond "some fixed palette" is unconfirmed; treated as a fixed
// constant here since palette editing wasn't reverse-engineered.
const LED_PALETTE = [
  [0xff, 0x00, 0x00], [0xff, 0x80, 0x30], [0xff, 0xff, 0x30], [0x00, 0xff, 0x00],
  [0x00, 0xff, 0xff], [0x00, 0x00, 0xff], [0x80, 0x00, 0x80], [0x8b, 0x00, 0x00],
  [0xff, 0xa5, 0x00], [0xff, 0xff, 0x96], [0x7d, 0xff, 0x00], [0x00, 0x8b, 0x8b],
  [0x00, 0x00, 0x8b], [0xff, 0x00, 0xff], [0xff, 0x66, 0x66], [0xff, 0xc8, 0x64],
];

const LED_MODE_COUNT = 6;

// Ctrl/Shift/Alt-style combos from ANTICATER.app's own text-entry tab. These
// don't decompose into modifier bits on this device -- each combo is an
// opaque single-byte code (type=key) outside the normal HID usage range,
// captured individually from the native app. Extend as more are captured.
const COMBO_CODES = {
  "Ctrl+C": 0xf1,
};

function buildBindPackets(controlId, type, code, layer = LAYER) {
  const set = new Uint8Array(64);
  set[0] = 0xfd;
  set[1] = controlId;
  set[2] = layer;
  set[3] = type;
  set[4] = 0x00;
  set[5] = type;
  set[6] = 0x00;
  set[7] = 0x00;
  set[8] = code;

  const term = new Uint8Array(64);
  term[0] = 0xfd;
  term[1] = 0xfe;
  term[2] = 0xff;

  return [set, term];
}

function buildLedPackets(mode, palette = LED_PALETTE) {
  const packets = [];
  for (let idx = 0; idx < 3; idx++) {
    const p = new Uint8Array(64);
    p[0] = 0xfe;
    p[1] = 0xb0;
    p[2] = idx;
    p[3] = idx === 0 ? mode : 0x00;
    let off = 4;
    for (const [r, g, b] of palette) {
      p[off++] = r;
      p[off++] = g;
      p[off++] = b;
    }
    packets.push(p);
  }
  return packets;
}

// ---------------------------------------------------------------------
// Reading state back from the device. Unlike the write side (independently
// reverse-engineered via debugger), this read protocol comes from
// x0rloser's https://github.com/x0rloser/anticater_vk01, which found the
// device responds to queries via plain input reports rather than
// GET_FEATURE requests -- which is why we missed it entirely at first.
// ---------------------------------------------------------------------

// Must be sent (and its single response read) before other commands are
// reliable. Purpose beyond "wakes the device up" is unconfirmed.
function buildInitPacket() {
  const p = new Uint8Array(64);
  p[0] = 0xfb;
  p[1] = 0xfb;
  p[2] = 0xfb;
  return p;
}

// One response packet.
function buildLedModeQueryPacket() {
  const p = new Uint8Array(64);
  p[0] = 0xfa;
  p[1] = 0xb0;
  p[2] = 0x00;
  return p;
}

function parseLedModeResponse(data) {
  // data: DataView of the input report (report ID already stripped by WebHID)
  const mode = data.getUint8(1);
  const palette = [];
  for (let off = 2; off + 2 < data.byteLength; off += 3) {
    palette.push([data.getUint8(off), data.getUint8(off + 1), data.getUint8(off + 2)]);
  }
  return { mode, palette };
}

// Requesting layer settings triggers LAYER_SETTINGS_RESPONSE_COUNT response
// packets, one per key slot on the device (this firmware is shared across
// ANTICATER products with more physical keys than the VK-01 dial has).
const LAYER_SETTINGS_RESPONSE_COUNT = 0x19;

function buildLayerQueryPacket(layer = LAYER) {
  const p = new Uint8Array(64);
  p[0] = 0xfa;
  p[1] = LAYER_SETTINGS_RESPONSE_COUNT;
  p[2] = 0x00;
  p[3] = layer;
  return p;
}

// Mirrors buildBindPackets' layout: [0]=0xfa [1]=key slot [2]=layer
// [3]=type [4..7] reserved/uncertain [8]=code low byte [11]=code high byte.
function parseLayerSettingEntry(data) {
  return {
    controlId: data.getUint8(1),
    layer: data.getUint8(2),
    type: data.getUint8(3),
    code: data.getUint8(8) | (data.getUint8(11) << 8),
  };
}
