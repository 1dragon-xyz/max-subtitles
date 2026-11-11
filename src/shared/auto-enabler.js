/**
 * Max VietSub - Automatic English Subtitle Enabler
 * Makes sure HBO Max is producing English cues, even when the user left subtitles OFF.
 * The HBO UI can be localized (e.g. Vietnamese), so labels are matched in both languages.
 */

const ENGLISH_OPTION_RE = /^(english|tiếng anh)(\s*[[(-]?\s*cc\s*[\])]?)?$/i;
const OFF_OPTION_RE = /^(off|tắt|none|không|disabled?)$/i;
const SUBTITLE_HEADING_RE = /^(phụ đề|subtitles?|captions?|closed captions?)$/i;
const AUDIO_SUB_LABEL_RE = /(âm thanh|audio).*(phụ đề|subtitle|caption)|phụ đề|subtitles?|captions?/i;
const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING

/**
 * @param {TextTrack|object} track
 * @returns {boolean}
 */
export function isEnglishTrack(track) {
  if (!track) return false;
  const lang = (track.language || '').toLowerCase().trim();
  const label = (track.label || '').toLowerCase().trim();

  if (lang.startsWith('en') || lang === 'eng') return true;
  return label.includes('english') || label.includes('tiếng anh') || label.includes('en [cc]');
}

/**
 * Calculates the maximum endTime among all intercepted cues.
 * @param {Array<{endTime: number}>} cues
 * @returns {number}
 */
export function getMaxCueEndTime(cues) {
  if (!Array.isArray(cues) || cues.length === 0) return 0;
  let max = 0;
  for (let i = 0; i < cues.length; i++) {
    if (typeof cues[i].endTime === 'number' && cues[i].endTime > max) {
      max = cues[i].endTime;
    }
  }
  return max;
}

/**
 * Checks whether the playback position is nearing or past the current subtitle horizon,
 * meaning HBO Max has only buffered subtitles up to the current segment and requires
 * a brief re-activation to download the next segment.
 *
 * @param {Array<{endTime: number}>} cues
 * @param {number} currentTime
 * @param {number} duration
 * @param {number} [lookaheadSec=20]
 * @returns {boolean}
 */
export function needsSubtitleHorizonRefresh(cues, currentTime, duration, lookaheadSec = 20) {
  if (!Array.isArray(cues) || cues.length === 0) return false;
  if (typeof currentTime !== 'number' || typeof duration !== 'number') return false;

  // If the video is within 45s of the end, do not trigger refresh (avoids credits loops)
  if (duration > 0 && currentTime >= duration - 45) {
    return false;
  }

  const maxEnd = getMaxCueEndTime(cues);
  if (maxEnd === 0) return false;

  // If current playback is within lookaheadSec (e.g. 20s) of maxEnd, or past it:
  return maxEnd - currentTime <= lookaheadSec;
}

/**
 * Checks whether the HTML5 video element has loaded enough data and started playback
 * so that HBO Max's player has populated its subtitle tracks in the menu.
 * @param {HTMLVideoElement|object} video
 * @returns {boolean}
 */
export function isVideoReadyForSubtitles(video) {
  if (!video) return false;
  if (typeof video.readyState === 'number' && video.readyState < 3) return false;
  if (video.paused === true) return false;

  const currentTime = Number(video.currentTime) || 0;
  const hasTracks = Boolean(video.textTracks && video.textTracks.length > 0);
  if (hasTracks && currentTime >= 0.5) return true;

  return currentTime >= 1.5;
}

/**
 * Ensures an English text track is producing cues WITHOUT rendering natively:
 * a 'disabled' track becomes 'hidden' (cues load and fire events, nothing is drawn).
 * Tracks that are already 'hidden'/'showing' are left alone.
 * @param {HTMLVideoElement|object} video
 * @returns {boolean} True if an English track exists and is not disabled
 */
export function activateEnglishTextTrack(video) {
  if (!video || !video.textTracks || video.textTracks.length === 0) return false;

  let active = false;
  for (let i = 0; i < video.textTracks.length; i++) {
    const track = video.textTracks[i];
    if (!isEnglishTrack(track)) continue;
    try {
      if (track.mode === 'disabled') track.mode = 'hidden';
    } catch (_) {}
    if (track.mode !== 'disabled') active = true;
  }
  return active;
}

