/**
 * Google Translate single API URL builder.
 * @param {string} text Text to translate
 * @param {string} [sourceLang='en'] Source language code
 * @param {string} [targetLang='vi'] Target language code
 * @returns {string} Fully formatted URL
 */
export function buildGoogleTranslateUrl(text, sourceLang = 'en', targetLang = 'vi') {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', sourceLang);
  url.searchParams.set('tl', targetLang);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);
  return url.toString();
}

/**
 * Parses the raw payload returned by the Google Translate API.
 * Expected structure: [[["Translated text", "Source text", ...], ...], ...]
 * @param {any} payload
 * @returns {string} Combined translated text
 */
export function parseGoogleTranslateResponse(payload) {
  if (
    !payload ||
    !Array.isArray(payload) ||
    !Array.isArray(payload[0]) ||
    payload[0].length === 0
  ) {
    throw new Error('Invalid translation payload');
  }

  const translatedSegments = payload[0].map((item) => {
    if (Array.isArray(item) && typeof item[0] === 'string') {
      return item[0];
    }
    return '';
  });

  return translatedSegments.join('');
}

/**
 * Translates text from source to target language with fallback to original text.
 * @param {string} text Text to translate
 * @param {object} [options={}] Options including fetchFn, sourceLang, targetLang, cache
 * @returns {Promise<string>} Translated text, or original text on failure
 */
export async function translateTextWithFallback(text, options = {}) {
  const {
    fetchFn = (typeof fetch !== 'undefined' ? fetch : globalThis.fetch),
    sourceLang = 'en',
    targetLang = 'vi',
    cache = null
  } = options;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return text;
  }

  if (cache && typeof cache.has === 'function' && cache.has(text)) {
    const cached = cache.get(text);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
  }

  try {
    const url = buildGoogleTranslateUrl(text, sourceLang, targetLang);
    const response = await fetchFn(url);

    if (!response || !response.ok) {
      return text;
    }

    const data = await response.json();
    const translated = parseGoogleTranslateResponse(data);

    if (cache && typeof cache.set === 'function' && translated) {
      cache.set(text, translated);
    }

    return translated || text;
  } catch (err) {
    // Graceful fallback to original text on network, parsing or timeout failure
    return text;
  }
}
