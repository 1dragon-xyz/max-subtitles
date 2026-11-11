/**
 * Generates style properties for subtitle overlay display.
 * @param {object} [options={}]
 * @param {number|string} [options.fontSize=24] Font size in pixels or CSS value
 * @param {string} [options.textColor='#ffffff'] Subtitle text color
 * @param {string} [options.backgroundColor='rgba(0, 0, 0, 0.75)'] Overlay backdrop color
 * @param {number|string} [options.bottomOffsetPercent=8] Bottom offset percentage
 * @returns {object} Object with CSS style properties
 */
export function generateOverlayStyles(options = {}) {
  const {
    fontSize = 24,
    textColor = '#ffffff',
    backgroundColor = 'rgba(0, 0, 0, 0.75)',
    bottomOffsetPercent = 8
  } = options;

  const resolvedFontSize =
    typeof fontSize === 'number' ? `${fontSize}px` : fontSize;
  const resolvedBottom =
    typeof bottomOffsetPercent === 'number'
      ? `${bottomOffsetPercent}%`
      : bottomOffsetPercent;

  return {
    position: 'absolute',
    bottom: resolvedBottom,
    fontSize: resolvedFontSize,
    color: textColor,
    backgroundColor: backgroundColor
  };
}

/**
 * Escapes unsafe HTML characters to prevent XSS attacks when rendering subtitles.
 * @param {string} text
 * @returns {string} Sanitized string
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts multi-line subtitle text into structured HTML spans with line breaks.
 * @param {string} text Raw or translated subtitle text
 * @returns {string} Formatted HTML snippet
 */
export function formatSubtitleHtml(text) {
  if (!text || typeof text !== 'string') return '';

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  return lines
    .map((line) => `<span class="max-sub-line">${sanitizeText(line)}</span>`)
    .join('<br>');
}
