import { TranslationCache } from '../shared/translation-cache.js';
import { translateTextWithFallback } from '../shared/translator.js';

// Initialize LRU memory cache with 1000-entry capacity
const translationCache = new TranslationCache(1000);

// Storage key for persistent cache across service worker lifecycles
const CACHE_STORAGE_KEY = 'max_vietsub_cache_v1';
const SETTINGS_STORAGE_KEY = 'max_vietsub_settings';

// Hydrate memory cache from chrome.storage.local on startup
async function hydrateCache() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }
  try {
    const data = await chrome.storage.local.get([CACHE_STORAGE_KEY]);
    if (data && data[CACHE_STORAGE_KEY]) {
      const savedEntries = data[CACHE_STORAGE_KEY];
      if (Array.isArray(savedEntries)) {
        for (const [key, val] of savedEntries) {
          translationCache.set(key, val);
        }
      }
    }
  } catch (err) {
    console.warn('[MaxVietSub ServiceWorker] Failed to hydrate cache:', err);
  }
}

// Debounced cache persistence to avoid thrashing storage
let persistTimeout = null;
function persistCacheDebounced() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(async () => {
    try {
      // Store recent 300 entries in local storage
      const entries = Array.from(translationCache.cache.entries()).slice(-300);
      await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: entries });
    } catch (err) {
      console.warn('[MaxVietSub ServiceWorker] Failed to persist cache:', err);
    }
  }, 3000);
}

// Run initial hydration
hydrateCache();

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  // Handle subtitle translation request
  if (message.type === 'TRANSLATE_CUE' || message.type === 'TRANSLATE_TEXT') {
    const text = message.text;
    const sourceLang = message.sourceLang || 'en';
    const targetLang = message.targetLang || 'vi';

    if (!text || typeof text !== 'string' || !text.trim()) {
      sendResponse({ translatedText: text, cached: false });
      return false;
    }

    // Check fast in-memory LRU cache
    if (translationCache.has(text)) {
      const cachedResult = translationCache.get(text);
      sendResponse({ translatedText: cachedResult, cached: true });
      return false;
    }

    // Perform translation with fallback
    translateTextWithFallback(text, {
      fetchFn: fetch,
      sourceLang,
      targetLang,
      cache: translationCache
    })
      .then((translatedText) => {
        persistCacheDebounced();
        sendResponse({ translatedText, cached: false });
      })
      .catch((err) => {
        console.warn('[MaxVietSub ServiceWorker] Translation error, falling back:', err);
        sendResponse({ translatedText: text, cached: false, error: err.message });
      });

    // Return true to indicate asynchronous sendResponse
    return true;
  }

  // Handle settings retrieval
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get({ enabled: true, fontSize: 24 }, (settings) => {
      sendResponse({ settings });
    });
    return true;
  }

  // Handle cache clearance
  if (message.type === 'CLEAR_CACHE') {
    translationCache.clear();
    chrome.storage.local.remove([CACHE_STORAGE_KEY], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});
