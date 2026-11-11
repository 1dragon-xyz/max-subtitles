/**
 * LRU Translation Cache for high-performance subtitle translation lookup.
 */
export class TranslationCache {
  /**
   * @param {number} [capacity=500] Maximum number of translations to cache in memory.
   */
  constructor(capacity = 500) {
    this.capacity = capacity > 0 ? capacity : 500;
    this.cache = new Map();
  }

  /**
   * Get current number of cached items.
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Normalizes cue text by trimming and collapsing multiple whitespaces.
   * @param {string} text
   * @returns {string}
   */
  normalizeKey(text) {
    if (typeof text !== 'string') return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Checks if translation exists for the given text.
   * @param {string} text
   * @returns {boolean}
   */
  has(text) {
    const key = this.normalizeKey(text);
    if (!key) return false;
    return this.cache.has(key);
  }

  /**
   * Retrieves translation for the given text, updating LRU order.
   * @param {string} text
   * @returns {string|null}
   */
  get(text) {
    const key = this.normalizeKey(text);
    if (!key || !this.cache.has(key)) return null;

    const value = this.cache.get(key);
    // Refresh LRU recency by deleting and re-inserting
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Stores a translation in cache with LRU eviction.
   * @param {string} text Original text
   * @param {string} translation Translated text
   */
  set(text, translation) {
    const key = this.normalizeKey(text);
    if (!key) return;

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, translation);
  }

  /**
   * Clears all cached translations.
   */
  clear() {
    this.cache.clear();
  }
}
