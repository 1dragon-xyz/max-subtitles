/**
 * Cleans subtitle text by stripping HTML tags and normalizing whitespace/line breaks.
 * @param {string} text Raw subtitle text
 * @returns {string} Cleaned subtitle text
 */
export function cleanSubtitleText(text) {
  if (typeof text !== 'string') return '';

  // Remove HTML tags (e.g., <i>, </i>, <b>, </b>, <font...>, </font>)
  const stripped = text.replace(/<[^>]*>/g, '');

  // Split into lines, normalize spaces per line, filter empty lines, join with single newline
  return stripped
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Determines whether subtitle cue text represents non-speech sounds, music, or empty noise.
 * @param {string} text Raw or cleaned subtitle text
 * @returns {boolean} True if the cue should be skipped/omitted from translation
 */
export function shouldSkipSubtitleText(text) {
  if (!text || typeof text !== 'string') return true;

  const trimmed = text.trim();
  if (!trimmed) return true;

  // Sound descriptions in brackets e.g. [LAUGHTER], [DOOR OPENS]
  if (/^\[[\s\S]*\]$/.test(trimmed)) return true;

  // Sound descriptions in parentheses e.g. (APPLAUSE), (CHUCKLES)
  if (/^\([\s\S]*\)$/.test(trimmed)) return true;

  // Music cues enclosed in music symbols or hashes e.g. ♪ Theme song playing ♪
  if (/^[♪♫#][\s\S]*[♪♫#]$/.test(trimmed) || /^[♪♫#\s]+$/.test(trimmed)) return true;

  return false;
}

/**
 * Generates a normalized, deterministic key for deduplication and caching.
 * @param {string} text
 * @returns {string} Normalized lowercase string
 */
export function formatCueKey(text) {
  if (typeof text !== 'string') return '';
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}
