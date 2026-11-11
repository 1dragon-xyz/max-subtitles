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

  let ensureEnglishSubtitlesActive = async () => false;
  let captureAndTurnOffSubtitles = async () => false;
  let disableShowingTextTracks = () => {};
  let findNativeCaptionElements = () => [];

  // Opt-in diagnostics: run  localStorage.maxVietSubDebug = '1'  in the page console, then reload.
  const debugEnabled = () => {
    try {
      return localStorage.getItem('maxVietSubDebug') === '1';
    } catch (_) {
      return false;
    }
  };
  const dbg = (...args) => {
    if (debugEnabled()) console.info('[MaxVietSub]', ...args);
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

      const enablerModule = await import(chrome.runtime.getURL('src/shared/auto-enabler.js'));
      if (enablerModule.ensureEnglishSubtitlesActive) ensureEnglishSubtitlesActive = enablerModule.ensureEnglishSubtitlesActive;
      if (enablerModule.captureAndTurnOffSubtitles) captureAndTurnOffSubtitles = enablerModule.captureAndTurnOffSubtitles;
      if (enablerModule.disableShowingTextTracks) disableShowingTextTracks = enablerModule.disableShowingTextTracks;

      const nativeModule = await import(chrome.runtime.getURL('src/shared/native-caption.js'));
      if (nativeModule.findNativeCaptionElements) findNativeCaptionElements = nativeModule.findNativeCaptionElements;
    }
  } catch (err) {
    dbg('shared module import failed', String(err));
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
    localTranslations: new Map(),
    recentEnglish: [],
    hiddenNativeCount: 0,
    videoFoundAt: 0,
    lastCueSeenAt: 0,
    lastEnsureAt: 0,
    uiAttempts: 0,
    isCapturingSubtitles: false,
    lastCoverageLogAt: 0
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
      if (debugEnabled() && Date.now() - state.lastCoverageLogAt > 2000) {
        state.lastCoverageLogAt = Date.now();
        const maxEnd = state.interceptedCues.reduce((m, c) => Math.max(m, c.endTime), 0);
        const dur = state.videoElement ? state.videoElement.duration : NaN;
        dbg(`cues=${state.interceptedCues.length}, covered up to ${maxEnd.toFixed(0)}s of ${Number.isFinite(dur) ? dur.toFixed(0) : '?'}s (source: ${event.data.sourceType})`);
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
      if (state.videoElement) {
        triggerAutoCaptureAndTurnOff();
      }
    } else {
      document.documentElement.classList.remove('max-vietsub-active');
      document.body?.classList.remove('max-vietsub-active');
      document.querySelectorAll('[data-max-vietsub-hidden]').forEach((el) => el.removeAttribute('data-max-vietsub-hidden'));
      state.hiddenNativeCount = 0;
      if (state.overlayElement) {
        state.overlayElement.classList.add('hidden');
        state.overlayElement.innerHTML = '';
      }
    }
  }

  // --- Hide HBO's own English caption (found by matching its text, not by class name) ---
  function hideNativeCaptions() {
    if (!state.enabled || state.recentEnglish.length === 0) return;
    const root = state.playerContainer || document.body;
    const skipTags = new Set(['BUTTON', 'A', 'VIDEO', 'SCRIPT', 'STYLE', 'INPUT']);
    const els = findNativeCaptionElements(
      root,
      state.recentEnglish.join('\n'),
      (el) => el.id === 'max-vietsub-overlay' || skipTags.has(el.tagName)
    );
    for (const el of els) {
      if (el.getAttribute('data-max-vietsub-hidden') !== 'true') {
        el.setAttribute('data-max-vietsub-hidden', 'true');
      }
    }
    if (els.length !== state.hiddenNativeCount) {
      state.hiddenNativeCount = els.length;
      dbg(`hiding ${els.length} native caption element(s)`, els.map((e) => `${e.tagName}.${String(e.className).slice(0, 40)}`));
    }
  }

  // --- Brief Auto-Capture (1-2s) & Turn-Off so English cues are hooked and HBO caption stays OFF ---
  function triggerAutoCaptureAndTurnOff() {
    if (!state.enabled || !state.videoElement || state.isCapturingSubtitles) return;
    if (state.interceptedCues.length > 0) {
      disableShowingTextTracks(state.videoElement);
      return;
    }

    state.isCapturingSubtitles = true;
    state.lastEnsureAt = Date.now();
    state.uiAttempts++;

    captureAndTurnOffSubtitles(state.videoElement, state.playerContainer || document.body, {
      hasCapturedCues: () => state.interceptedCues.length > 0,
      minHoldMs: 1200,
      maxHoldMs: 2500,
      pollIntervalMs: 150,
      log: dbg
    })
      .then((ok) => {
        dbg(`captureAndTurnOffSubtitles (attempt ${state.uiAttempts}) ->`, ok, `cues=${state.interceptedCues.length}`);
      })
      .finally(() => {
        state.isCapturingSubtitles = false;
      });
  }

  // --- Keep English cues flowing even if the user left HBO subtitles off or refreshed ---
  function maintainEnglishSubtitles() {
    if (!state.enabled || !state.videoElement || state.isCapturingSubtitles) return;

    // Once cues are captured, ensure native showing tracks are hidden so English never overlaps
    if (state.interceptedCues.length > 0) {
      disableShowingTextTracks(state.videoElement);
    }

    const now = Date.now();

    // If we have not captured any cues yet after video load/refresh, trigger after 1.5s
    if (state.interceptedCues.length === 0) {
      const waitSinceVideo = now - state.videoFoundAt;
      if (waitSinceVideo < 1500) return;
      const spacing = state.uiAttempts < 3 ? 2500 : 20000;
      if (now - state.lastEnsureAt < spacing) return;
      triggerAutoCaptureAndTurnOff();
      return;
    }

    // Recently saw dialogue => subtitles are on.
    const idleMs = now - Math.max(state.lastCueSeenAt, state.videoFoundAt);
    const idleNeeded = state.lastCueSeenAt ? 15000 : 4000;
    if (idleMs < idleNeeded) return;

    // A cue is coming up soon or we already have cues covering ahead => we are good.
    const t = state.videoElement.currentTime || 0;
    if (state.interceptedCues.some((c) => c.endTime > t)) return;

    const spacing = state.uiAttempts < 3 ? 3000 : 30000;
    if (now - state.lastEnsureAt < spacing) return;
    triggerAutoCaptureAndTurnOff();
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

    if (sourceType !== state.lastSourceType) dbg('caption source:', sourceType);
    state.lastSourceType = sourceType;
    state.lastCueSeenAt = Date.now();
    state.uiAttempts = 0;

    if (!isVietnameseText(cleaned) && state.recentEnglish[state.recentEnglish.length - 1] !== cleaned) {
      state.recentEnglish.push(cleaned);
      if (state.recentEnglish.length > 3) state.recentEnglish.shift();
    }
    hideNativeCaptions();

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
        // If extension is active and track is disabled, attempt to set track.mode = 'hidden'
        // so the browser collects cues in background without showing native text
        if (state.enabled && track.mode === 'disabled') {
          const lang = (track.language || '').toLowerCase();
          const label = (track.label || '').toLowerCase();
          if (lang.startsWith('en') || label.includes('english') || !lang) {
            try {
              track.mode = 'hidden';
            } catch (_) {}
          }
        }

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
      hideNativeCaptions();
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
      state.recentEnglish = [];
      state.lastCueSeenAt = 0;
      state.videoFoundAt = Date.now();
      state.uiAttempts = 0;
      clearSubtitleOverlay();
    }

    const video = document.querySelector('video');
    if (video && video !== state.videoElement) {
      state.videoElement = video;
      state.videoFoundAt = Date.now();
      state.lastCueSeenAt = 0;
      state.uiAttempts = 0;
      attachTrackListeners(video);
      dbg(
        'video found; text tracks:',
        Array.from(video.textTracks || []).map((t) => `${t.kind}/${t.language}/${t.label}/${t.mode}`)
      );
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
    hideNativeCaptions();
    maintainEnglishSubtitles();
  }, 150);

  // Initialize
  loadInitialSettings();
  discoverPlayer();
})();
