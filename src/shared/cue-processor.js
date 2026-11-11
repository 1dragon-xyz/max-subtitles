/**
 * Cleans subtitle text by stripping HTML tags and normalizing whitespace/line breaks.
 * @param {string} text Raw subtitle text
 * @returns {string} Cleaned subtitle text
 */
export function cleanSubtitleText(text) {
  if (typeof text !== 'string') return '';

  // Convert <br> / <br/> to newline first
  const withBreaks = text.replace(/<br\s*\/?>/gi, '\n');

  // Remove HTML tags (e.g., <i>, </i>, <b>, </b>, <font...>, </font>, <span...>)
  const stripped = withBreaks.replace(/<[^>]*>/g, '');

  // Decode basic XML/HTML entities
  const decoded = stripped
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ');

  // Split into lines, normalize spaces per line, filter empty lines, join with single newline
  return decoded
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Detects whether text already contains Vietnamese-specific diacritic characters.
 * Prevents reverse-translating Vietnamese UI text (e.g. "Mở Đầu" -> "Open Head").
 * @param {string} text
 * @returns {boolean}
 */
export function isVietnameseText(text) {
  if (!text || typeof text !== 'string') return false;
  const vietnameseRegex =
    /[ăâđêôơưĂÂĐÊÔƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ]/;
  return vietnameseRegex.test(text);
}

/**
 * Checks if a DOM class name, data-testid, or element identifier belongs to
 * player UI controls or episode metadata (such as SeasonEpisodeSubtitleContainer)
 * rather than actual video closed captions.
 * @param {string} identifier
 * @returns {boolean} True if it belongs to excluded UI/metadata
 */
export function isExcludedUIIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') return false;
  const lower = identifier.toLowerCase();

  const excludedPatterns = [
    'seasonepisode',
    'asset-subtitle',
    'episode-subtitle',
    'show-subtitle',
    'series-subtitle',
    'sub-title',
    'title',
    'control',
    'button',
    'menu',
    'picker',
    'dialog',
    'modal',
    'settings',
    'scrubber',
    'seek',
    'slider',
    'time',
    'duration',
    'progress',
    'header',
    'footer',
    'metadata',
    'browse',
    'rail',
    'tile',
    'card',
    'tab',
    'synopsis',
    'description',
    'advisory',
    'rating',
    'upnext',
    'skip',
    'promo',
    'Toasts',
    'toast',
    'badge',
    'tooltip'
  ];

  return excludedPatterns.some((pattern) => lower.includes(pattern.toLowerCase()));
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

/**
 * Parses a WebVTT or TTML timestamp into seconds.
 * Supports HH:MM:SS.mmm, MM:SS.mmm, HH:MM:SS,mmm, and 123.45s
 * @param {string} raw
 * @returns {number}
 */
export function parseTimestampToSeconds(raw) {
  if (!raw || typeof raw !== 'string') return NaN;
  const s = raw.trim();

  // Offset format e.g. "12.5s" or "1500ms"
  if (/^\d+(\.\d+)?ms$/i.test(s)) {
    return parseFloat(s) / 1000;
  }
  if (/^\d+(\.\d+)?s$/i.test(s)) {
    return parseFloat(s);
  }

  // Standard colon-separated timecode
  const normalized = s.replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const mins = parseFloat(parts[1]);
    const secs = parseFloat(parts[2]);
    return hours * 3600 + mins * 60 + secs;
  }
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    return mins * 60 + secs;
  }
  if (parts.length === 4) {
    // SMPTE frame timecode HH:MM:SS:FF (approx 24fps)
    const hours = parseFloat(parts[0]);
    const mins = parseFloat(parts[1]);
    const secs = parseFloat(parts[2]);
    const frames = parseFloat(parts[3]);
    return hours * 3600 + mins * 60 + secs + frames / 24;
  }

  return NaN;
}

/**
 * Parses WebVTT text content into an array of cue objects.
 * @param {string} vttText
 * @returns {Array<{startTime: number, endTime: number, text: string}>}
 */
export function parseWebVTT(vttText) {
  if (!vttText || typeof vttText !== 'string') return [];

  const blocks = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\n+/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE') || lines[0].startsWith('STYLE')) {
      continue;
    }

    // Find the line containing "-->"
    const arrowIdx = lines.findIndex((l) => l.includes('-->'));
    if (arrowIdx === -1) continue;

    const timeLine = lines[arrowIdx];
    const match = timeLine.match(/([0-9:.]+)\s*-->\s*([0-9:.]+)/);
    if (!match) continue;

    const startTime = parseTimestampToSeconds(match[1]);
    const endTime = parseTimestampToSeconds(match[2]);
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) continue;

    const rawDialogue = lines.slice(arrowIdx + 1).join('\n');
    const text = cleanSubtitleText(rawDialogue);
    if (text) {
      cues.push({ startTime, endTime, text });
    }
  }

  return cues;
}

/**
 * Parses TTML / SMPTE-TT / DFXP XML content into an array of cue objects.
 * @param {string} xmlText
 * @returns {Array<{startTime: number, endTime: number, text: string}>}
 */
export function parseTTML(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return [];

  const cues = [];
  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = pRegex.exec(xmlText)) !== null) {
    const attrs = match[1];
    const innerHtml = match[2];

    const beginMatch = attrs.match(/\bbegin\s*=\s*["']([^"']+)["']/i);
    const endMatch = attrs.match(/\bend\s*=\s*["']([^"']+)["']/i);
    const durMatch = attrs.match(/\bdur\s*=\s*["']([^"']+)["']/i);

    if (!beginMatch) continue;
    const startTime = parseTimestampToSeconds(beginMatch[1]);
    let endTime = endMatch ? parseTimestampToSeconds(endMatch[1]) : NaN;
    if (Number.isNaN(endTime) && durMatch) {
      const dur = parseTimestampToSeconds(durMatch[1]);
      if (!Number.isNaN(dur)) endTime = startTime + dur;
    }

    if (Number.isNaN(startTime) || Number.isNaN(endTime)) continue;

    const text = cleanSubtitleText(innerHtml);
    if (text) {
      cues.push({ startTime, endTime, text });
    }
  }

  return cues;
}

/**
 * Finds active cue text at a given playback timestamp in seconds.
 * @param {Array<{startTime: number, endTime: number, text: string}>} cues
 * @param {number} currentTime
 * @returns {string}
 */
export function findActiveCuesText(cues, currentTime) {
  if (!Array.isArray(cues) || cues.length === 0 || typeof currentTime !== 'number') {
    return '';
  }

  const activeTexts = [];
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (currentTime >= c.startTime && currentTime <= c.endTime) {
      if (c.text && !activeTexts.includes(c.text)) {
        activeTexts.push(c.text);
      }
    }
  }

  return activeTexts.join('\n');
}
