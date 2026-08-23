const VENDOR_ID = 0x514c;
const PRODUCT_ID = 0x8850;
const USAGE_PAGE = 0xff00;

const CONTROL_LABELS = {
  scrollLeft: "Scroll Left",
  press: "Press",
  scrollRight: "Scroll Right",
  pressScrollLeft: "Press + Scroll Left",
  pressScrollRight: "Press + Scroll Right",
};

// Overrides for names that shouldn't just be space-split (symbols, acronyms).
const LABEL_OVERRIDES = {
  Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
  Backslash: "\\", Semicolon: ";", Quote: "'", Backquote: "`",
  Comma: ",", Period: ".", Slash: "/",
  ArrowLeft: "← Left", ArrowRight: "→ Right", ArrowUp: "↑ Up", ArrowDown: "↓ Down",
  PlayPause: "Play / Pause",
  Backspace: "Bksp",
};

// Actual on-device appearance, confirmed by observation. No CSS animation
// per user request — direction (CW/CCW) is conveyed via label text only.
const LED_MODE_APPEARANCE = {
  1: { label: "Mode 1 (White)", background: "#f5f5f5", darkText: true },
  2: { label: "Mode 2 (Green)", background: "#2ecc40" },
  3: { label: "Mode 3 (Reactive)", background: "#1c1f25", border: "2px dashed #4f8cff" },
  4: {
    label: "Mode 4\n(Clockwise)",
    background: "conic-gradient(red, orange, yellow, limegreen, cyan, blue, violet, red)",
  },
  5: {
    label: "Mode 5\n(Counter-Clockwise)",
    background: "conic-gradient(red, violet, blue, cyan, limegreen, yellow, orange, red)",
  },
};

function humanize(name) {
  if (LABEL_OVERRIDES[name]) return LABEL_OVERRIDES[name];
  // Insert a space between a lowercase/digit and a following uppercase letter.
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

// Derive a display label from (type, code) rather than trusting stored text,
// so labels stay correct even if humanize() rules change after a binding
// was saved to localStorage.
function labelFor(type, code) {
  if (type === BINDING_TYPE.key) {
    const combo = Object.keys(COMBO_CODES).find((k) => COMBO_CODES[k] === code);
    if (combo) return combo;
  }
  const table = type === BINDING_TYPE.media ? MEDIACODES : KEYCODES;
  const name = Object.keys(table).find((k) => table[k] === code);
  return name ? humanize(name) : `code 0x${code.toString(16)}`;
}

const STORAGE_KEY = "anticater-web-state-v1";

let device = null;

const state = loadState();
if (!state.ledColors) state.ledColors = LED_DEFAULT_COLORS.map((c) => [...c]);
if (!state.ledPresets) state.ledPresets = {};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { bindings: {}, ledMode: null, ledColors: LED_DEFAULT_COLORS, ledPresets: {} };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- UI helpers ----------

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let toastTimer = null;
function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function setConnected(isConnected) {
  $("#statusDot").classList.toggle("connected", isConnected);
  $("#statusText").textContent = isConnected
    ? "ANTICATER Dial"
    : "Not connected";
  $("#connectBtn").textContent = isConnected ? "Disconnect" : "Connect device";
  $("#mainUI").style.display = isConnected ? "block" : "none";
  $("#disconnectedNotice").style.display = isConnected ? "none" : "block";
}

// ---------- device I/O ----------

async function sendPackets(packets) {
  for (const p of packets) {
    await device.sendReport(REPORT_ID, p);
  }
}

// Sends one packet, then collects `count` subsequent input reports.
// WebHID delivers responses as events, not a blocking read, so this just
// wraps that in a promise with a timeout.
async function sendReportWithRetry(dev, packet, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      await dev.sendReport(REPORT_ID, packet);
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

function sendAndCollectReports(dev, packet, count, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const results = [];
    const timer = setTimeout(() => {
      dev.removeEventListener("inputreport", onReport);
      reject(new Error(`timed out after ${results.length}/${count} response(s)`));
    }, timeoutMs);
    function onReport(event) {
      results.push(event.data);
      if (results.length >= count) {
        clearTimeout(timer);
        dev.removeEventListener("inputreport", onReport);
        resolve(results);
      }
    }
    dev.addEventListener("inputreport", onReport);
    sendReportWithRetry(dev, packet).catch((err) => {
      clearTimeout(timer);
      dev.removeEventListener("inputreport", onReport);
      reject(err);
    });
  });
}

