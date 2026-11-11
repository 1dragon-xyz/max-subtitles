/**
 * Max VietSub - Content Script
 * HBO Max & Max.com Pure Vietnamese Subtitle Detector & Renderer
 */

(async function initMaxVietSub() {
  'use strict';

  // --- Dynamic or Fallback Shared Helpers ---
  let cleanSubtitleText = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>/g, '').split(/\r?\n/).map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
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

  let formatSubtitleHtml = (text) => {
    if (!text || typeof text !== 'string') return '';
    const sanitize = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => `<span class="max-sub-line">${sanitize(l)}</span>`).join('<br>');
  };

  // Attempt dynamic import of shared modules if available
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const cueModule = await import(chrome.runtime.getURL('src/shared/cue-processor.js'));
      if (cueModule.cleanSubtitleText) cleanSubtitleText = cueModule.cleanSubtitleText;
      if (cueModule.shouldSkipSubtitleText) shouldSkipSubtitleText = cueModule.shouldSkipSubtitleText;

      const overlayModule = await import(chrome.runtime.getURL('src/shared/overlay-helper.js'));
      if (overlayModule.formatSubtitleHtml) formatSubtitleHtml = overlayModule.formatSubtitleHtml;
    }
  } catch (err) {
    // Dynamic import failed (CSP or test runner); fallbacks remain active
  }

  // --- State Configuration ---
  const state = {
    enabled: true,
    fontSize: 24,
    currentRawText: '',
    currentCleanText: '',
    videoElement: null,
    playerContainer: null,
    overlayElement: null,
    observedTracks: new Set(),
    domObserver: null
  };

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

  // Listen for popup settings changes
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
      overlay.className = 'hidden';
      overlay.style.fontSize = `${state.fontSize}px`;
    }
    state.overlayElement = overlay;
    ensureOverlayAttachment();
    return overlay;
  }

  function findBestPlayerContainer() {
    if (!state.videoElement) {
      state.videoElement = document.querySelector('video');
    }
    if (!state.videoElement) return null;

    // Check fullscreen element first
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl && fsEl.contains(state.videoElement)) {
      return fsEl;
    }

    // Check standard HBO Max / Max player selectors
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
      // Ensure targetContainer is positioned for absolute overlay children
      const computedPos = window.getComputedStyle(targetContainer).position;
      if (computedPos === 'static') {
        targetContainer.style.position = 'relative';
      }
      targetContainer.appendChild(state.overlayElement);
    }
  }

  // Handle Fullscreen transitions seamlessly
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
  function handleSubtitleDetected(rawText) {
    if (!state.enabled) return;

    const cleaned = cleanSubtitleText(rawText);

    if (!cleaned || shouldSkipSubtitleText(cleaned)) {
      state.currentRawText = '';
      state.currentCleanText = '';
      if (state.overlayElement) {
        state.overlayElement.classList.add('hidden');
        state.overlayElement.innerHTML = '';
      }
      return;
    }

    if (cleaned === state.currentCleanText) {
      return; // Same text already displayed/translated
    }

    state.currentRawText = rawText;
    state.currentCleanText = cleaned;
    requestTranslation(cleaned);
  }

  function requestTranslation(textToTranslate) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }

    chrome.runtime.sendMessage({
      type: 'TRANSLATE_CUE',
      text: textToTranslate,
      sourceLang: 'en',
      targetLang: 'vi'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[MaxVietSub] Translation error:', chrome.runtime.lastError.message);
        return;
      }

      // Check if cue has not shifted while request was resolving
      if (state.currentCleanText !== textToTranslate) {
        return;
      }

      if (response && response.translatedText && state.enabled) {
        renderSubtitles(response.translatedText);
      }
    });
  }

  function renderSubtitles(vietnameseText) {
    const overlay = getOrCreateOverlay();
    overlay.innerHTML = formatSubtitleHtml(vietnameseText);
    overlay.style.fontSize = `${state.fontSize}px`;
    overlay.classList.remove('hidden');
  }

  // --- HTML5 Video textTracks Monitoring ---
  function attachTrackListeners(video) {
    if (!video || !video.textTracks) return;

    function monitorTrack(track) {
      if (state.observedTracks.has(track)) return;
      state.observedTracks.add(track);

      // Check if subtitle / caption track
      if (track.kind === 'subtitles' || track.kind === 'captions') {
        // If extension is active, hide native display to avoid overlap
        if (state.enabled) {
          track.mode = 'hidden';
        }

        track.addEventListener('cuechange', () => {
          if (!state.enabled) return;
          const cues = track.activeCues;
          if (cues && cues.length > 0) {
            const combinedText = Array.from(cues).map(c => c.text).join('\n');
            handleSubtitleDetected(combinedText);
          } else {
            handleSubtitleDetected('');
          }
        });
      }
    }

    // Existing tracks
    for (let i = 0; i < video.textTracks.length; i++) {
      monitorTrack(video.textTracks[i]);
    }

    // Newly added tracks
    video.textTracks.addEventListener('addtrack', (e) => {
      monitorTrack(e.track);
    });
  }

  // --- HBO Max / Max DOM Captions Monitoring ---
  function setupDOMCaptionsObserver(container) {
    if (state.domObserver) {
      state.domObserver.disconnect();
    }

    const captionSelectors = [
      '[data-testid*="subtitle"]',
      '[data-testid*="caption"]',
      '[data-testid*="cue"]',
      '.shaka-text-container',
      'div[class*="CueContainer"]',
      'div[class*="CaptionContainer"]',
      'div[class*="SubtitlesContainer"]'
    ];

    function inspectContainerForCaptions() {
      if (!state.enabled) return;

      for (const sel of captionSelectors) {
        const el = container.querySelector(sel);
        if (el && el.id !== 'max-vietsub-overlay' && !el.closest('#max-vietsub-overlay')) {
          const text = el.textContent || el.innerText;
          if (text && text.trim()) {
            handleSubtitleDetected(text);
            return;
          }
        }
      }
    }

    state.domObserver = new MutationObserver(() => {
      inspectContainerForCaptions();
    });

    state.domObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // --- Video Discovery & Bootstrap Loop ---
  function discoverPlayer() {
    const video = document.querySelector('video');
    if (video && video !== state.videoElement) {
      state.videoElement = video;
      attachTrackListeners(video);

      const container = findBestPlayerContainer();
      state.playerContainer = container;
      getOrCreateOverlay();

      if (container) {
        setupDOMCaptionsObserver(container);
      }
    }
  }

  // Observe body for video element insertions (HBO Max SPA navigation)
  const bodyObserver = new MutationObserver(() => {
    discoverPlayer();
    ensureOverlayAttachment();
  });

  bodyObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // Periodic safety check to ensure player and overlay stay attached
  setInterval(() => {
    discoverPlayer();
    ensureOverlayAttachment();
  }, 1500);

  // Initialize
  loadInitialSettings();
  discoverPlayer();
})();
