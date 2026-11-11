/**
 * Max VietSub - Content Script
 * HBO Max & Max.com Pure Vietnamese Subtitle Detector & Renderer
 */

(async function initMaxVietSub() {
  'use strict';

  // --- Shared Helpers (with built-in fallbacks) ---
  let cleanSubtitleText = (text) => {
    if (typeof text !== 'string') return '';
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .split(/\r?\n/)
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  };

  let isVietnameseText = (text) => {
    if (!text || typeof text !== 'string') return false;
    return /[ăâđêôơưĂÂĐÊÔƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ]/.test(
      text
    );
  };

  let isExcludedUIIdentifier = (identifier) => {
    if (!identifier || typeof identifier !== 'string') return false;
    const lower = identifier.toLowerCase();
    const excluded = [
      'seasonepisode',
      'asset-subtitle',
      'episode-subtitle',
      'show-subtitle',
      'series-subtitle',
      'sub-title',
      'title',
      'control',
      'button',
      'menu',
      'picker',
      'dialog',
      'modal',
      'settings',
      'scrubber',
      'seek',
      'slider',
      'time',
      'duration',
      'progress',
      'header',
      'footer',
      'metadata',
      'browse',
      'rail',
      'tile',
      'card',
      'tab',
      'synopsis',
      'description',
      'advisory',
      'rating',
      'upnext',
      'skip',
      'promo',
      'toast',
      'badge',
      'tooltip'
    ];
    return excluded.some((p) => lower.includes(p));
  };

  let shouldSkipSubtitleText = (text) => {
    if (!text || typeof text !== 'string') return true;
    const t = text.trim();
    if (!t) return true;
    if (/^\[[\s\S]*\]$/.test(t)) return true;
    if (/^\([\s\S]*\)$/.test(t)) return true;
    if (/^[♪♫#][\s\S]*[♪♫#]$/.test(t) || /^[♪♫#\s]+$/.test(t)) return true;
    return false;
  };

  let findActiveCuesText = (cues, currentTime) => {
    if (!Array.isArray(cues) || cues.length === 0 || typeof currentTime !== 'number') return '';
    const active = [];
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      if (currentTime >= c.startTime && currentTime <= c.endTime) {
        if (c.text && !active.includes(c.text)) active.push(c.text);
      }
    }
    return active.join('\n');
  };

  let formatSubtitleHtml = (text) => {
    if (!text || typeof text !== 'string') return '';
    const sanitize = (s) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `<span class="max-sub-line">${sanitize(l)}</span>`)
      .join('<br>');
  };

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const cueModule = await import(chrome.runtime.getURL('src/shared/cue-processor.js'));
      if (cueModule.cleanSubtitleText) cleanSubtitleText = cueModule.cleanSubtitleText;
      if (cueModule.isVietnameseText) isVietnameseText = cueModule.isVietnameseText;
      if (cueModule.isExcludedUIIdentifier) isExcludedUIIdentifier = cueModule.isExcludedUIIdentifier;
      if (cueModule.shouldSkipSubtitleText) shouldSkipSubtitleText = cueModule.shouldSkipSubtitleText;
      if (cueModule.findActiveCuesText) findActiveCuesText = cueModule.findActiveCuesText;

      const overlayModule = await import(chrome.runtime.getURL('src/shared/overlay-helper.js'));
      if (overlayModule.formatSubtitleHtml) formatSubtitleHtml = overlayModule.formatSubtitleHtml;
    }
  } catch (_) {
    // Fallback functions remain active
  }

  // --- State Configuration ---
  const state = {
    enabled: true,
    fontSize: 24,
    currentCleanText: '',
    lastSourceType: '',
    videoElement: null,
    playerContainer: null,
    overlayElement: null,
    observedTracks: new WeakSet(),
    domObserver: null,
    interceptedCues: [],
    interceptedCueKeys: new Set(),
    localTranslations: new Map()
  };

  // --- Listen to MAIN World Page Hook (Network VTT/TTML + addCue) ---
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'MAX_VIETSUB_PAGE_HOOK') {
      return;
    }
    if (event.data.type === 'CUES_BATCH' && Array.isArray(event.data.cues)) {
      for (const cue of event.data.cues) {
        if (
          typeof cue.startTime === 'number' &&
          typeof cue.endTime === 'number' &&
          typeof cue.text === 'string'
        ) {
          const cleaned = cleanSubtitleText(cue.text);
          if (!cleaned || shouldSkipSubtitleText(cleaned)) continue;
          const key = `${cue.startTime.toFixed(2)}-${cue.endTime.toFixed(2)}-${cleaned}`;
          if (!state.interceptedCueKeys.has(key)) {
            state.interceptedCueKeys.add(key);
            state.interceptedCues.push({
              startTime: cue.startTime,
              endTime: cue.endTime,
              text: cleaned
            });
          }
        }
      }
      // Pre-warm translation for upcoming cues near current playback time
      prewarmUpcomingCues();
    }
  });

  function prewarmUpcomingCues() {
    if (!state.enabled || !state.videoElement || state.interceptedCues.length === 0) return;
    const now = state.videoElement.currentTime || 0;
    const upcoming = state.interceptedCues
      .filter((c) => c.startTime >= now - 2 && c.startTime <= now + 35)
      .slice(0, 8);

    for (const c of upcoming) {
      if (!state.localTranslations.has(c.text) && !isVietnameseText(c.text)) {
        sendTranslateMessage(c.text, () => {});
      }
    }
  }

  // --- Settings Management ---
  function loadInitialSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const storage = chrome.storage.sync || chrome.storage.local;
      storage.get({ enabled: true, fontSize: 24 }, (items) => {
        state.enabled = items.enabled !== false;
        state.fontSize = Number(items.fontSize) || 24;
        updateUIState();
      });
    }
  }

  function updateUIState() {
    if (state.enabled) {
      document.documentElement.classList.add('max-vietsub-active');
      document.body?.classList.add('max-vietsub-active');
      if (state.overlayElement) {
        state.overlayElement.style.fontSize = `${state.fontSize}px`;
        if (!state.currentCleanText) {
          state.overlayElement.classList.add('hidden');
        }
      }
    } else {
      document.documentElement.classList.remove('max-vietsub-active');
      document.body?.classList.remove('max-vietsub-active');
      if (state.overlayElement) {
        state.overlayElement.classList.add('hidden');
        state.overlayElement.innerHTML = '';
      }
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === 'SETTINGS_CHANGED' && message.settings) {
        state.enabled = message.settings.enabled !== false;
        if (message.settings.fontSize) {
          state.fontSize = Number(message.settings.fontSize);
        }
        updateUIState();
        if (state.enabled && state.currentCleanText) {
          requestTranslation(state.currentCleanText);
        }
      }
    });
  }

  // --- Overlay Element Creation & Fullscreen Resiliency ---
  function getOrCreateOverlay() {
    let overlay = document.getElementById('max-vietsub-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'max-vietsub-overlay';
      overlay.className = 'notranslate hidden';
      overlay.setAttribute('translate', 'no');
      overlay.style.fontSize = `${state.fontSize}px`;
    }
    state.overlayElement = overlay;
    ensureOverlayAttachment();
    return overlay;
  }

  function findBestPlayerContainer() {
    if (!state.videoElement || !state.videoElement.isConnected) {
      state.videoElement = document.querySelector('video');
    }
    if (!state.videoElement) return null;

    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl && fsEl.contains(state.videoElement)) {
      return fsEl;
    }

    const containerSelectors = [
      '[data-testid="player-container"]',
      '[data-testid="video-player"]',
      '.default-player-container',
      'div[class*="PlayerContainer"]',
      'div[class*="video-player"]'
    ];

    for (const selector of containerSelectors) {
      const el = state.videoElement.closest(selector);
      if (el) return el;
    }

    return state.videoElement.parentElement || document.body;
  }

  function ensureOverlayAttachment() {
    const targetContainer = findBestPlayerContainer();
    if (!targetContainer || !state.overlayElement) return;

    if (state.overlayElement.parentElement !== targetContainer) {
      const computedPos = window.getComputedStyle(targetContainer).position;
      if (computedPos === 'static') {
        targetContainer.style.position = 'relative';
      }
      targetContainer.appendChild(state.overlayElement);
    }
  }

  function handleFullscreenChange() {
    ensureOverlayAttachment();
    if (state.overlayElement) {
      state.overlayElement.style.fontSize = `${state.fontSize}px`;
    }
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  window.addEventListener('resize', ensureOverlayAttachment);

  // --- Subtitle Translation Pipeline ---
  function clearSubtitleOverlay() {
    state.currentCleanText = '';
    if (state.overlayElement) {
      state.overlayElement.classList.add('hidden');
      state.overlayElement.innerHTML = '';
    }
  }

  function handleSubtitleDetected(rawText, sourceType = 'dom') {
    if (!state.enabled) return;

    const cleaned = cleanSubtitleText(rawText);

    if (!cleaned || shouldSkipSubtitleText(cleaned)) {
      // Only clear if the same or higher priority source cleared it
      if (!rawText || sourceType === state.lastSourceType || state.lastSourceType === 'dom') {
        clearSubtitleOverlay();
      }
      return;
    }

    state.lastSourceType = sourceType;

    if (cleaned === state.currentCleanText) {
      return;
    }

    state.currentCleanText = cleaned;

    // If text is already Vietnamese, render directly without reverse-translating
    if (isVietnameseText(cleaned)) {
      renderSubtitles(cleaned);
      return;
    }

    // Check fast local map first
    if (state.localTranslations.has(cleaned)) {
      renderSubtitles(state.localTranslations.get(cleaned));
      return;
    }

    requestTranslation(cleaned);
  }

  function sendTranslateMessage(textToTranslate, callback) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: 'TRANSLATE_CUE',
        text: textToTranslate,
        sourceLang: 'en',
        targetLang: 'vi'
      },
      (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (response && response.translatedText) {
          state.localTranslations.set(textToTranslate, response.translatedText);
          callback(response.translatedText);
        }
      }
    );
  }

  function requestTranslation(textToTranslate) {
    sendTranslateMessage(textToTranslate, (translatedText) => {
      if (state.currentCleanText !== textToTranslate) {
        return;
      }
      if (state.enabled) {
        renderSubtitles(translatedText);
      }
    });
  }

  function renderSubtitles(vietnameseText) {
    const overlay = getOrCreateOverlay();
    overlay.innerHTML = formatSubtitleHtml(vietnameseText);
    overlay.style.fontSize = `${state.fontSize}px`;
    overlay.classList.remove('hidden');
  }

  // --- Layer 1 & 2: Sync with video.currentTime (Intercepted Cues + Native textTracks) ---
  function getActiveTextFromVideoTracks(video) {
    if (!video || !video.textTracks || video.textTracks.length === 0) return null;

    const tracks = Array.from(video.textTracks);
    const activeTracks = tracks.filter(
      (t) =>
        (t.kind === 'subtitles' || t.kind === 'captions') &&
        (t.mode === 'showing' || t.mode === 'hidden')
    );

    // If multiple tracks are active, prioritize English tracks
    activeTracks.sort((a, b) => {
      const aEn = /^en/i.test(a.language || '') || /english/i.test(a.label || '') ? -1 : 0;
      const bEn = /^en/i.test(b.language || '') || /english/i.test(b.label || '') ? -1 : 0;
      return aEn - bEn;
    });

    for (const track of activeTracks) {
      if (track.activeCues && track.activeCues.length > 0) {
        const text = Array.from(track.activeCues)
          .map((c) => c.text || '')
          .filter(Boolean)
          .join('\n');
        if (text.trim()) {
          return text;
        }
      }
    }

    return activeTracks.length > 0 ? '' : null;
  }

  function attachTrackListeners(video) {
    if (!video || !video.textTracks) return;

    function monitorTrack(track) {
      if (!track || state.observedTracks.has(track)) return;
      state.observedTracks.add(track);

      if (track.kind === 'subtitles' || track.kind === 'captions') {
        track.addEventListener('cuechange', () => {
          syncAllSubtitleSources();
        });
      }
    }

    for (let i = 0; i < video.textTracks.length; i++) {
      monitorTrack(video.textTracks[i]);
    }

    video.textTracks.addEventListener('addtrack', (e) => {
      if (e.track) monitorTrack(e.track);
    });
  }

  // --- Layer 3: Smart DOM Caption Detection (Excluding Player Controls & Episode Titles) ---
  const EXCLUDED_TAGS = new Set([
    'BUTTON',
    'A',
    'NAV',
    'HEADER',
    'FOOTER',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'INPUT',
    'SELECT',
    'UL',
    'LI',
    'SVG',
    'PATH'
  ]);

  const EXCLUDED_ROLES = new Set([
    'button',
    'menu',
    'menuitem',
    'menuitemradio',
    'menuitemcheckbox',
    'dialog',
    'tablist',
    'tab',
    'slider',
    'heading',
    'navigation',
    'toolbar'
  ]);

  function isExcludedDOMElement(el, stopContainer) {
    let curr = el;
    while (curr && curr !== stopContainer && curr !== document.body) {
      if (curr.id === 'max-vietsub-overlay') return true;
      if (EXCLUDED_TAGS.has(curr.tagName)) return true;

      const role = curr.getAttribute && curr.getAttribute('role');
      if (role && EXCLUDED_ROLES.has(role.toLowerCase())) return true;

      const className = typeof curr.className === 'string' ? curr.className : '';
      const testId = (curr.getAttribute && curr.getAttribute('data-testid')) || '';
      const id = curr.id || '';

      if (
        isExcludedUIIdentifier(className) ||
        isExcludedUIIdentifier(testId) ||
        isExcludedUIIdentifier(id)
      ) {
        return true;
      }

      curr = curr.parentElement;
    }
    return false;
  }

  const CAPTION_CONTAINER_SELECTORS = [
    '.shaka-text-container',
    '[data-testid="player-ux-text-track"]',
    '[data-testid="text-track-container"]',
    '[data-testid="caption-container"]',
    '[data-testid="captions-container"]',
    '[data-testid="subtitles-container"]',
    '[data-testid="cue-container"]',
    '[class^="Subtitle-Beam-Web"]',
    '[class*=" Subtitle-Beam-Web"]',
    '[class^="Subtitles-Beam-Web"]',
    '[class*=" Subtitles-Beam-Web"]',
    '[class^="Cue-Beam-Web"]',
    '[class*=" Cue-Beam-Web"]',
    '[class^="TextTrack-Beam-Web"]',
    '[class*=" TextTrack-Beam-Web"]',
    '[class^="Caption-Beam-Web"]',
    '[class*=" Caption-Beam-Web"]',
    '[class^="Captions-Beam-Web"]',
    '[class*=" Captions-Beam-Web"]',
    '.bmpui-ui-subtitle-overlay',
    '.vjs-text-track-display'
  ];

  function extractDOMCaptionText(container) {
    if (!container) return null;

    let foundValidContainer = false;
    const collectedLines = [];

    for (const sel of CAPTION_CONTAINER_SELECTORS) {
      const elements = container.querySelectorAll(sel);
      for (const el of elements) {
        if (isExcludedDOMElement(el, container)) continue;

        foundValidContainer = true;
        if (state.enabled && el.getAttribute('data-max-vietsub-hidden') !== 'true') {
          el.setAttribute('data-max-vietsub-hidden', 'true');
        }

        const raw = (el.innerText || el.textContent || '').trim();
        if (raw && !collectedLines.includes(raw)) {
          collectedLines.push(raw);
        }
      }
    }

    if (!foundValidContainer) return null;
    return collectedLines.join('\n');
  }

  function syncAllSubtitleSources() {
    if (!state.enabled || !state.videoElement) return;

    // 1. Check cues intercepted via MAIN world page hook (VTTCue / network VTT & TTML)
    if (state.interceptedCues.length > 0) {
      const hookedText = findActiveCuesText(
        state.interceptedCues,
        state.videoElement.currentTime || 0
      );
      if (hookedText) {
        handleSubtitleDetected(hookedText, 'hook');
        return;
      }
    }

    // 2. Check native HTML5 video.textTracks activeCues
    const trackText = getActiveTextFromVideoTracks(state.videoElement);
    if (trackText) {
      handleSubtitleDetected(trackText, 'track');
      return;
    }

    // 3. Check filtered DOM caption containers (excluding SeasonEpisodeSubtitleContainer & UI controls)
    const domText = extractDOMCaptionText(state.playerContainer || document.body);
    if (domText) {
      handleSubtitleDetected(domText, 'dom');
      return;
    }

    // 4. If none of the active sources currently have dialogue, clear the overlay
    if (state.currentCleanText) {
      clearSubtitleOverlay();
    }
  }

  function setupDOMCaptionsObserver(container) {
    if (state.domObserver) {
      state.domObserver.disconnect();
    }

    state.domObserver = new MutationObserver(() => {
      syncAllSubtitleSources();
    });

    state.domObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // --- Video Discovery & Bootstrap Loop ---
  let lastUrl = location.href;

  function discoverPlayer() {
    // Clear intercepted cues on episode/movie URL change
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      state.interceptedCues = [];
      state.interceptedCueKeys.clear();
      clearSubtitleOverlay();
    }

    const video = document.querySelector('video');
    if (video && video !== state.videoElement) {
      state.videoElement = video;
      attachTrackListeners(video);
      video.addEventListener('timeupdate', syncAllSubtitleSources);
      video.addEventListener('seeking', syncAllSubtitleSources);
      video.addEventListener('seeked', () => {
        syncAllSubtitleSources();
        prewarmUpcomingCues();
      });

      const container = findBestPlayerContainer();
      state.playerContainer = container;
      getOrCreateOverlay();

      if (container) {
        setupDOMCaptionsObserver(container);
      }
    }
  }

  const bodyObserver = new MutationObserver(() => {
    discoverPlayer();
    ensureOverlayAttachment();
  });

  bodyObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // High-frequency sync for smooth subtitle transitions (150ms)
  setInterval(() => {
    discoverPlayer();
    ensureOverlayAttachment();
    syncAllSubtitleSources();
  }, 150);

  // Initialize
  loadInitialSettings();
  discoverPlayer();
})();
