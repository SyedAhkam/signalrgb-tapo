// =============================================================================
// Tapo L900 Light Strip — SignalRGB Plugin  v2.0.0
// Requires: tapo-rest running locally (https://github.com/ClementNerma/tapo-rest)
// Transport: XMLHttpRequest
// =============================================================================

// Controllable parameter globals — declared as var so the SignalRGB runtime
// can overwrite them; defaults are used until the first Render() injection.
var LightingMode    = "Canvas";
var forcedColor     = "0099ff";
var brightnessScale = "100";

// -- Configuration ------------------------------------------------------------

const HOST        = "127.0.0.1";
const PORT        = 7000;
const PASSWORD    = "qel4a9xyg5";
const DEVICE_NAME = "desk-light";
const DEVICE_TYPE = "l900";

// Minimum canvas frames between sends (~5fps at SignalRGB's default 30fps)
const FRAME_SKIP  = 6;

// Minimum HSV delta (0–100) before sending a new command
const MIN_DELTA   = 3;

let sessionToken   = null;
let frameCounter   = 0;
let requestPending = false;
let lastHue        = -1;
let lastSat        = -1;
let lastBri        = -1;

// -- Device identity ----------------------------------------------------------

export function Name()      { return "Tapo L900"; }
export function Publisher() { return "SignalRGB Community"; }
export function Version()   { return "2.0.0"; }
export function Type()      { return "network"; }

export function SubdeviceController() { return true; }

export function DefaultPosition() { return [0, 0]; }
export function DefaultScale()    { return 1.0; }

export function Size() { return [20, 2]; }

// -- Discovery service --------------------------------------------------------

export function DiscoveryService() {
    // Called once when SignalRGB loads the plugin.
    this.Initialize = function() {
        service.log("[TapoL900] Discovery initializing — announcing " + HOST + ":" + PORT + " / " + DEVICE_NAME);
        this.announce();
    };

    // Called periodically by SignalRGB. Announces pending controllers and
    // re-announces if the controller was lost.
    this.Update = function() {
        for (const cont of service.controllers) {
            const bridge = cont.obj;
            if (!bridge.announced) {
                bridge.announced = true;
                service.log("[TapoL900] Announcing controller: " + bridge.name);
                service.announceController(bridge);
            }
        }

        const id = HOST + ":" + PORT + "/" + DEVICE_NAME;
        if (service.getController(id) === undefined) {
            this.announce();
        }
    };

    // Creates a TapoBridge and registers it with SignalRGB.
    this.Discovered = function(value) {
        if (service.getController(value.id) === undefined) {
            service.addController(new TapoBridge(value));
        }
    };

    this.announce = function() {
        this.Discovered({
            id:         HOST + ":" + PORT + "/" + DEVICE_NAME,
            name:       "Tapo " + DEVICE_TYPE.toUpperCase() + " – " + DEVICE_NAME,
            ip:         HOST,
            port:       PORT,
            password:   PASSWORD,
            deviceName: DEVICE_NAME,
            deviceType: DEVICE_TYPE,
        });
    };
}

// Holds per-device connection state. Passed to the plugin instance as `controller`.
class TapoBridge {
    constructor(value) {
        this.id         = value.id;
        this.name       = value.name;
        this.ip         = value.ip;
        this.port       = value.port;
        this.password   = value.password;
        this.deviceName = value.deviceName;
        this.deviceType = value.deviceType;
        this.announced  = false;  // set true by Update() before announcing

        service.log("[TapoL900] Controller ready: " + this.name + " @ " + this.ip + ":" + this.port);
    }
}

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
            property: "brightnessScale",
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
    device.setName(controller.name);
    device.addChannel("Strip", 40);
    login();
}