async function applyBinding(controlName, type, code, label) {
  if (!device) return;
  try {
    const packets = buildBindPackets(CONTROL[controlName], type, code);
    await sendPackets(packets);
    state.bindings[controlName] = { type, code, label };
    saveState();
    renderBindings();
    toast(`${CONTROL_LABELS[controlName] || controlName} → ${label}`);
  } catch (e) {
    console.error(e);
    toast(`Failed to send binding: ${e.message}`, true);
  }
}

function hex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

async function applyLedMode(mode, colors) {
  if (!device) {
    console.warn("applyLedMode: no device connected");
    return;
  }
  const useColors = colors || (mode === LED_CUSTOM_COLOR_MODE ? state.ledColors : undefined);
  try {
    const packets = buildLedPackets(mode, useColors);
    console.log(`applyLedMode(${mode}) sending ${packets.length} packets:`);
    packets.forEach((p, idx) => console.log(`  [${idx}] ${hex(p)}`));
    await sendPackets(packets);
    state.ledMode = mode;
    if (mode === LED_CUSTOM_COLOR_MODE && colors) state.ledColors = colors;
    saveState();
    renderLed();
    toast(mode === 0 ? "LED turned off" : `LED mode ${mode} applied`);
  } catch (e) {
    console.error(e);
    toast(`Failed to send LED mode: ${e.message}`, true);
  }
}

// ---------- connect flow ----------

async function tryReconnectKnownDevice() {
  if (!navigator.hid) return;
  const known = await navigator.hid.getDevices();
  const match = known.find(
    (d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID
  );
  if (match) {
    await openDevice(match);
  }
}

async function syncStateFromDevice(dev) {
  try {
    await sendAndCollectReports(dev, buildInitPacket(), 1, 2000);
  } catch (e) {
    console.warn("init command got no response, continuing anyway:", e);
  }

  let ok = true;

  try {
    const [ledData] = await sendAndCollectReports(dev, buildLedModeQueryPacket(), 1, 2000);
    const { mode, colors } = parseLedModeResponse(ledData);
    if (mode >= 0 && mode < LED_MODE_COUNT) state.ledMode = mode;
    if (colors && colors.length === 6) state.ledColors = colors;
  } catch (e) {
    ok = false;
    console.warn("couldn't read LED mode from device:", e);
  }

  try {
    const reports = await sendAndCollectReports(
      dev, buildLayerQueryPacket(), LAYER_SETTINGS_RESPONSE_COUNT, 3000
    );
    const controlNameById = Object.fromEntries(
      Object.entries(CONTROL).map(([name, id]) => [id, name])
    );
    for (const data of reports) {
      const entry = parseLayerSettingEntry(data);
      console.log("layer entry:", entry, "raw:", hex(new Uint8Array(data.buffer)));
      const controlName = controlNameById[entry.controlId];
      if (!controlName) continue; // not one of our 5 known controls
      if (![BINDING_TYPE.key, BINDING_TYPE.media].includes(entry.type)) continue;
      state.bindings[controlName] = { type: entry.type, code: entry.code };
    }
  } catch (e) {
    ok = false;
    console.warn("couldn't read key bindings from device:", e);
  }

  saveState();
  renderBindings();
  renderLed();
  toast(
    ok ? "Synced current settings from device" : "Couldn't fully read device state — showing cached settings",
    !ok
  );
}

async function openDevice(d) {
  if (!d.opened) await d.open();
  device = d;
  setConnected(true);
  // The device isn't immediately ready for writes right after open() on
  // some platforms; without this, the first few sendReport calls fail
  // with "NotAllowedError: Failed to write the report".
  await new Promise((r) => setTimeout(r, 300));
  await syncStateFromDevice(d);
}

async function connect() {
  if (!navigator.hid) {
    toast("WebHID isn't available. Use Chrome/Edge.", true);
    return;
  }
  if (device) {
    await device.close();
    device = null;
    setConnected(false);
    return;
  }
  try {
    const picked = await navigator.hid.requestDevice({
      filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID, usagePage: USAGE_PAGE }],
    });
    if (picked.length === 0) return;
    await openDevice(picked[0]);
  } catch (e) {
    console.error(e);
    toast(`Connect failed: ${e.message}`, true);
  }
}

// ---------- key / media picker ----------

let activeControl = null;
let activeTab = "key";

function openPicker(controlName) {
  activeControl = controlName;
  $("#pickerTitle").textContent = `Assign: ${CONTROL_LABELS[controlName] || controlName}`;
  $("#pickerOverlay").classList.add("open");
  $("#keySearch").value = "";
  renderKeyGrid("");
}

