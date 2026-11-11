import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOverlayStyles,
  formatSubtitleHtml,
  sanitizeText
} from '../src/shared/overlay-helper.js';

test('generateOverlayStyles - calculates responsive font size and styling correctly', () => {
  const styles = generateOverlayStyles({
    fontSize: 24,
    textColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    bottomOffsetPercent: 8
  });

  assert.equal(styles.fontSize, '24px');
  assert.equal(styles.color, '#ffffff');
  assert.equal(styles.backgroundColor, 'rgba(0, 0, 0, 0.75)');
  assert.equal(styles.bottom, '8%');
  assert.equal(styles.position, 'absolute');
});

test('sanitizeText - escapes HTML characters to prevent XSS', () => {
  const unsafe = '<img src=x onerror="alert(1)"> & "hello"';
  const safe = sanitizeText(unsafe);
  assert.equal(safe, '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;hello&quot;');
});

test('formatSubtitleHtml - converts multi-line Vietnamese text to styled span blocks', () => {
  const text = 'Chào các bạn\nRất vui được gặp lại!';
  const html = formatSubtitleHtml(text);
  assert.equal(html, '<span class="max-sub-line">Chào các bạn</span><br><span class="max-sub-line">Rất vui được gặp lại!</span>');
});
