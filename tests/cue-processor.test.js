import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSubtitleText,
  shouldSkipSubtitleText,
  formatCueKey
} from '../src/shared/cue-processor.js';

test('cleanSubtitleText - strips HTML tags (i, b, u, font)', () => {
  const input = '<i>Monica:</i> <b>Please!</b> <font color="yellow">Come here.</font>';
  const expected = 'Monica: Please! Come here.';
  assert.equal(cleanSubtitleText(input), expected);
});

test('cleanSubtitleText - normalizes whitespace and line breaks', () => {
  const input = '  Hello,\n\n  how   are you doing?   \r\n';
  const expected = 'Hello,\nhow are you doing?';
  assert.equal(cleanSubtitleText(input), expected);
});

test('shouldSkipSubtitleText - filters out non-speech sounds and noise cues', () => {
  assert.equal(shouldSkipSubtitleText('[LAUGHTER]'), true);
  assert.equal(shouldSkipSubtitleText('(APPLAUSE)'), true);
  assert.equal(shouldSkipSubtitleText('[DOOR OPENS]'), true);
  assert.equal(shouldSkipSubtitleText('♪ Theme song playing ♪'), true);
  assert.equal(shouldSkipSubtitleText(''), true);
  assert.equal(shouldSkipSubtitleText('   '), true);

  // Real dialogue should not be skipped
  assert.equal(shouldSkipSubtitleText('Hey, look at that!'), false);
  assert.equal(shouldSkipSubtitleText('Chandler: Could I be more surprised?'), false);
});

test('formatCueKey - generates deterministic hashable key', () => {
  const key1 = formatCueKey('There is nothing to tell!');
  const key2 = formatCueKey('  There   is nothing to tell!  ');
  assert.equal(key1, key2);
  assert.equal(key1, 'there is nothing to tell!');
});
