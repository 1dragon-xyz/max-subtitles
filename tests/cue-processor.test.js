import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSubtitleText,
  shouldSkipSubtitleText,
  formatCueKey,
  isVietnameseText,
  isExcludedUIIdentifier,
  parseWebVTT,
  parseTTML,
  findActiveCuesText
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

test('isVietnameseText - detects Vietnamese diacritics to prevent reverse translation of "Mở Đầu"', () => {
  assert.equal(isVietnameseText('Mở Đầu'), true);
  assert.equal(isVietnameseText('Những Người Bạn'), true);
  assert.equal(isVietnameseText('M1 T1: Mở Đầu'), true);
  assert.equal(isVietnameseText('Có thể bạn cũng thích'), true);
  assert.equal(isVietnameseText('There is nothing to tell!'), false);
  assert.equal(isVietnameseText("He's just some guy I work with!"), false);
});

test('isExcludedUIIdentifier - rejects HBO Max episode titles and player controls', () => {
  assert.equal(isExcludedUIIdentifier('SeasonEpisodeSubtitleContainer-Beam-Web-Ent'), true);
  assert.equal(isExcludedUIIdentifier('player-ux-asset-subtitle'), true);
  assert.equal(isExcludedUIIdentifier('Title-Beam-Web'), true);
  assert.equal(isExcludedUIIdentifier('PlayerControls-Beam-Web'), true);
  assert.equal(isExcludedUIIdentifier('SubtitlePickerMenuButton'), true);
  assert.equal(isExcludedUIIdentifier('ScrubberTimeDisplay'), true);

  // Real caption containers must NOT be excluded
  assert.equal(isExcludedUIIdentifier('shaka-text-container'), false);
  assert.equal(isExcludedUIIdentifier('player-ux-text-track'), false);
  assert.equal(isExcludedUIIdentifier('CueBox-Beam-Web'), false);
});

test('parseWebVTT and findActiveCuesText - parses WebVTT cues and finds active dialogue by timestamp', () => {
  const sampleVtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.500
There's nothing to tell!

2
00:00:05.000 --> 00:00:08.200 align:center line:85%
<i>He's just some guy</i>
I work with!
`;

  const cues = parseWebVTT(sampleVtt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startTime, 1);
  assert.equal(cues[0].endTime, 4.5);
  assert.equal(cues[0].text, "There's nothing to tell!");
  assert.equal(cues[1].startTime, 5);
  assert.equal(cues[1].endTime, 8.2);
  assert.equal(cues[1].text, "He's just some guy\nI work with!");

  assert.equal(findActiveCuesText(cues, 2.5), "There's nothing to tell!");
  assert.equal(findActiveCuesText(cues, 4.7), '');
  assert.equal(findActiveCuesText(cues, 6.0), "He's just some guy\nI work with!");
});

test('parseTTML - parses TTML / SMPTE-TT XML cues accurately', () => {
  const sampleTtml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:00:10.000" end="00:00:12.500">Come on, you're going out with the guy!</p>
      <p begin="00:00:13.000" end="00:00:15.000">There's gotta be something<br/>wrong with him!</p>
    </div>
  </body>
</tt>`;

  const cues = parseTTML(sampleTtml);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startTime, 10);
  assert.equal(cues[0].endTime, 12.5);
  assert.equal(cues[0].text, "Come on, you're going out with the guy!");
  assert.equal(cues[1].text, "There's gotta be something\nwrong with him!");
});
