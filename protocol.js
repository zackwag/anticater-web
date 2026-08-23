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
  // Tried binding controls 2-6 to this: the write succeeds but the device
  // never actually performs a mouse action. Likely only accepted by a
  // different control ID belonging to the separate swipe pad, not the
  // dial gestures. Not implemented in the UI as a result.
  mouse: 0x03,
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
  // Rarely on physical keyboards, but useful for binding dials to keys that
  // won't collide with anything else -- e.g. running multiple knobs.
  F13: 0x68, F14: 0x69, F15: 0x6a, F16: 0x6b, F17: 0x6c, F18: 0x6d,
  F19: 0x6e, F20: 0x6f, F21: 0x70, F22: 0x71, F23: 0x72, F24: 0x73,
};

// USB HID Consumer Page usage codes. Most fit in one byte (0x00-0xFF); a few
// (like Calculator) need the full 2 bytes, encoded across positions 8 and 11
// of the bind packet.
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
  BrightnessUp: 0x6f,
  BrightnessDown: 0x70,
  Calculator: 0x192, // 2-byte code, from x0rloser/anticater_vk01
};

// Mouse button codes (type=mouse). From x0rloser/anticater_vk01.
const MOUSE_CODES = {
  LeftClick: 0x01,
  RightClick: 0x02,
  MiddleClick: 0x04,
};

// Default colors for the 6 individually-addressable LEDs used by Mode 3.
// This exact rainbow is what the device ships with; matches x0rloser's
// captured default exactly, and the first 6 entries of our own earlier
// (over-broad, 16-color) capture -- the remaining 10 we used to send were
// just unused buffer space, not a real palette.
const LED_DEFAULT_COLORS = [
  [0xff, 0x00, 0x00], [0xff, 0x80, 0x30], [0xff, 0xff, 0x30],
  [0x00, 0xff, 0x00], [0x00, 0xff, 0xff], [0x00, 0x00, 0xff],
];

const LED_MODE_COUNT = 6;
const LED_CUSTOM_COLOR_MODE = 3;

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
  set[4] = type === BINDING_TYPE.mouse ? 0x01 : 0x00; // mouse flag, from x0rloser/anticater_vk01
  set[5] = type;
  set[6] = 0x00;
  set[7] = 0x00;
  set[8] = code & 0xff;
  set[11] = (code >> 8) & 0xff; // high byte, for 2-byte codes like Calculator

  const term = new Uint8Array(64);
  term[0] = 0xfd;
  term[1] = 0xfe;
  term[2] = 0xff;

  return [set, term];
}

function buildLedPackets(mode, colors = LED_DEFAULT_COLORS) {
  const packets = [];
  for (let idx = 0; idx < 3; idx++) {
    const p = new Uint8Array(64);
    p[0] = 0xfe;
    p[1] = 0xb0;
    p[2] = idx;
    p[3] = idx === 0 ? mode : 0x00;
    let off = 4;
    for (const [r, g, b] of colors) {
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
  const colors = [];
  for (let i = 0; i < 6; i++) {
    const off = 2 + i * 3;
    colors.push([data.getUint8(off), data.getUint8(off + 1), data.getUint8(off + 2)]);
  }
  return { mode, colors };
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
