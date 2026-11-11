import test from 'node:test';
import assert from 'node:assert/strict';
import { TranslationCache } from '../src/shared/translation-cache.js';

test('TranslationCache - basic set, get, and has', () => {
  const cache = new TranslationCache(5);
  cache.set('Hello', 'Xin chào');

  assert.equal(cache.has('Hello'), true);
  assert.equal(cache.get('Hello'), 'Xin chào');
  assert.equal(cache.has('Goodbye'), false);
  assert.equal(cache.get('Goodbye'), null);
});

test('TranslationCache - normalizes text before keying', () => {
  const cache = new TranslationCache(5);
  cache.set('  Hello,   world! \n', 'Xin chào, thế giới!');

  // Should match normalized text
  assert.equal(cache.has('Hello, world!'), true);
  assert.equal(cache.get('Hello, world!'), 'Xin chào, thế giới!');
});

test('TranslationCache - enforces LRU eviction when capacity is exceeded', () => {
  const cache = new TranslationCache(3);
  cache.set('one', 'một');
  cache.set('two', 'hai');
  cache.set('three', 'ba');

  assert.equal(cache.size, 3);
  assert.equal(cache.has('one'), true);

  // Access 'one' to make it recently used
  cache.get('one');

  // Insert fourth item -> 'two' should be evicted because 'one' was accessed more recently
  cache.set('four', 'bốn');

  assert.equal(cache.size, 3);
  assert.equal(cache.has('two'), false, 'Key "two" should have been evicted');
  assert.equal(cache.has('one'), true, 'Key "one" should still be preserved');
  assert.equal(cache.has('three'), true, 'Key "three" should still be preserved');
  assert.equal(cache.has('four'), true, 'Key "four" should be in cache');
});

test('TranslationCache - clear method empties cache', () => {
  const cache = new TranslationCache(5);
  cache.set('a', '1');
  cache.set('b', '2');
  assert.equal(cache.size, 2);

  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.has('a'), false);
});