export function Render() {
    if (sessionToken === null) {
        login();
        return;
    }

    frameCounter++;
    if (frameCounter < FRAME_SKIP) return;
    frameCounter = 0;

    if (requestPending) return;

    let r, g, b;

    if (LightingMode === "Forced") {
        [r, g, b] = hexToRgb(forcedColor);
    } else {
        [r, g, b] = averageCanvas();
    }

    const [h, s, v] = rgbToHsv(r, g, b);
    const scaledBri = Math.round(v * (parseInt(brightnessScale) / 100));

    if (
        Math.abs(h - lastHue)         < MIN_DELTA &&
        Math.abs(s - lastSat)         < MIN_DELTA &&
        Math.abs(scaledBri - lastBri) < MIN_DELTA
    ) return;

    lastHue = h;
    lastSat = s;
    lastBri = scaledBri;

    sendColor(h, s, scaledBri);
}

export function Shutdown() {
    if (sessionToken) {
        httpGet(
            `/actions/${controller.deviceType}/set-color-temperature?device=${controller.deviceName}&color_temperature=3000`,
            null
        );
    }
}

// -- HTTP helpers -------------------------------------------------------------

// callback(statusCode, responseBody) — called once when the request completes.
function httpRequest(method, path, bodyObj, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `http://${controller.ip}:${controller.port}${path}`, true);

    if (sessionToken) {
        xhr.setRequestHeader("Authorization", "Bearer " + sessionToken);
    }
    if (bodyObj) {
        xhr.setRequestHeader("Content-Type", "application/json");
    }

    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (callback) callback(xhr.status, xhr.responseText);
        }
    };

    xhr.send(bodyObj ? JSON.stringify(bodyObj) : null);
}

// Convenience wrappers
function httpPost(path, bodyObj, callback) {
    httpRequest("POST", path, bodyObj, callback);
}

function httpGet(path, callback) {
    httpRequest("GET", path, null, callback);
}

// -- Auth & color commands ----------------------------------------------------

function login() {
    if (requestPending) return;
    requestPending = true;

    httpPost("/login", { password: controller.password }, (status, body) => {
        requestPending = false;
        if (status === 200) {
            // tapo-rest returns the token as a quoted JSON string
            sessionToken = body.trim().replace(/^"|"$/g, "");
        } else {
            device.log(`[TapoL900] Login failed (HTTP ${status})`);
        }
    });
}

function sendColor(hue, saturation, bri) {
    const dt = controller.deviceType;
    const dn = controller.deviceName;

    if (bri === 0) {
        requestPending = true;
        httpGet(`/actions/${dt}/off?device=${dn}`, () => {
            requestPending = false;
        });
        return;
    }

    requestPending = true;

    // Chain three commands sequentially: on → hue/sat → brightness
    httpGet(`/actions/${dt}/on?device=${dn}`, (s1) => {
        if (s1 === 401) { sessionToken = null; requestPending = false; return; }

        httpGet(
            `/actions/${dt}/set-hue-saturation?device=${dn}&hue=${hue}&saturation=${saturation}`,
            (s2) => {
                if (s2 === 401) { sessionToken = null; requestPending = false; return; }

                httpGet(
                    `/actions/${dt}/set-brightness?device=${dn}&level=${bri}`,
                    (s3) => {
                        if (s3 === 401) { sessionToken = null; }
                        requestPending = false;
                    }
                );
            }
        );
    });
}

// -- Canvas / color helpers ---------------------------------------------------

function averageCanvas() {
    const colors = device.channel("Strip").getColors("Inline"); // [R,G,B, R,G,B, ...]
    const count  = colors.length / 3;
    let rSum = 0, gSum = 0, bSum = 0;

    for (let i = 0; i < colors.length; i += 3) {
        rSum += colors[i];
        gSum += colors[i + 1];
        bSum += colors[i + 2];
    }

    return [
        Math.round(rSum / count),
        Math.round(gSum / count),
        Math.round(bSum / count)
    ];
}

// RGB (0–255) → [H 0–360, S 0–100, V 0–100]
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