function closePicker() {
  $("#pickerOverlay").classList.remove("open");
  activeControl = null;
}

function renderKeyGrid(filter) {
  const grid = $("#keyGrid");
  grid.innerHTML = "";
  const f = filter.trim().toUpperCase();
  Object.entries(KEYCODES)
    .filter(([name]) => !f || name.toUpperCase().includes(f))
    .forEach(([name, code]) => {
      const label = humanize(name);
      const btn = document.createElement("button");
      btn.className = "key-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        applyBinding(activeControl, BINDING_TYPE.key, code, label);
        closePicker();
      });
      grid.appendChild(btn);
    });
}

function renderMediaList() {
  const list = $("#mediaList");
  list.innerHTML = "";
  Object.entries(MEDIACODES).forEach(([name, code]) => {
    const label = humanize(name);
    const btn = document.createElement("button");
    btn.className = "media-btn";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      applyBinding(activeControl, BINDING_TYPE.media, code, label);
      closePicker();
    });
    list.appendChild(btn);
  });
}

function switchTab(tab) {
  activeTab = tab;
  $$(".modal-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  $("#keyGrid").style.display = tab === "key" ? "grid" : "none";
  $("#mediaList").style.display = tab === "media" ? "flex" : "none";
  $("#comboPanel").style.display = tab === "combo" ? "block" : "none";
  $("#keySearch").parentElement.style.display = tab === "key" ? "block" : "none";
}

function renderComboList() {
  const list = $("#comboList");
  list.innerHTML = "";
  Object.entries(COMBO_CODES).forEach(([name, code]) => {
    const btn = document.createElement("button");
    btn.className = "media-btn";
    btn.textContent = name;
    btn.addEventListener("click", () => {
      applyBinding(activeControl, BINDING_TYPE.key, code, name);
      closePicker();
    });
    list.appendChild(btn);
  });
}

// ---------- rendering ----------

function renderBindings() {
  Object.keys(CONTROL).forEach((name) => {
    const el = document.querySelector(`[data-value="${name}"]`);
    const b = state.bindings[name];
    el.textContent = b ? labelFor(b.type, b.code) : "—";
  });
}

function renderLed() {
  $$(".led-swatch").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.mode) === state.ledMode);
  });
  renderLedCustomSection();
}

function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const BUILT_IN_PRESETS = {
  Rainbow: LED_DEFAULT_COLORS,
  "All White": Array.from({ length: 6 }, () => [0xff, 0xff, 0xff]),
  "All Off": Array.from({ length: 6 }, () => [0x00, 0x00, 0x00]),
};

function allLedPresets() {
  return { ...BUILT_IN_PRESETS, ...state.ledPresets };
}

function renderLedCustomSection() {
  const isCustomMode = state.ledMode === LED_CUSTOM_COLOR_MODE;
  $("#ledCustomSection").style.display = isCustomMode ? "block" : "none";
  if (!isCustomMode) return;
  renderLedColorRow();
  renderLedPresetRow();
}

function renderLedColorRow() {
  const row = $("#ledColorRow");
  row.innerHTML = "";
  state.ledColors.forEach((color, i) => {
    const item = document.createElement("div");
    item.className = "led-color-item";
    const input = document.createElement("input");
    input.type = "color";
    input.value = rgbToHex(color);
    input.addEventListener("input", () => {
      const newColors = state.ledColors.map((c, idx) => (idx === i ? hexToRgb(input.value) : c));
      applyLedMode(LED_CUSTOM_COLOR_MODE, newColors);
    });
    const label = document.createElement("span");
    label.className = "swatch-label";
    label.textContent = `LED ${i + 1}`;
    item.appendChild(input);
    item.appendChild(label);
    row.appendChild(item);
  });
}

function renderLedPresetRow() {
  const row = $("#ledPresetRow");
  row.innerHTML = "";
  Object.entries(allLedPresets()).forEach(([name, colors]) => {
    const el = document.createElement("div");
    el.className = "led-preset";
    el.title = name;
    colors.forEach((c) => {
      const sw = document.createElement("div");
      sw.className = "swatch";
      sw.style.background = rgbToHex(c);
      el.appendChild(sw);
    });
    el.addEventListener("click", () => {
      applyLedMode(LED_CUSTOM_COLOR_MODE, colors.map((c) => [...c]));
    });
    if (state.ledPresets[name]) {
      const remove = document.createElement("button");
      remove.className = "remove";
      remove.textContent = "×";
      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        delete state.ledPresets[name];
        saveState();
        renderLedPresetRow();
      });
      el.appendChild(remove);
    }
    row.appendChild(el);
  });
}

