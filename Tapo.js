// =============================================================================
// Tapo — SignalRGB Plugin  v3.0.0
// Supports all tapo-rest devices (L5xx, L6xx, L9xx, P1xx)
// Requires: tapo-rest running locally (https://github.com/ClementNerma/tapo-rest)
// Transport: XMLHttpRequest
// =============================================================================

// Controllable parameter globals — declared as var so the SignalRGB runtime
// can overwrite them; defaults are used until the first Render() injection.
var LightingMode    = "Canvas";
var forcedColor     = "0099ff";
var brightnessScale = "100";

// -- Configuration ------------------------------------------------------------

const HOST     = "127.0.0.1";
const PORT     = 8000;
const PASSWORD = "";

// Minimum canvas frames between sends (~5fps at SignalRGB's default 30fps)
let FRAME_SKIP  = 6;

// Minimum HSV delta (0–100) before sending a new command
let MIN_DELTA   = 3;

let sessionToken   = null;
let frameCounter   = 0;
let requestPending = false;
let lastHue        = -1;
let lastSat        = -1;
let lastBri        = -1;

// -- Device identity ----------------------------------------------------------

export function Name()      { return "Tapo"; }
export function Publisher() { return "SignalRGB Community"; }
export function Version()   { return "3.0.0"; }
export function Type()      { return "network"; }

export function SubdeviceController() { return true; }

export function ImageUrl() { return "https://i.ibb.co/0ytq0n9Q/tapo.jpg"; }

export function DefaultPosition() { return [0, 0]; }
export function DefaultScale()    { return 1.0; }

export function Size() { return [1, 1]; }

// -- Device capability detection ----------------------------------------------

// Returns what a given device type can do.
// color  → supports set-hue-saturation
// dim    → supports set-brightness
// leds   → how many LEDs to register in the channel
function deviceCaps(type) {
    const t = type.toLowerCase();
    if (/^l9(00|20|30)/.test(t)) return { color: true,  dim: true,  leds: 40 }; // RGBIC strips
    if (/^l(530|535|630)/.test(t)) return { color: true,  dim: true,  leds: 1  }; // color bulbs
    if (/^l(510|520|610)/.test(t)) return { color: false, dim: true,  leds: 1  }; // dimmable bulbs
    return                                 { color: false, dim: false, leds: 1  }; // plugs / unknown
}

// -- Discovery service --------------------------------------------------------

export function DiscoveryService() {
    const disc = this;
    let discoveryToken = null;
    this.IconUrl = "https://i.ibb.co/0ytq0n9Q/tapo.jpg";
    let host     = HOST;
    let port     = PORT;
    let password = PASSWORD;

    // Called once when SignalRGB loads the plugin.
    this.Initialize = function() {
        const savedHost      = service.getSetting("tapoRest",   "host");
        const savedPort      = service.getSetting("tapoRest",   "port");
        const savedPass      = service.getSetting("tapoRest",   "password");
        const savedFrameSkip = service.getSetting("tapoRender", "frameSkip");
        const savedMinDelta  = service.getSetting("tapoRender", "minDelta");

        if (savedHost) host      = savedHost;
        if (savedPort) port      = parseInt(savedPort);
        if (savedPass) password  = savedPass;
        if (savedFrameSkip) FRAME_SKIP = parseInt(savedFrameSkip);
        if (savedMinDelta !== undefined && savedMinDelta !== "") MIN_DELTA = parseInt(savedMinDelta);

        disc.host      = host;
        disc.port      = port;
        disc.password  = password;
        disc.frameSkip = FRAME_SKIP;
        disc.minDelta  = MIN_DELTA;

        service.log("[Tapo] Connecting to tapo-rest @ " + host + ":" + port);
        serviceLogin();
    };

    // Called periodically by SignalRGB — announce any pending controllers.
    this.Update = function() {
        for (const cont of service.controllers) {
            const bridge = cont.obj;
            if (!bridge.announced) {
                bridge.announced = true;
                service.log("[Tapo] Announcing: " + bridge.name);
                service.announceController(bridge);
            }
        }
    };

    this.Discovered = function(value) {
        if (service.getController(value.id) === undefined) {
            service.addController(new TapoBridge(value));
        }
    };

    // Called from QML to update and persist the tapo-rest connection config.
    this.setServerConfig = function(newHost, newPort, newPassword) {
        host     = newHost           || host;
        port     = parseInt(newPort) || port;
        password = newPassword       || password;

        service.saveSetting("tapoRest", "host",     host);
        service.saveSetting("tapoRest", "port",     String(port));
        service.saveSetting("tapoRest", "password", password);

        disc.host     = host;
        disc.port     = port;
        disc.password = password;

        // Remove existing controllers and rediscover with new config.
        for (const cont of service.controllers) {
            service.removeController(cont);
        }
        discoveryToken = null;
        serviceLogin();
    };

    // Called from QML to update and persist the render tuning config.
    this.setRenderConfig = function(newFrameSkip, newMinDelta) {
        const fs = parseInt(newFrameSkip);
        const md = parseInt(newMinDelta);
        if (!isNaN(fs) && fs >= 1) FRAME_SKIP = fs;
        if (!isNaN(md) && md >= 0) MIN_DELTA  = md;

        service.saveSetting("tapoRender", "frameSkip", String(FRAME_SKIP));
        service.saveSetting("tapoRender", "minDelta",  String(MIN_DELTA));

        disc.frameSkip = FRAME_SKIP;
        disc.minDelta  = MIN_DELTA;

        // Propagate live to all existing device instances.
        for (const cont of service.controllers) {
            cont.obj.frameSkip = FRAME_SKIP;
            cont.obj.minDelta  = MIN_DELTA;
        }
    };

    function serviceLogin() {
        service.log("[Tapo] POST /login ...");
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `http://${host}:${port}/login`, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            service.log("[Tapo] /login → HTTP " + xhr.status);
            if (xhr.status === 200) {
                discoveryToken = xhr.responseText.trim().replace(/^"|"$/g, "");
                service.log("[Tapo] Discovery token acquired");
                fetchDevices();
            } else {
                service.log("[Tapo] Discovery login failed — body: " + xhr.responseText);
            }
        };
        xhr.send(JSON.stringify({ password: password }));
    }

    function fetchDevices() {
        service.log("[Tapo] GET /devices ...");
        const xhr = new XMLHttpRequest();
        xhr.open("GET", `http://${host}:${port}/devices`, true);
        xhr.setRequestHeader("Authorization", "Bearer " + discoveryToken);
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            service.log("[Tapo] /devices → HTTP " + xhr.status + " — " + xhr.responseText);
            if (xhr.status === 200) {
                const devices = JSON.parse(xhr.responseText);
                service.log("[Tapo] Found " + devices.length + " device(s)");
                for (const dev of devices) {
                    service.log("[Tapo] Device: " + JSON.stringify(dev));
                    disc.Discovered({
                        id:         host + ":" + port + "/" + dev.name,
                        name:       "Tapo " + dev.device_type.toUpperCase() + " – " + dev.name,
                        ip:         host,
                        port:       port,
                        password:   password,
                        deviceName: dev.name,
                        deviceType: dev.device_type.toLowerCase(),
                        frameSkip:  FRAME_SKIP,
                        minDelta:   MIN_DELTA,
                    });
                }
            } else {
                service.log("[Tapo] Failed to fetch devices — body: " + xhr.responseText);
            }
        };
        xhr.send();
    }
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
        this.frameSkip  = value.frameSkip !== undefined ? value.frameSkip : FRAME_SKIP;
        this.minDelta   = value.minDelta  !== undefined ? value.minDelta  : MIN_DELTA;
        this.announced  = false;  // set true by Update() before announcing

        service.log("[Tapo] Controller ready: " + this.name + " @ " + this.ip + ":" + this.port);
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
    const caps = deviceCaps(controller.deviceType);
    device.setName(controller.name);
    device.addChannel("Strip", caps.leds);
    device.log(`[Tapo] [${controller.deviceName}] type=${controller.deviceType} color=${caps.color} dim=${caps.dim} leds=${caps.leds}`);
    login();
}

