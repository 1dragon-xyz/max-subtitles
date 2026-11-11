# Max VietSub (Phụ Đề Tiếng Việt Cho HBO Max)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Tests: 25/25 Passing](https://img.shields.io/badge/Tests-25%2F25%20Passing-brightgreen.svg)](tests/)

A lightweight, high-performance, open-source Chrome Extension (Manifest V3) that provides pure, natural Vietnamese subtitles on **HBO Max** (`hbomax.com` and `max.com`) by translating built-in English subtitles in real-time.

---

## Features

- **Pure Vietnamese Subtitles**: Replaces HBO Max's native English captions with clean, readable Vietnamese subtitles.
- **Zero-Friction / Fully Automated**: No need to search, download, or drag-and-drop external `.srt` files. Works directly off HBO's official caption streams.
- **3-Layer Caption Interception**:
  1. `MAIN` world page hook intercepting `TextTrack.prototype.addCue`, `fetch`, and `XMLHttpRequest` WebVTT/TTML streams.
  2. Native HTML5 `video.textTracks` active cue monitoring.
  3. Filtered DOM observer that isolates dialogue text while preserving episode metadata (`M1 T1: Mở Đầu`) and UI controls.
- **Intelligent 2-Layer Caching**: In-memory LRU cache backed by `chrome.storage.local`. Rewound scenes load with **0ms latency** and **zero network requests**.
- **Vietnamese Diacritic Protection**: Detects pre-existing Vietnamese text to prevent reverse-translation.
- **Fullscreen Compatible**: Automatically attaches inside `document.fullscreenElement` to prevent subtitle clipping.
- **Popup Customization**: Easily toggle subtitles on/off and scale font size with live preview presets.

---

## Translation Engine

Max VietSub utilizes Google's Neural Machine Translation (NMT) infrastructure via lightweight, low-latency background requests (`translate.googleapis.com`):
- **Dialogue-Optimized**: Produces natural Vietnamese translations for conversational dialogue and idioms.
- **Noise & Audio Filtering**: Automatically filters out bracketed non-speech sound descriptions (`[LAUGHTER]`, `(DOOR OPENS)`, `♪ music ♪`).
- **Debounced & Deduplicated**: Only unique dialogue cues are dispatched, and identical lines are resolved instantly from cache.

---

## Installation Guide (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/<your-username>/max-vietsub.git
   cd max-vietsub
   ```
2. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (top-left button).
5. Select this project folder (`max-vietsub`).
6. Open any title on [HBO Max](https://hbomax.com) or [Max.com](https://max.com), make sure English subtitles (`CC`) are turned **ON** in the player menu, and Vietnamese subtitles will display automatically!

---

## Building for Chrome Web Store

To build a clean, production-ready `.zip` archive for Chrome Web Store upload:

```bash
npm run build
```

This generates `dist/max-vietsub-v1.0.0.zip` containing only production runtime assets (`manifest.json`, `src/`, `icons/`, `LICENSE`, `README.md`) without development test files.

---

## Running Tests

Run the native automated test suite (`node:test`):

```bash
npm test
```

---

## Chrome Web Store Submission Checklist

When uploading to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole):
- **Package**: Upload `dist/max-vietsub-v1.0.0.zip`.
- **Category**: Accessibility or Photos & Video.
- **Privacy Policy**: Link to `PRIVACY.md` in your GitHub repository.
- **Single Purpose**: "Translates English subtitles into Vietnamese in real-time on HBO Max."
- **Permission Justifications**:
  - `storage`: Saves font size preferences and local translation cache.
  - `activeTab`: Relays settings changes to the active video player tab.
  - Host permissions (`*://*.max.com/*`, `*://*.hbomax.com/*`): Injects subtitle overlay onto HBO Max video player.
  - Host permission (`https://translate.googleapis.com/*`): Translates dialogue cues from English to Vietnamese.

---

## License

This project is licensed under the [MIT License](LICENSE).
