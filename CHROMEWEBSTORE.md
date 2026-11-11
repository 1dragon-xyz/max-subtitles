# Chrome Web Store Listing — Max Subtitles

> Last Updated: 2026-11-11

## Store Listing

**Extension Name** [REQUIRED]
Max Subtitles - Subtitles for HBO Max

**Short Description** [REQUIRED]
Provides clean subtitles and live translation on HBO Max and Max.com.

**Detailed Description** [REQUIRED]
Max Subtitles provides clean, high-contrast, customizable subtitles and live translation for movies and series on HBO Max and Max.com.

FEATURES
• Clean Subtitle Display — Replaces original subtitles with clear, readable text styled for maximum contrast against light and dark video scenes.
• Instant Subtitle Sync — Keeps dialogue perfectly synchronized with audio playback even when scrubbing or rewinding.
• Responsive Fullscreen Support — Subtitles stay crisp and properly positioned whether watching in windowed or full-screen mode.
• Customizable Typography — Adjust font size and line styling easily from the toolbar popup menu to suit your screen and distance.
• 0ms Rewind Latency — Locally caches translated lines so repeated scenes display immediately with zero delay.

HOW TO USE
1. Click "Add to Chrome" to install the extension.
2. Open any video on HBO Max or Max.com.
3. Subtitles will automatically appear in your preferred language and styling.
4. Click the extension icon in your browser toolbar to adjust font size or toggle subtitles on/off.

PRIVACY & PERMISSIONS
• This extension does not collect, store, or sell any personal data, viewing history, or account credentials.
• "storage" permission is used solely to save your font size preferences and keep a temporary local cache of dialogue lines on your device.
• Access to hbomax.com and max.com is required to detect playing video streams and display the subtitle overlay.
• Dialogue text is translated via Google Translate without transmitting any user identifiers or cookies.

SUPPORT
Found an issue or have a suggestion? Open an issue on our GitHub repository or contact our developer support.

Disclaimer: Max Subtitles is an independent, unofficial open-source extension and is not affiliated with, endorsed by, or sponsored by HBO Max or Warner Bros. Discovery.

**Category** [REQUIRED]
Accessibility

**Single Purpose** [REQUIRED]
Translates and renders customized subtitles for video playback on HBO Max and Max.com.

**Primary Language** [REQUIRED]
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | icons/icon128.png |
| Extension Icon | 48×48 PNG | ✅ Ready | icons/icon48.png |
| Toolbar Icon | 16×16 PNG | ✅ Ready | icons/icon16.png |
| Screenshot 1 [REQUIRED] | 1280×800 | 🟡 Prepared | store-assets/screenshot1.png |
| Small Promo Tile [RECOMMENDED] | 440×280 | 🟡 Prepared | store-assets/promo-small.png |

---

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `storage` | permissions | Saves user display preferences (font size, on/off state) via chrome.storage.sync and stores a local LRU cache of translated dialogue text on the user device to prevent duplicate network calls. |
| `*://*.hbomax.com/*` | host_permissions | Required to detect video playback and mount the custom subtitle overlay on HBO Max. |
| `*://*.max.com/*` | host_permissions | Required to detect video playback and mount the custom subtitle overlay on Max.com. |
| `https://translate.googleapis.com/*` | host_permissions | Allows the extension background worker to fetch machine translations of dialogue lines. |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|---|---|---|---|---|
| Personally identifiable info | No | No | None | No |
| Health info | No | No | None | No |
| Financial info | No | No | None | No |
| Authentication info | No | No | None | No |
| Personal communications | No | No | None | No |
| Location | No | No | None | No |
| Web history | No | No | None | No |
| User activity | No | No | None | No |
| Website content | No | Only dialogue text | Subtitle translation | Sent strictly to Google Translate API for text translation |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
https://github.com/1dragon-xyz/hbo-sub/blob/main/PRIVACY.md

---

## Distribution

**Visibility**: Public
**Regions**: All regions

---

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0.0 | 2026-11-11 | Initial release: Clean subtitle overlay, adaptive 1-2s auto-hook, mid-video horizon refresh, CWS API v2 support | Draft |