export function Render() {
    if (sessionToken === null) {
        login();
        return;
    }

    frameCounter++;
    if (frameCounter < controller.frameSkip) return;
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
    const minDelta  = controller.minDelta;

    if (
        Math.abs(h - lastHue)         < minDelta &&
        Math.abs(s - lastSat)         < minDelta &&
        Math.abs(scaledBri - lastBri) < minDelta
    ) return;

    lastHue = h;
    lastSat = s;
    lastBri = scaledBri;

    sendColor(h, s, scaledBri);
}

export function Shutdown() {
    if (!sessionToken) return;
    const dt   = controller.deviceType.toLowerCase();
    const dn   = controller.deviceName;
    const caps = deviceCaps(dt);
    // Reset color devices to warm white; everything else just turns off
    if (caps.color) {
        httpGet(`/actions/${dt}/set-color-temperature?device=${dn}&color_temperature=3000`, null);
    } else {
        httpGet(`/actions/${dt}/off?device=${dn}`, null);
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

    device.log(`[Tapo] [${controller.deviceName}] POST /login ...`);
    httpPost("/login", { password: controller.password }, (status, body) => {
        requestPending = false;
        device.log(`[Tapo] [${controller.deviceName}] /login → HTTP ${status}`);
        if (status === 200) {
            sessionToken = body.trim().replace(/^"|"$/g, "");
            device.log(`[Tapo] [${controller.deviceName}] Session token acquired`);
        } else {
            device.log(`[Tapo] [${controller.deviceName}] Login failed — body: ${body}`);
        }
    });
}

function sendColor(hue, saturation, bri) {
    const dt   = controller.deviceType.toLowerCase();
    const dn   = controller.deviceName;
    const caps = deviceCaps(dt);

    device.log(`[Tapo] [${dn}] sendColor h=${hue} s=${saturation} v=${bri} (color=${caps.color} dim=${caps.dim})`);

    // Turn off when brightness hits zero
    if (bri === 0) {
        requestPending = true;
        httpGet(`/actions/${dt}/off?device=${dn}`, () => { requestPending = false; });
        return;
    }

    requestPending = true;

    function handle401(status) {
        if (status === 401) { sessionToken = null; requestPending = false; return true; }
        return false;
    }

    // All devices: turn on first
    httpGet(`/actions/${dt}/on?device=${dn}`, (s1) => {
        device.log(`[Tapo] [${dn}] /on → HTTP ${s1}`);
        if (handle401(s1)) return;

        if (caps.color) {
            // Color devices: set hue/saturation then brightness
            httpGet(`/actions/${dt}/set-hue-saturation?device=${dn}&hue=${hue}&saturation=${saturation}`, (s2) => {
                if (handle401(s2)) return;
                httpGet(`/actions/${dt}/set-brightness?device=${dn}&level=${bri}`, (s3) => {
                    if (s3 === 401) sessionToken = null;
                    requestPending = false;
                });
            });
        } else if (caps.dim) {
            // Dimmable only: set brightness
            httpGet(`/actions/${dt}/set-brightness?device=${dn}&level=${bri}`, (s2) => {
                if (s2 === 401) sessionToken = null;
                requestPending = false;
            });
        } else {
            // Switch only: on/off already handled above
            requestPending = false;
        }
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
