# Max VietSub (Phụ Đề Tiếng Việt Cho HBO Max)

A lightweight, high-performance Chrome Extension (Manifest V3) that provides pure, natural Vietnamese subtitles on **HBO Max** (`hbomax.com` and `max.com`).

---

## Key Features

1. **Pure Vietnamese Subtitles**:
   - Automatically hides HBO's native English captions and renders clean, sharp Vietnamese subtitles in their place.
   - High-contrast typography with dark outline/shadow and semi-transparent backdrop for maximum readability across light and dark video scenes.

2. **Zero-Friction & Fully Automated**:
   - No need to download, search, or drag-and-drop external `.srt` files.
   - Leverages HBO Max's built-in English captions/text tracks, translating them into Vietnamese in real-time.

3. **Intelligent Caching**:
   - Dual-layer LRU cache (in-memory + local storage).
   - Rewinding or replaying scenes incurs **0ms latency and 0 API calls**.

4. **Fullscreen Resilient**:
   - Automatically detects player fullscreen events (`fullscreenchange`) and reparents the subtitle overlay into the active fullscreen container. Subtitles never disappear or get occluded in fullscreen mode.

5. **Customizable**:
   - Click the extension icon in Chrome toolbar to toggle subtitles on/off or scale font size (Small, Medium, Large, Extra Large).

---

## Installation Guide (Developer Mode)

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in your address bar.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select this directory: `/home/anhdhnguyen/code/hbo-sub`.
6. Navigate to [hbomax.com](https://hbomax.com) or [max.com](https://max.com), play your movie or TV series (e.g. *Friends*), ensure captions/subtitles are turned ON in the HBO player, and Vietnamese subtitles will automatically appear!

---

## Running Tests

The test suite runs using Node.js native test runner (`node:test`):

```bash
npm test
```
