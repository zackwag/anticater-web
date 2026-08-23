// Tests for the pure protocol functions in protocol.js. Run with:
//   node --test
//
// Fixtures marked "captured" are real byte sequences seen on the wire
// during this project's reverse-engineering (via a debugger hook on the
// native app's libhidapi calls), not synthetic guesses -- they're the
// strongest regression protection we have, since a subtle byte-offset bug
// here would otherwise only show up as "the physical device does the wrong
// thing," which is expensive to notice and debug.

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CONTROL,
  BINDING_TYPE,
  KEYCODES,
  MEDIACODES,
  MODIFIER_CODES,
  LED_DEFAULT_COLORS,
  combineModifierKey,
  buildBindPackets,
  buildLedPackets,
  parseLayerSettingEntry,
} = require("../protocol.js");

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function dataViewFromHex(hex) {
  const bytes = hexToBytes(hex);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

// Report ID byte stripped, matching how WebHID delivers sendReport data.
function withoutReportId(fullHex) {
  return fullHex.slice(2);
}

test("combineModifierKey packs modifier (low byte) and key (high byte)", () => {
  // Ctrl (0xf1) + C (0x06), captured as byte8=0xf1 byte11=0x06.
  assert.equal(combineModifierKey(0xf1, 0x06), 0x06f1);
  assert.equal(combineModifierKey(0xf1, 0x06) & 0xff, 0xf1);
  assert.equal((combineModifierKey(0xf1, 0x06) >> 8) & 0xff, 0x06);
});

test("buildBindPackets: plain key binding matches captured Ctrl+V write", () => {
  // Captured: 03fd03010100020000f100001900000000...
  // control=Press(0x03) layer=1 type=key modifier=Ctrl(0xf1) key=V(0x19)
  const captured = withoutReportId(
    "03fd03010100020000f100001900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
  );
  const code = combineModifierKey(MODIFIER_CODES.ctrl, KEYCODES.V);
  const [set, term] = buildBindPackets(CONTROL.press, BINDING_TYPE.key, code);
  assert.equal(Buffer.from(set).toString("hex"), captured);
  assert.equal(Buffer.from(term).toString("hex"), "fdfeff".padEnd(128, "0"));
});

test("buildBindPackets: media key binding matches captured Play/Pause write", () => {
  // Captured: 03fd03010200020000cd00000000...
  const captured = withoutReportId(
    "03fd03010200020000cd00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
  );
  const [set] = buildBindPackets(CONTROL.press, BINDING_TYPE.media, MEDIACODES.PlayPause);
  assert.equal(Buffer.from(set).toString("hex"), captured);
});

test("buildBindPackets: Cmd+V matches captured write (verified against a working native-app binding)", () => {
  // Captured: 03fd03010100020000f400001900000000...
  const captured = withoutReportId(
    "03fd03010100020000f400001900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
  );
  const code = combineModifierKey(MODIFIER_CODES.meta, KEYCODES.V);
  const [set] = buildBindPackets(CONTROL.press, BINDING_TYPE.key, code);
  assert.equal(Buffer.from(set).toString("hex"), captured);
});

test("buildLedPackets: mode 2 matches captured write's meaningful prefix", () => {
  // Captured, index-0 packet: 03feb00002ff0000ff8030ffff3000ff0000ffff0000ff8000808b0000ffa500ffff967dff00008b8b00008bff00ffff6666ffc864000000...
  // Only the first 22 bytes (opcode+idx+mode + 6-color/18-byte palette) are
  // real; the native app's own capture has non-deterministic uninitialized
  // memory beyond that (documented in LED_DEFAULT_COLORS' comment), which
  // this function correctly zero-pads instead of reproducing.
  const capturedPrefix = withoutReportId("03feb00002ff0000ff8030ffff3000ff0000ffff0000ff");
  const [p0, p1, p2] = buildLedPackets(2);
  assert.equal(Buffer.from(p0.slice(0, capturedPrefix.length / 2)).toString("hex"), capturedPrefix);
  assert.equal(p0.slice(4 + 18).every((b) => b === 0), true);
  // Index 1/2 packets repeat the palette but carry mode=0, not the real mode.
  assert.equal(p1[2], 1);
  assert.equal(p1[3], 0);
  assert.equal(p2[2], 2);
  assert.equal(p2[3], 0);
});

test("buildLedPackets: default palette is 6 colors, 18 bytes total", () => {
  assert.equal(LED_DEFAULT_COLORS.length, 6);
  const [p0] = buildLedPackets(0);
  // Bytes 4..21 (18 bytes) should be the flattened palette; 22+ should be zero.
  const flattened = LED_DEFAULT_COLORS.flat();
  for (let i = 0; i < flattened.length; i++) {
    assert.equal(p0[4 + i], flattened[i]);
  }
  assert.equal(p0[4 + flattened.length], 0);
});

test("parseLayerSettingEntry: decodes a captured read-back entry (Scroll Left = Volume Down)", () => {
  // Captured from a real device read: control=2 layer=1 type=media code=0xea
  const view = dataViewFromHex(
    "fa02010200020000ea00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
  );
  const entry = parseLayerSettingEntry(view);
  assert.deepEqual(entry, { controlId: 0x02, layer: 1, type: BINDING_TYPE.media, code: 0xea });
});

test("parseLayerSettingEntry round-trips a combo binding built by buildBindPackets", () => {
  // The read protocol's field layout is a superset of the write layout
  // ([0]=opcode instead of 0xfd, everything else lines up), so a captured
  // write packet with the opcode swapped is a valid stand-in for a real
  // read-back response.
  const code = combineModifierKey(MODIFIER_CODES.shift, KEYCODES.A);
  const [set] = buildBindPackets(CONTROL.scrollRight, BINDING_TYPE.key, code);
  const asResponse = new Uint8Array(set);
  asResponse[0] = 0xfa; // read responses use a different opcode byte
  const view = new DataView(asResponse.buffer);
  const entry = parseLayerSettingEntry(view);
  assert.equal(entry.controlId, CONTROL.scrollRight);
  assert.equal(entry.type, BINDING_TYPE.key);
  assert.equal(entry.code, code);
});
