import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateEnglishTextTrack,
  captureAndTurnOffSubtitles,
  disableShowingTextTracks,
  findAudioSubtitleButton,
  findEnglishOptionElement,
  findOffOptionElement,
  isEnglishTrack
} from '../src/shared/auto-enabler.js';

test('isEnglishTrack - identifies English tracks by language code or (localized) label', () => {
  assert.equal(isEnglishTrack({ language: 'en', label: 'English' }), true);
  assert.equal(isEnglishTrack({ language: 'en-US', label: 'English [CC]' }), true);
  assert.equal(isEnglishTrack({ language: 'eng', label: 'English' }), true);
  assert.equal(isEnglishTrack({ language: '', label: 'English (Original)' }), true);
  assert.equal(isEnglishTrack({ language: '', label: 'Tiếng Anh' }), true);

  assert.equal(isEnglishTrack({ language: 'es', label: 'Español' }), false);
  assert.equal(isEnglishTrack({ language: 'vi', label: 'Tiếng Việt' }), false);
  assert.equal(isEnglishTrack(null), false);
});

test('activateEnglishTextTrack - moves a disabled English track to HIDDEN (never showing, to avoid dual subtitles)', () => {
  const tracks = [
    { language: 'es', label: 'Spanish', mode: 'disabled' },
    { language: 'en', label: 'English [CC]', mode: 'disabled' }
  ];
  const activated = activateEnglishTextTrack({ textTracks: tracks });

  assert.equal(activated, true);
  assert.equal(tracks[1].mode, 'hidden');
  assert.equal(tracks[0].mode, 'disabled');
});

test('activateEnglishTextTrack - leaves an already active English track untouched', () => {
  const tracks = [{ language: 'en', label: 'English', mode: 'showing' }];
  assert.equal(activateEnglishTextTrack({ textTracks: tracks }), true);
  assert.equal(tracks[0].mode, 'showing');
});

test('activateEnglishTextTrack - returns false if no English track is found', () => {
  const tracks = [{ language: 'es', label: 'Spanish', mode: 'disabled' }];
  assert.equal(activateEnglishTextTrack({ textTracks: tracks }), false);
});

test('findAudioSubtitleButton - finds button by English aria-label', () => {
  const mockContainer = {
    querySelector: (selector) =>
      selector.includes('Audio and Subtitles') ? { tagName: 'BUTTON', ariaLabel: 'Audio and Subtitles' } : null
  };
  const btn = findAudioSubtitleButton(mockContainer);
  assert.equal(btn.ariaLabel, 'Audio and Subtitles');
});

test('findAudioSubtitleButton - finds button in a Vietnamese-localized HBO UI', () => {
  const vi = {
    tagName: 'BUTTON',
    textContent: '',
    getAttribute: (n) => (n === 'aria-label' ? 'Âm thanh và phụ đề' : null)
  };
  const other = { tagName: 'BUTTON', textContent: '', getAttribute: () => 'Âm lượng' };
  const mockContainer = {
    querySelector: () => null,
    querySelectorAll: () => [other, vi]
  };
  assert.equal(findAudioSubtitleButton(mockContainer), vi);
});

function option(text, testId = null) {
  return { textContent: text, getAttribute: (n) => (n === 'data-testid' ? testId : null) };
}

test('findEnglishOptionElement - locates English subtitle option (English and Vietnamese labels)', () => {
  const english = option('English [CC]', 'subtitle-option-en');
  const dialog = { querySelectorAll: () => [option('Tắt'), english, option('Español')] };
  assert.equal(findEnglishOptionElement(dialog), english);

  const viLabel = option('Tiếng Anh');
  assert.equal(findEnglishOptionElement({ querySelectorAll: () => [option('Tắt'), viLabel] }), viLabel);
});

test('findEnglishOptionElement - refuses to guess when English appears twice (audio + subtitles) with no heading', () => {
  const dialog = { querySelectorAll: () => [option('English'), option('English')] };
  assert.equal(findEnglishOptionElement(dialog), null);
});

test('findEnglishOptionElement - with a Subtitles heading, picks the English option after it (not the audio one)', () => {
  const FOLLOWING = 4;
  const audioEn = option('English');
  const subHeading = option('Phụ đề');
  const subEn = option('English');
  const order = [option('Âm thanh'), audioEn, subHeading, subEn];
  order.forEach((n, i) => {
    n.compareDocumentPosition = (other) => (order.indexOf(other) > i ? FOLLOWING : 2);
  });
  const dialog = { querySelectorAll: () => order };
  assert.equal(findEnglishOptionElement(dialog), subEn);
});

test('findOffOptionElement - locates Off / Tắt subtitle option after Subtitles heading', () => {
  const FOLLOWING = 4;
  const subHeading = option('Phụ đề');
  const offVi = option('Tắt', 'subtitle-option-off');
  const subEn = option('Tiếng Anh');
  const order = [option('Âm thanh'), option('Tiếng Anh'), subHeading, offVi, subEn];
  order.forEach((n, i) => {
    n.compareDocumentPosition = (other) => (order.indexOf(other) > i ? FOLLOWING : 2);
  });
  const dialog = { querySelectorAll: () => order };
  assert.equal(findOffOptionElement(dialog), offVi);

  const offEn = option('Off');
  assert.equal(findOffOptionElement({ querySelectorAll: () => [offEn, subEn] }), offEn);
});

test('disableShowingTextTracks - hides any showing textTracks so native captions never overlap', () => {
  const tracks = [
    { language: 'en', label: 'English', mode: 'showing' },
    { language: 'es', label: 'Spanish', mode: 'disabled' }
  ];
  disableShowingTextTracks({ textTracks: tracks });
  assert.equal(tracks[0].mode, 'hidden');
  assert.equal(tracks[1].mode, 'disabled');
});

test('captureAndTurnOffSubtitles - turns English ON briefly (1-2s), captures cues, then turns subtitles OFF', async () => {
  const clicks = [];
  const btn = {
    tagName: 'BUTTON',
    getAttribute: (n) => (n === 'aria-label' ? 'Âm thanh và phụ đề' : null),
    click: () => clicks.push('menu-btn')
  };
  const offOpt = {
    textContent: 'Tắt',
    getAttribute: (n) => (n === 'data-testid' ? 'subtitle-option-off' : null),
    click: () => clicks.push('sub-off')
  };
  const enOpt = {
    textContent: 'Tiếng Anh',
    getAttribute: (n) => (n === 'data-testid' ? 'subtitle-option-en' : null),
    click: () => {
      clicks.push('sub-en');
      cuesCaptured = true;
    }
  };
  const closeBtn = {
    tagName: 'BUTTON',
    getAttribute: (n) => (n === 'aria-label' ? 'Đóng' : null),
    click: () => clicks.push('close-btn')
  };

  let cuesCaptured = false;
  const mockContainer = {
    querySelector: (sel) => {
      if (sel.includes('phụ đề')) return btn;
      if (sel.includes('Close') || sel.includes('Đóng')) return closeBtn;
      return null;
    },
    querySelectorAll: () => [offOpt, enOpt]
  };
  const mockVideo = {
    textTracks: [{ language: 'en', label: 'English', mode: 'showing' }]
  };

  const result = await captureAndTurnOffSubtitles(mockVideo, mockContainer, {
    hasCapturedCues: () => cuesCaptured,
    minHoldMs: 50,
    maxHoldMs: 300,
    pollIntervalMs: 25
  });

  assert.equal(result, true);
  assert.deepEqual(clicks, ['menu-btn', 'sub-en', 'sub-off', 'close-btn']);
  assert.equal(mockVideo.textTracks[0].mode, 'hidden');
});
