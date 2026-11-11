import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateEnglishTextTrack,
  findAudioSubtitleButton,
  findEnglishOptionElement,
  isEnglishTrack
} from '../src/shared/auto-enabler.js';

test('isEnglishTrack - correctly identifies English tracks by language code or label', () => {
  assert.equal(isEnglishTrack({ language: 'en', label: 'English' }), true);
  assert.equal(isEnglishTrack({ language: 'en-US', label: 'English [CC]' }), true);
  assert.equal(isEnglishTrack({ language: 'eng', label: 'English' }), true);
  assert.equal(isEnglishTrack({ language: '', label: 'English (Original)' }), true);

  // Non-English tracks
  assert.equal(isEnglishTrack({ language: 'es', label: 'Español' }), false);
  assert.equal(isEnglishTrack({ language: 'vi', label: 'Tiếng Việt' }), false);
  assert.equal(isEnglishTrack({ language: 'fr', label: 'Français' }), false);
  assert.equal(isEnglishTrack(null), false);
});

test('activateEnglishTextTrack - switches disabled English track to showing mode', () => {
  const tracks = [
    { language: 'es', label: 'Spanish', mode: 'disabled' },
    { language: 'en', label: 'English [CC]', mode: 'disabled' }
  ];

  const fakeVideo = { textTracks: tracks };
  const activated = activateEnglishTextTrack(fakeVideo);

  assert.equal(activated, true);
  assert.equal(tracks[1].mode, 'showing', 'English track should be switched to showing');
  assert.equal(tracks[0].mode, 'disabled', 'Spanish track should remain disabled');
});

test('activateEnglishTextTrack - returns false if no English track is found', () => {
  const tracks = [
    { language: 'es', label: 'Spanish', mode: 'disabled' }
  ];

  const fakeVideo = { textTracks: tracks };
  const activated = activateEnglishTextTrack(fakeVideo);

  assert.equal(activated, false);
});

test('findAudioSubtitleButton - finds button by accessibility aria-label or testid', () => {
  const mockContainer = {
    querySelector: (selector) => {
      if (selector.includes('Audio and Subtitles')) {
        return { tagName: 'BUTTON', ariaLabel: 'Audio and Subtitles' };
      }
      return null;
    }
  };

  const btn = findAudioSubtitleButton(mockContainer);
  assert.ok(btn);
  assert.equal(btn.ariaLabel, 'Audio and Subtitles');
});

test('findEnglishOptionElement - locates English subtitle option in dialog items', () => {
  const mockItems = [
    { textContent: 'Tắt / Off', getAttribute: () => null },
    { textContent: 'English [CC]', getAttribute: () => 'subtitle-option-en' },
    { textContent: 'Español', getAttribute: () => 'subtitle-option-es' }
  ];

  const mockDialog = {
    querySelectorAll: () => mockItems
  };

  const option = findEnglishOptionElement(mockDialog);
  assert.ok(option);
  assert.equal(option.textContent, 'English [CC]');
});
