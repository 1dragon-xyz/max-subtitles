import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleTranslateUrl,
  parseGoogleTranslateResponse,
  translateTextWithFallback
} from '../src/shared/translator.js';

test('buildGoogleTranslateUrl - builds valid URL with proper query params', () => {
  const url = buildGoogleTranslateUrl('Hello world', 'en', 'vi');
  const parsed = new URL(url);

  assert.equal(parsed.origin, 'https://translate.googleapis.com');
  assert.equal(parsed.pathname, '/translate_a/single');
  assert.equal(parsed.searchParams.get('client'), 'gtx');
  assert.equal(parsed.searchParams.get('sl'), 'en');
  assert.equal(parsed.searchParams.get('tl'), 'vi');
  assert.equal(parsed.searchParams.get('dt'), 't');
  assert.equal(parsed.searchParams.get('q'), 'Hello world');
});

test('parseGoogleTranslateResponse - handles single line translation payload', () => {
  const mockPayload = [
    [['Xin chào thế giới', 'Hello world', null, null, 10]],
    null,
    'en'
  ];

  const result = parseGoogleTranslateResponse(mockPayload);
  assert.equal(result, 'Xin chào thế giới');
});

test('parseGoogleTranslateResponse - handles multi-segment / multi-sentence payload', () => {
  const mockPayload = [
    [
      ['Có chuyện gì thế? ', "What's going on? ", null, null, 10],
      ['Tôi không biết nữa.', "I don't know.", null, null, 10]
    ],
    null,
    'en'
  ];

  const result = parseGoogleTranslateResponse(mockPayload);
  assert.equal(result, 'Có chuyện gì thế? Tôi không biết nữa.');
});

test('parseGoogleTranslateResponse - throws on invalid structure', () => {
  assert.throws(() => parseGoogleTranslateResponse(null), /Invalid translation payload/);
  assert.throws(() => parseGoogleTranslateResponse([]), /Invalid translation payload/);
  assert.throws(() => parseGoogleTranslateResponse([[]]), /Invalid translation payload/);
});

test('translateTextWithFallback - uses mock fetch successfully', async () => {
  const mockFetch = async (url) => {
    return {
      ok: true,
      json: async () => [
        [['Chào bạn', 'Hi there', null, null, 10]]
      ]
    };
  };

  const translated = await translateTextWithFallback('Hi there', {
    fetchFn: mockFetch,
    sourceLang: 'en',
    targetLang: 'vi'
  });

  assert.equal(translated, 'Chào bạn');
});
