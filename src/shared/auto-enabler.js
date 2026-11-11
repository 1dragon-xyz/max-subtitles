/**
 * Max VietSub - Automatic English Subtitle Enabler
 * Safely activates English subtitles in HBO Max's player so dialogue cues flow
 * consistently without requiring the user to manually click player menus every time.
 */

/**
 * Checks whether a given text track represents English subtitles or captions.
 * @param {TextTrack|object} track
 * @returns {boolean}
 */
export function isEnglishTrack(track) {
  if (!track) return false;
  const lang = (track.language || '').toLowerCase().trim();
  const label = (track.label || '').toLowerCase().trim();

  if (lang.startsWith('en') || lang === 'eng') return true;
  if (label.includes('english') || label.includes('en [cc]') || label.includes('en cc')) return true;

  return false;
}

/**
 * Attempts to activate native English text tracks directly on the HTML5 video element.
 * Setting track.mode = 'showing' tells the media engine to fetch and parse cues.
 * (Native cues remain invisible to the user thanks to overlay.css ::cue rules).
 * @param {HTMLVideoElement|object} video
 * @returns {boolean} True if an English track was found and activated
 */
export function activateEnglishTextTrack(video) {
  if (!video || !video.textTracks || video.textTracks.length === 0) {
    return false;
  }

  let activated = false;
  for (let i = 0; i < video.textTracks.length; i++) {
    const track = video.textTracks[i];
    if (isEnglishTrack(track)) {
      try {
        if (track.mode !== 'showing') {
          track.mode = 'showing';
        }
        activated = true;
      } catch (_) {}
    }
  }

  return activated;
}

/**
 * Finds the Audio & Subtitles button in the HBO Max player control bar.
 * @param {HTMLElement|Document|object} container
 * @returns {HTMLElement|null}
 */
export function findAudioSubtitleButton(container) {
  if (!container || typeof container.querySelector !== 'function') {
    return null;
  }

  const selectors = [
    'button[aria-label*="Audio and Subtitles" i]',
    'button[aria-label*="Audio and Captions" i]',
    'button[aria-label*="Subtitles and Audio" i]',
    'button[aria-label*="Audio & Subtitles" i]',
    'button[aria-label*="Subtitles" i]',
    'button[data-testid*="audio-subtitle" i]',
    'button[data-testid*="subtitle-button" i]'
  ];

  for (const sel of selectors) {
    try {
      const btn = container.querySelector(sel);
      if (btn) return btn;
    } catch (_) {}
  }

  return null;
}

/**
 * Locates the English subtitle option inside the opened Audio & Subtitles dialog.
 * @param {HTMLElement|Document|object} dialog
 * @returns {HTMLElement|null}
 */
export function findEnglishOptionElement(dialog) {
  if (!dialog || typeof dialog.querySelectorAll !== 'function') {
    return null;
  }

  const candidates = dialog.querySelectorAll('button, [role="radio"], [role="menuitem"], [role="option"], div, label, span');
  for (const el of candidates) {
    const text = (el.textContent || '').trim();
    const testId = (el.getAttribute && el.getAttribute('data-testid')) || '';

    // Must be English, not "Off" / "Tắt"
    if (/^english(\s*(\[cc\]|- cc))?$/i.test(text) || testId.toLowerCase().includes('subtitle-option-en')) {
      return el;
    }
  }

  return null;
}

/**
 * Silently ensures that English subtitles are active on the video.
 * @param {HTMLVideoElement} video
 * @param {HTMLElement} [container=document.body]
 * @returns {Promise<boolean>}
 */
export async function ensureEnglishSubtitlesActive(video, container = (typeof document !== 'undefined' ? document.body : null)) {
  // 1. First attempt: Direct HTML5 textTracks activation
  if (activateEnglishTextTrack(video)) {
    return true;
  }

  if (!container) return false;

  // 2. Second attempt: Silent UI selection
  const btn = findAudioSubtitleButton(container);
  if (!btn) return false;

  const docEl = typeof document !== 'undefined' ? document.documentElement : null;
  if (docEl) docEl.classList.add('max-vietsub-silent-dialog');

  try {
    // Open menu
    btn.click();
    await new Promise((r) => setTimeout(r, 60));

    const dialog = container.querySelector('[role="dialog"], div[class*="AudioSubtitle"], div[class*="Drawer"]');
    if (dialog) {
      const englishOption = findEnglishOptionElement(dialog);
      if (englishOption) {
        englishOption.click();
      }

      // Close menu
      const closeBtn = dialog.querySelector('button[aria-label*="Close" i], [data-testid*="close" i]');
      if (closeBtn) {
        closeBtn.click();
      } else {
        btn.click();
      }
    } else {
      // Re-click button to dismiss if dialog wasn't captured
      btn.click();
    }
  } catch (_) {
  } finally {
    if (docEl) {
      setTimeout(() => {
        docEl.classList.remove('max-vietsub-silent-dialog');
      }, 100);
    }
  }

  // Final check on text tracks after UI click
  return activateEnglishTextTrack(video);
}