function openPresetNameDialog() {
  $("#presetNameInput").value = "";
  $("#presetNameOverlay").classList.add("open");
  $("#presetNameInput").focus();
}

function closePresetNameDialog() {
  $("#presetNameOverlay").classList.remove("open");
}

function saveCurrentAsPreset() {
  const name = $("#presetNameInput").value.trim();
  if (!name) return;
  state.ledPresets[name] = state.ledColors.map((c) => [...c]);
  saveState();
  renderLedPresetRow();
  toast(`Saved preset "${name}"`);
  closePresetNameDialog();
}

function buildLedGrid() {
  const grid = $("#ledGrid");
  grid.innerHTML = "";
  for (let i = 0; i < LED_MODE_COUNT; i++) {
    const el = document.createElement("div");
    el.className = "led-swatch";
    el.dataset.mode = i;
    const label = document.createElement("span");
    label.className = "led-label";
    if (i === 0) {
      label.textContent = "Off";
      el.style.background = "#000";
    } else {
      const a = LED_MODE_APPEARANCE[i];
      label.textContent = a.label;
      el.style.background = a.background;
      if (a.darkText) el.classList.add("dark-text");
      if (a.border) el.style.border = a.border;
    }
    el.appendChild(label);
    el.addEventListener("click", () => applyLedMode(i));
    grid.appendChild(el);
  }
}

// ---------- wiring ----------

function exportConfig() {
  const payload = { appVersion: APP_VERSION, ...state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "anticater-config.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Config exported");
}

async function importConfig(file) {
  let imported;
  try {
    imported = JSON.parse(await file.text());
  } catch (e) {
    toast("Import failed: not valid JSON", true);
    return;
  }
  if (!imported || typeof imported !== "object") {
    toast("Import failed: unexpected file contents", true);
    return;
  }

  for (const [controlName, b] of Object.entries(imported.bindings || {})) {
    if (!CONTROL[controlName] || !b || typeof b.type !== "number" || typeof b.code !== "number") continue;
    if (device) {
      await applyBinding(controlName, b.type, b.code, labelFor(b.type, b.code));
    } else {
      state.bindings[controlName] = { type: b.type, code: b.code };
    }
  }
  if (typeof imported.ledMode === "number") {
    if (device) {
      await applyLedMode(imported.ledMode);
    } else {
      state.ledMode = imported.ledMode;
    }
  }

  saveState();
  renderBindings();
  renderLed();
  toast(device ? "Config imported and sent to device" : "Config imported — connect a device to apply it");
}

$("#exportBtn").addEventListener("click", exportConfig);
$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importConfig(file);
  e.target.value = "";
});

$("#connectBtn").addEventListener("click", connect);
$("#pickerClose").addEventListener("click", closePicker);
$("#pickerOverlay").addEventListener("click", (e) => {
  if (e.target.id === "pickerOverlay") closePicker();
});
$$(".modal-tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
$("#ledSavePreset").addEventListener("click", openPresetNameDialog);
$("#presetNameClose").addEventListener("click", closePresetNameDialog);
$("#presetNameSave").addEventListener("click", saveCurrentAsPreset);
$("#presetNameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveCurrentAsPreset();
});
$("#presetNameOverlay").addEventListener("click", (e) => {
  if (e.target.id === "presetNameOverlay") closePresetNameDialog();
});
$("#keySearch").addEventListener("input", (e) => renderKeyGrid(e.target.value));

$$(".dial-zone").forEach((zone) => {
  zone.addEventListener("click", () => openPicker(zone.dataset.control));
});

if (navigator.hid) {
  navigator.hid.addEventListener("disconnect", (e) => {
    if (device && e.device === device) {
      device = null;
      setConnected(false);
      toast("Device disconnected", true);
    }
  });
}

function checkWebHidSupport() {
  const supported = !!navigator.hid;
  $("#unsupportedNotice").style.display = supported ? "none" : "block";
  $("#disconnectedNotice").style.display = supported ? "block" : "none";
  $("#connectBtn").disabled = !supported;
  return supported;
}

$("#versionTag").textContent = `v${APP_VERSION}`;
buildLedGrid();
switchTab("key");
renderMediaList();
renderComboList();
renderBindings();
renderLed();
setConnected(false);
if (checkWebHidSupport()) {
  tryReconnectKnownDevice();
}
