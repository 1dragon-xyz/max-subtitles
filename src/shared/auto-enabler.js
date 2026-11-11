/**
 * Max VietSub - Automatic English Subtitle Enabler
 * Makes sure HBO Max is producing English cues, even when the user left subtitles OFF.
 * The HBO UI can be localized (e.g. Vietnamese), so labels are matched in both languages.
 */

const ENGLISH_OPTION_RE = /^(english|tiếng anh)(\s*[[(-]?\s*cc\s*[\])]?)?$/i;
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