/**
 * Finds the Audio & Subtitles button in the player control bar (English or localized label).
 * @param {HTMLElement|Document|object} container
 * @returns {HTMLElement|null}
 */
export function findAudioSubtitleButton(container) {
  if (!container) return null;

  if (typeof container.querySelector === 'function') {
    const selectors = [
      'button[aria-label*="Audio and Subtitles" i]',
      'button[aria-label*="Audio and Captions" i]',
      'button[aria-label*="Subtitles and Audio" i]',
      'button[aria-label*="Audio & Subtitles" i]',
      'button[aria-label*="phụ đề" i]',
      'button[data-testid*="audio-subtitle" i]',
      'button[data-testid*="subtitle-button" i]'
    ];
    for (const sel of selectors) {
      try {
        const btn = container.querySelector(sel);
        if (btn) return btn;
      } catch (_) {}
    }
  }

  if (typeof container.querySelectorAll === 'function') {
    for (const btn of container.querySelectorAll('button, [role="button"]')) {
      const label = [
        btn.getAttribute && btn.getAttribute('aria-label'),
        btn.getAttribute && btn.getAttribute('title'),
        btn.getAttribute && btn.getAttribute('data-testid')
      ]
        .filter(Boolean)
        .join(' ');
      if (label && AUDIO_SUB_LABEL_RE.test(label)) return btn;
    }
  }
  return null;
}

/**
 * Finds the English SUBTITLE option in the opened menu. The menu also lists audio languages,
 * so when the choice is ambiguous we refuse to click instead of switching the audio track.
 * @param {HTMLElement|Document|object} dialog
 * @returns {HTMLElement|null}
 */
export function findEnglishOptionElement(dialog) {
  if (!dialog || typeof dialog.querySelectorAll !== 'function') return null;

  const nodes = Array.from(dialog.querySelectorAll('button, [role="radio"], [role="menuitem"], [role="option"], div, label, span'));
  const textOf = (el) => (el.textContent || '').trim();
  const testIdOf = (el) => ((el.getAttribute && el.getAttribute('data-testid')) || '').toLowerCase();

  const english = nodes.filter((el) => ENGLISH_OPTION_RE.test(textOf(el)) || testIdOf(el).includes('subtitle-option-en'));
  if (english.length === 0) return null;

  const heading = nodes.find((el) => SUBTITLE_HEADING_RE.test(textOf(el)));
  if (heading && typeof heading.compareDocumentPosition === 'function') {
    const afterHeading = english.filter((el) => heading.compareDocumentPosition(el) & FOLLOWING);
    return afterHeading[0] || null;
  }

  return english.length === 1 ? english[0] : null;
}

/**
 * Finds the "Off" / "Tắt" SUBTITLE option in the opened menu (after the Subtitles heading).
 * @param {HTMLElement|Document|object} dialog
 * @returns {HTMLElement|null}
 */
export function findOffOptionElement(dialog) {
  if (!dialog || typeof dialog.querySelectorAll !== 'function') return null;

  const nodes = Array.from(
    dialog.querySelectorAll('button, [role="radio"], [role="menuitem"], [role="option"], div, label, span')
  );
  const textOf = (el) => (el.textContent || '').trim();
  const testIdOf = (el) => ((el.getAttribute && el.getAttribute('data-testid')) || '').toLowerCase();

  const offNodes = nodes.filter(
    (el) =>
      OFF_OPTION_RE.test(textOf(el)) ||
      testIdOf(el).includes('subtitle-option-off') ||
      testIdOf(el).includes('caption-option-off')
  );
  if (offNodes.length === 0) return null;

  const heading = nodes.find((el) => SUBTITLE_HEADING_RE.test(textOf(el)));
  if (heading && typeof heading.compareDocumentPosition === 'function') {
    const afterHeading = offNodes.filter((el) => heading.compareDocumentPosition(el) & FOLLOWING);
    return afterHeading[0] || null;
  }

  return offNodes.length === 1 ? offNodes[0] : offNodes[offNodes.length - 1];
}

