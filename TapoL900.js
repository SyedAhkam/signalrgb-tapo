// =============================================================================
// Tapo L900 Light Strip — SignalRGB Plugin
// Requires: tapo-rest running locally (https://github.com/ClementNerma/tapo-rest)
// =============================================================================

import { http } from "network";

// -- Configuration ------------------------------------------------------------
// Edit these to match your tapo-rest setup

const SERVER      = "http://127.0.0.1:7000";   // tapo-rest base URL
const PASSWORD    = "qel4a9xyg5";     // server_password from config
const DEVICE_NAME = "desk-light";        // device name from config
const DEVICE_TYPE = "l900";                     // route prefix (check GET /actions)

// How many canvas frames to skip between HTTP calls.
// 30fps default in SignalRGB → 6 = ~5 updates/sec. Raise if the bulb struggles.
const FRAME_SKIP  = 6;

// Minimum color delta (0–100) before we bother sending a new command.
// Reduces hammering the device when the canvas is mostly static.
const MIN_DELTA   = 3;

// =============================================================================

let sessionToken   = null;
let frameCounter   = 0;
let lastHue        = -1;
let lastSat        = -1;
let lastBri        = -1;

// -- Device identity ----------------------------------------------------------

export function Name()      { return "Tapo L900 (tapo-rest)"; }
export function Publisher() { return "SignalRGB Community"; }
export function Version()   { return "1.0.0"; }
export function Type()      { return "network"; }

// Canvas size — wide strip shape. Adjust to taste.
export function Size()         { return [20, 2]; }
export function LedNames()     { return ["Strip"]; }
export function LedPositions() { return [[10, 1]]; }

export function ControllableParameters() {
    return [
        {
            property: "LightingMode",
            group:    "lighting",
            label:    "Lighting Mode",
            type:     "combobox",
            values:   ["Canvas", "Forced"],
            default:  "Canvas"
        },
        {
            property: "forcedColor",
            group:    "lighting",
            label:    "Forced Color",
            type:     "color",
            default:  "0099ff"
        },
        {
            property: "brightness",
            group:    "lighting",
            label:    "Brightness (%)",
            type:     "number",
            min:      "1",
            max:      "100",
            step:     "1",
            default:  "100"
        }
    ];
}

// -- Lifecycle ----------------------------------------------------------------

export function Initialize() {
    login();
}

export function Render() {
    if (sessionToken === null) {
        // Retry login if we don't have a token yet
        login();
        return;
    }

    frameCounter++;
    if (frameCounter < FRAME_SKIP) return;
    frameCounter = 0;

    let r, g, b;

    if (LightingMode === "Forced") {
        [r, g, b] = hexToRgb(forcedColor);
    } else {
        [r, g, b] = averageCanvas();
    }

    const [h, s, v] = rgbToHsv(r, g, b);

    // Scale brightness by the user slider
    const scaledBri = Math.round(v * (parseInt(brightness) / 100));

    // Skip send if nothing meaningful changed
    if (
        Math.abs(h - lastHue) < MIN_DELTA &&
        Math.abs(s - lastSat) < MIN_DELTA &&
        Math.abs(scaledBri - lastBri) < MIN_DELTA
    ) return;

    lastHue = h;
    lastSat = s;
    lastBri = scaledBri;

    sendColor(h, s, scaledBri);
}

export function Shutdown() {
    // Return to a neutral warm white so the strip doesn't go dark
    if (sessionToken) {
        apiGet(`/actions/${DEVICE_TYPE}/set-color-temperature?device=${DEVICE_NAME}&color_temperature=3000`);
    }
}

// -- Helpers ------------------------------------------------------------------

function login() {
    try {
        const response = http.post(
            `${SERVER}/login`,
            JSON.stringify({ password: PASSWORD }),
            { "Content-Type": "application/json" }
        );

        if (response && response.body) {
            // tapo-rest returns the raw session ID as a string
            sessionToken = response.body.trim().replace(/^"|"$/g, "");
        }
    } catch (e) {
        sessionToken = null;
    }
}

function sendColor(hue, saturation, bri) {
    // Turn on first if needed, then set hue+sat, then brightness
    // Adjust route names below to match what GET /actions returns for your server
    if (bri === 0) {
        apiGet(`/actions/${DEVICE_TYPE}/off?device=${DEVICE_NAME}`);
        return;
    }

    apiGet(`/actions/${DEVICE_TYPE}/on?device=${DEVICE_NAME}`);
    apiGet(`/actions/${DEVICE_TYPE}/set-hue-saturation?device=${DEVICE_NAME}&hue=${hue}&saturation=${saturation}`);
    apiGet(`/actions/${DEVICE_TYPE}/set-brightness?device=${DEVICE_NAME}&level=${bri}`);
}

function apiGet(path) {
    try {
        const response = http.get(
            `${SERVER}${path}`,
            { "Authorization": `Bearer ${sessionToken}` }
        );

        // If we get a 401, our session expired — re-login next frame
        if (response && response.status === 401) {
            sessionToken = null;
        }
    } catch (e) {
        // Swallow errors; the device may be temporarily unreachable
    }
}

function averageCanvas() {
    const [w, h] = Size();
    let rSum = 0, gSum = 0, bSum = 0;
    let count = 0;

    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const col = device.color(x, y);
            rSum += (col >> 16) & 0xff;
            gSum += (col >> 8)  & 0xff;
            bSum += col         & 0xff;
            count++;
        }
    }

    return [
        Math.round(rSum / count),
        Math.round(gSum / count),
        Math.round(bSum / count)
    ];
}

// RGB (0–255) → HSV where H=0–360, S=0–100, V=0–100
function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;

    const max  = Math.max(r, g, b);
    const min  = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff !== 0) {
        if      (max === r) h = 60 * (((g - b) / diff) % 6);
        else if (max === g) h = 60 * (((b - r) / diff) + 2);
        else                h = 60 * (((r - g) / diff) + 4);
    }
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : (diff / max) * 100;
    const v = max * 100;

    return [Math.round(h), Math.round(s), Math.round(v)];
}

function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
