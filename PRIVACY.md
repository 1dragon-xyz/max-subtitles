# Privacy Policy for Max VietSub

*Last updated: November 2026*

**Max VietSub** ("the Extension") is committed to protecting your privacy. This Privacy Policy describes how the Extension handles information when you use it on HBO Max (`hbomax.com` and `max.com`).

---

## 1. Information Collection and Use

- **No Personal Data Collected**: The Extension does **not** collect, store, transmit, or sell any personally identifiable information (PII), browsing history, account credentials, payment information, or viewing habits.
- **Local Storage**: The Extension uses Chrome's `storage.sync` and `storage.local` APIs exclusively to:
  1. Save your user display preferences (subtitle font size, toggle state).
  2. Cache translated dialogue text locally on your device to prevent redundant network requests and provide instant 0ms subtitle playback when rewinding scenes.
- **Network Requests**: When a video is playing with English captions enabled, dialogue text cues are sent to Google's translation endpoint (`https://translate.googleapis.com/`) solely to generate the Vietnamese translation. No user identifiers, cookies, or video account details are transmitted with these requests.

---

## 2. Permissions Justification

In compliance with the Chrome Web Store Developer Program Policies:

| Permission | Purpose |
|---|---|
| `storage` | Saves user UI preferences (font size, toggle) and maintains local LRU translation cache. |
| `activeTab` | Sends settings changes from the popup UI to the active HBO Max video tab. |
| `*://*.hbomax.com/*` & `*://*.max.com/*` | Enables player detection and subtitle rendering on HBO Max playback pages. |
| `https://translate.googleapis.com/*` | Allows the background service worker to fetch translation of dialogue cues. |

---

## 3. Third-Party Services

The Extension interacts with:
- **Google Translate API**: Used solely for machine translation of subtitle dialogue cues. Subject to [Google's Privacy Policy](https://policies.google.com/privacy).

---

## 4. Open Source Transparency

Max VietSub is open-source software licensed under the MIT License. You can inspect the entire codebase, including all network calls and storage handling, on GitHub.

---

## 5. Contact

If you have any questions or concerns regarding this Privacy Policy, please open an issue on the project's GitHub repository.