/**
 * Finds the Close [X] button inside the Audio & Subtitles dialog/panel.
 * Supports explicit aria-label/data-testid as well as HBO Max's icon-only <button><svg>...</svg></button>
 * rendered inside the subtitle panel near the "Phụ đề" / "Subtitles" heading.
 * @param {HTMLElement|Document|object} dialog
 * @param {HTMLElement|object|null} [excludeBtn]
 * @returns {HTMLElement|null}
 */
export function findCloseDialogButton(dialog, excludeBtn = null) {
  if (!dialog) return null;

  if (typeof dialog.querySelector === 'function') {
    const closeSelectors = [
      'button[aria-label*="Close" i]',
      'button[aria-label*="Đóng" i]',
      'button[aria-label*="Thoát" i]',
      '[data-testid*="close" i]',
      '[data-testid*="dismiss" i]'
    ];
    for (const sel of closeSelectors) {
      try {
        const btn = dialog.querySelector(sel);
        if (btn && btn !== excludeBtn) return btn;
      } catch (_) {}
    }
  }

  if (typeof dialog.querySelectorAll !== 'function') return null;

  const nodes = Array.from(
    dialog.querySelectorAll('button, [role="button"], [role="radio"], [role="menuitem"], [role="option"], div, label, span')
  );
  const textOf = (el) => (el.textContent || '').trim();
  const heading = nodes.find((el) => SUBTITLE_HEADING_RE.test(textOf(el)));

  // Look for an icon-only button inside the panel containing the "Phụ đề" / "Subtitles" heading
  if (heading) {
    let panel = heading.parentElement;
    for (let depth = 0; depth < 5 && panel; depth++) {
      if (typeof panel.querySelectorAll === 'function') {
        const buttons = Array.from(panel.querySelectorAll('button, [role="button"]')).filter(
          (b) =>
            b !== excludeBtn &&
            textOf(b) === '' &&
            (typeof b.querySelector !== 'function' || b.querySelector('svg, path, img') !== null)
        );
        if (buttons.length > 0) {
          return buttons[0];
        }
      }
      panel = panel.parentElement;
    }

    // Fallback: icon-only button with an SVG in the dialog when heading is visible
    const iconButtons = nodes.filter(
      (b) =>
        b !== excludeBtn &&
        (b.tagName === 'BUTTON' || (b.getAttribute && b.getAttribute('role') === 'button')) &&
        textOf(b) === '' &&
        typeof b.querySelector === 'function' &&
        b.querySelector('svg') !== null
    );
    if (iconButtons.length === 1) {
      return iconButtons[0];
    }
  }

  return null;
}

/**
 * Ensures no native HTML5 textTracks are in 'showing' mode so native browser captions never overlap.
 * @param {HTMLVideoElement|object} video
 */
