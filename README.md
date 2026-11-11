# Max Subtitles (Subtitles for HBO Max)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

A lightweight, high-performance, open-source Chrome Extension (Manifest V3) that provides clean, customizable subtitles and live translation on **HBO Max** (`hbomax.com` and `max.com`).

---

## Features

- **Clean Subtitles**: Replaces HBO Max's native English captions with clean, readable, high-contrast subtitles.
- **Adaptive 1–2s Auto-Hook & Off**: Automatically activates the English track in background for ~1.5s to capture the subtitle stream, then switches HBO's native subtitle to Off so you enjoy pure subtitles with zero dual-caption overlap.
- **Mid-Video Horizon Pre-Fetching**: Detects when video playback is nearing the buffered subtitle boundary (preventing half-video subtitle dropouts) and seamlessly refreshes the next segment.
- **Zero-Friction / Fully Automated**: No need to search, download, or drag-and-drop external `.srt` files.
- **3-Layer Caption Interception**:
  1. `MAIN` world page hook intercepting `TextTrack.prototype.addCue`, `fetch`, and `XMLHttpRequest` WebVTT/TTML streams.
  2. Native HTML5 `video.textTracks` active cue monitoring.
  3. Filtered DOM observer that isolates dialogue text while preserving episode metadata (`M1 T1: Mở Đầu`) and UI controls.
- **Intelligent 2-Layer Caching**: In-memory LRU cache backed by `chrome.storage.local`. Rewound scenes load with **0ms latency** and **zero network requests**.
- **Vietnamese Diacritic Protection**: Detects pre-existing Vietnamese text to prevent reverse-translation.
- **Fullscreen Compatible**: Automatically attaches inside `document.fullscreenElement` to prevent subtitle clipping.
- **Popup Customization**: Easily toggle subtitles on/off and scale font size with live preview presets.

---

## Installation Guide (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/<your-username>/max-subtitles.git
   cd max-subtitles
   ```
2. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (top-left button).
5. Select this project folder.
6. Open any title on [HBO Max](https://hbomax.com) or [Max.com](https://max.com), and enjoy your subtitles!

---

## Building for Chrome Web Store

To build a clean, production-ready `.zip` archive for Chrome Web Store upload:

```bash
npm run build
```

This generates `dist/max-subtitles-v1.0.0.zip` containing only production runtime assets (`manifest.json`, `src/`, `icons/`, `LICENSE`, `PRIVACY.md`).

---

## Chrome Web Store API v2 Automation

Upload, check draft status, and publish using Chrome Web Store API v2:

```bash
export CWS_PUBLISHER_ID="your_publisher_id"
export CWS_ITEM_ID="your_item_id"

# Check draft validation status
npm run cws:status

# Upload build package
npm run cws:upload

# Submit for review
npm run cws:publish
```

---

## Running Tests

Run the native automated test suite (`node:test`):

```bash
npm test
```

---

## Disclaimer

Max Subtitles is an independent, unofficial open-source extension and is not affiliated with, endorsed by, or sponsored by HBO Max or Warner Bros. Discovery.

---

## License

This project is licensed under the [MIT License](LICENSE).
