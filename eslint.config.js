const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  js.configs.recommended,
  {
    ignores: ["scripts/.venv/**"],
  },
  {
    rules: {
      // Silently ignoring a corrupt/missing localStorage value is intentional.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // index.html loads version.js, protocol.js, and app.js as separate
    // classic <script> tags (no bundler, no modules), so their top-level
    // `const`/`function` declarations share one global scope at runtime.
    // app.js needs to see the names protocol.js and version.js declare.
    files: ["app.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        REPORT_ID: "readonly",
        CONTROL: "readonly",
        BINDING_TYPE: "readonly",
        LAYER: "readonly",
        KEYCODES: "readonly",
        MEDIACODES: "readonly",
        MOUSE_CODES: "readonly",
        LED_DEFAULT_COLORS: "readonly",
        LED_MODE_COUNT: "readonly",
        LED_CUSTOM_COLOR_MODE: "readonly",
        MODIFIER_CODES: "readonly",
        combineModifierKey: "readonly",
        buildBindPackets: "readonly",
        buildLedPackets: "readonly",
        buildInitPacket: "readonly",
        buildLedModeQueryPacket: "readonly",
        parseLedModeResponse: "readonly",
        LAYER_SETTINGS_RESPONSE_COUNT: "readonly",
        buildLayerQueryPacket: "readonly",
        parseLayerSettingEntry: "readonly",
        APP_VERSION: "readonly",
      },
    },
  },
  {
    files: ["version.js"],
    languageOptions: {
      sourceType: "script",
      globals: globals.browser,
    },
  },
  {
    // protocol.js is loaded as a plain <script> in the browser but also
    // require()'d directly by the Node test suite, so it needs both globals.
    files: ["protocol.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["test/**/*.js", "eslint.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
];