export function disableShowingTextTracks(video) {
  if (!video || !video.textTracks) return;
  for (let i = 0; i < video.textTracks.length; i++) {
    const track = video.textTracks[i];
    if (track && track.mode === 'showing') {
      try {
        track.mode = 'hidden';
      } catch (_) {}
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Briefly turns ON English subtitles (1–2s, max 3s) so HBO Max downloads the full subtitle track
 * and our page-hook captures all cues, then immediately turns HBO's subtitles back OFF ("Tắt" / "Off")
 * so only the Vietnamese overlay is displayed with zero dual-subtitle overlap.
 *
 * @param {HTMLVideoElement|object} video
 * @param {HTMLElement|Document|object} [container]
 * @param {{
 *   hasCapturedCues?: () => boolean,
 *   minHoldMs?: number,
 *   maxHoldMs?: number,
 *   pollIntervalMs?: number,
 *   log?: Function
 * }} [opts]
 * @returns {Promise<boolean>}
 */
export async function captureAndTurnOffSubtitles(
  video,
  container = typeof document !== 'undefined' ? document.body : null,
  {
    hasCapturedCues = () => false,
    minHoldMs = 1000,
    maxHoldMs = 2500,
    pollIntervalMs = 100,
    log = () => {}
  } = {}
) {
  if (!container) return false;

  const btn = findAudioSubtitleButton(container);
  if (!btn) {
    log('auto-capture: audio/subtitle button not found');
    return activateEnglishTextTrack(video);
  }

  const docEl = typeof document !== 'undefined' ? document.documentElement : null;
  if (docEl) docEl.classList.add('max-vietsub-silent-dialog');

  let captured = false;
  try {
    btn.click();

    // Wait up to ~2.5s (25 polls) for "English" / "Tiếng Anh" to populate in the menu
    // (on initial video load, HBO Max may briefly show only "Tắt" / "Off" for 1-2s before tracks appear)
    let enOption = null;
    for (let i = 0; i < 25 && !enOption; i++) {
      await sleep(Math.min(100, pollIntervalMs));
      enOption = findEnglishOptionElement(container);
    }

    if (enOption) {
      enOption.click();
      log('auto-capture: enabled English subtitles briefly to hook full track');

      // Wait minimum hold time (e.g. 1s), then poll until cues are captured or maxHoldMs (2.5s) is reached
      const startedAt = Date.now();
      await sleep(minHoldMs);
      while (!hasCapturedCues() && Date.now() - startedAt < maxHoldMs) {
        await sleep(pollIntervalMs);
      }
      captured = Boolean(hasCapturedCues());

      // Now turn HBO's native subtitles back OFF ("Tắt" / "Off") so English never renders on screen
      let offOption = findOffOptionElement(container);
      if (!offOption) {
        // Re-open menu if selecting English auto-closed it
        btn.click();
        for (let i = 0; i < 8 && !offOption; i++) {
          await sleep(Math.min(100, pollIntervalMs));
          offOption = findOffOptionElement(container);
        }
      }

      if (offOption) {
        offOption.click();
        log('auto-capture: switched HBO native subtitles back to Off/Tắt');
      }
    } else {
      log('auto-capture: English subtitle option not yet populated in menu');
    }

    disableShowingTextTracks(video);

    // Ensure the subtitle menu/dialog is completely closed so it never stays stuck on screen
    await sleep(Math.min(80, pollIntervalMs));
    const closeBtn = findCloseDialogButton(container, btn);
    if (closeBtn && typeof closeBtn.click === 'function') {
      closeBtn.click();
    } else if (findOffOptionElement(container) || !enOption) {
      // No close button found and menu is still open -> toggle the Audio/Subtitles button to close it
      btn.click();
    }

    if (typeof document !== 'undefined' && typeof KeyboardEvent !== 'undefined') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    }
  } catch (err) {
    log('auto-capture: error', String(err));
  } finally {
    if (docEl) setTimeout(() => docEl.classList.remove('max-vietsub-silent-dialog'), 250);
  }

  return captured || activateEnglishTextTrack(video);
}

/**
 * Best-effort: make sure English cues are flowing.
 * 1) text track path (cheap, no UI). 2) optional invisible UI path (open menu → pick English → close).
 * @param {HTMLVideoElement} video
 * @param {HTMLElement} [container]
 * @param {{allowUi?: boolean, log?: Function}} [opts]
 * @returns {Promise<boolean>}
 */
export async function ensureEnglishSubtitlesActive(
  video,
  container = typeof document !== 'undefined' ? document.body : null,
  { allowUi = true, log = () => {} } = {}
) {
  if (activateEnglishTextTrack(video)) return true;
  if (!allowUi || !container) return false;

  const btn = findAudioSubtitleButton(container);
  if (!btn) {
    log('auto-enable: audio/subtitle button not found');
    return false;
  }

  const docEl = typeof document !== 'undefined' ? document.documentElement : null;
  if (docEl) docEl.classList.add('max-vietsub-silent-dialog');

  try {
    btn.click();
    let option = null;
    for (let i = 0; i < 8 && !option; i++) {
      await sleep(100);
      option = findEnglishOptionElement(container);
    }
    if (option) {
      option.click();
      log('auto-enable: clicked English subtitle option');
    } else {
      log('auto-enable: English subtitle option not found/ambiguous; not clicking anything');
    }

    await sleep(100);
    const close = container.querySelector('button[aria-label*="Close" i], button[aria-label*="Đóng" i], [data-testid*="close" i]');
    if (close) close.click();
    else if (!option) btn.click();
  } catch (err) {
    log('auto-enable: error', String(err));
  } finally {
    if (docEl) setTimeout(() => docEl.classList.remove('max-vietsub-silent-dialog'), 300);
  }

  return activateEnglishTextTrack(video);
}
