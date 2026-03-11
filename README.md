# SignalRGB — Tapo Plugin

A community plugin for [SignalRGB](https://signalrgb.com) that syncs TP-Link Tapo smart lights to your canvas lighting in real time.

---

## Supported Devices

| Model | Type | LEDs | Addressable |
|---|---|---|---|
| L900, L920, L930 | RGBIC light strip | 40 (averaged to one color) | ❌ See below |
| L530, L535, L630 | Color bulb | 1 | — |
| L510, L520, L610 | Dimmable white bulb | 1 | — |
| P100, P110, etc. | Smart plug (on/off only) | 1 | — |

Any device registered in tapo-rest will be auto-discovered — including models not listed above (they'll be treated as on/off switches).

> **Tested hardware:** L900 only. Other models are implemented based on the tapo-rest API but have not been verified. Community reports welcome.

---

## Prerequisites

### 1. tapo-rest

This plugin does **not** talk to your Tapo devices directly. It uses [tapo-rest](https://github.com/ClementNerma/tapo-rest) as a local REST bridge.

Follow the tapo-rest setup guide to:
- Register your Tapo account credentials
- Add your devices by name (e.g. `desk-light`)
- Start the server (defaults to `127.0.0.1:8000`)

### 2. SignalRGB

[Download SignalRGB](https://signalrgb.com) if you haven't already.

---

## Installation

1. Open SignalRGB → **Settings** → **Addons** → **Add**
2. Paste the URL of this repository and confirm
3. Navigate to the **Devices** tab → **Third Party Services** — the Tapo service panel will appear

---

## Configuration

All settings are saved persistently and survive plugin reloads.

### Connection (service panel)

| Field | Default | Description |
|---|---|---|
| Host | `127.0.0.1` | tapo-rest server address |
| Port | `8000` | tapo-rest server port |
| Password | *(empty)* | tapo-rest login password |

Hit **Apply** to save and immediately reconnect. Devices will be re-discovered automatically.

### Rendering (service panel)

| Field | Default | Description |
|---|---|---|
| Frame Skip | `6` | Frames between color sends. `6` ≈ 5 fps at SignalRGB's 30 fps tick. Lower = more responsive, more API calls. |
| Min Delta | `3` | Minimum HSV change (0–100) required to trigger a send. `0` sends every frame (after skip). Higher = less chatter. |

### Per-device (device settings panel)

| Setting | Default | Description |
|---|---|---|
| Lighting Mode | `Canvas` | `Canvas` syncs to screen average; `Forced` uses a fixed color |
| Forced Color | `#0099ff` | Color used when Lighting Mode is set to Forced |
| Brightness | `100%` | Scales the brightness output (1–100%) |

---

## How It Works

```
SignalRGB canvas
      │
      ▼  (every Nth frame)
  averageCanvas()         ← reads LED channel colors
      │
      ▼
  rgbToHsv()              ← convert to HSV
      │
      ▼
  delta check             ← skip if color hasn't changed enough
      │
      ▼
  tapo-rest REST API
    POST /login           ← authenticate (token cached, re-auth on 401)
    GET  /actions/{type}/on
    GET  /actions/{type}/set-hue-saturation
    GET  /actions/{type}/set-brightness
```

The plugin uses SignalRGB's **network device / SubdeviceController** model. A single discovery service authenticates with tapo-rest, fetches the device list, and registers each device independently into the SignalRGB layout.

---

## Development

No build step, no package manager. The plugin is plain JavaScript loaded directly by SignalRGB.

```
Tapo.js     ← plugin logic (discovery service + device render loop)
Tapo.qml    ← service panel UI (config cards + device list)
```

To iterate:
1. Edit `Tapo.js` or `Tapo.qml`
2. For QML-only changes: SignalRGB hot-reloads the interface automatically when the file changes
3. For JS changes: **disable and re-enable** the plugin in SignalRGB (or restart) to reload the service

### Adding a new device model

Edit `deviceCaps()` in `Tapo.js`:

```js
function deviceCaps(type) {
    const t = type.toLowerCase();
    if (/^l9(00|20|30)/.test(t)) return { color: true,  dim: true,  leds: 40 };
    if (/^l(530|535|630)/.test(t)) return { color: true,  dim: true,  leds: 1  };
    if (/^l(510|520|610)/.test(t)) return { color: false, dim: true,  leds: 1  };
    return                                 { color: false, dim: false, leds: 1  };
}
```

| Flag | Meaning |
|---|---|
| `color: true` | Device supports `set-hue-saturation` |
| `dim: true` | Device supports `set-brightness` |
| `leds` | Number of LEDs to register in the SignalRGB layout |

---

## Known Limitations

### No per-segment (addressable) control

All RGBIC strips — including the L900, L920, and L930 — are currently driven as a **single solid color**, computed by averaging the SignalRGB canvas. The strip is registered as 40 LEDs in the layout intentionally, to give it a wider canvas footprint for a more representative color sample — not because 40 colors are sent to the hardware. Per-segment color control is not supported.

This is a limitation of the Tapo web service, not the plugin itself:

- **L900** — Single color only by design. TP-Link does not expose per-segment control for this model at the hardware level. The entire strip always shows one solid color.

- **L920 / L930** — These strips do have individually addressable segments, but TP-Link's Tapo web service does not expose per-segment color control through its API. Until the service exposes such an endpoint, per-segment support cannot be implemented.

---

## License

MIT — do whatever you want, attribution appreciated.
