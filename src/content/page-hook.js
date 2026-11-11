/**
 * Max VietSub - MAIN World Page Hook
 * Non-destructively intercepts VTTCue / TextTrack.addCue and WebVTT / TTML subtitle payloads
 * from HBO Max's player (Beam-Web / Shaka Player) and forwards cues to the content script.
 */
(function initMaxVietSubPageHook() {
  'use strict';

  if (window.__MAX_VIETSUB_HOOK_INSTALLED__) return;
  window.__MAX_VIETSUB_HOOK_INSTALLED__ = true;

  function emitCues(cues, sourceType) {
    if (!Array.isArray(cues) || cues.length === 0) return;
    try {
      window.postMessage(
        {
          source: 'MAX_VIETSUB_PAGE_HOOK',
          type: 'CUES_BATCH',
          sourceType,
          cues
        },
        '*'
      );
    } catch (_) {
      // Ignore postMessage errors
    }
  }

  function parseTimestamp(raw) {
    if (!raw || typeof raw !== 'string') return NaN;
    const s = raw.trim();
    if (/^\d+(\.\d+)?ms$/i.test(s)) return parseFloat(s) / 1000;
    if (/^\d+(\.\d+)?s$/i.test(s)) return parseFloat(s);
    const parts = s.replace(',', '.').split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    if (parts.length === 4) {
      return (
        parseFloat(parts[0]) * 3600 +
        parseFloat(parts[1]) * 60 +
        parseFloat(parts[2]) +
        parseFloat(parts[3]) / 24
      );
    }
    return NaN;
  }

  function cleanText(raw) {
    if (typeof raw !== 'string') return '';
    return raw
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
  }

  function parsePayloadText(text) {
    if (!text || typeof text !== 'string') return [];
    const cues = [];

    // 1. Check for TTML / SMPTE-TT XML (<tt ... <p begin="..." end="...">)
    if (text.includes('<tt') && text.includes('<p')) {
      const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
      let match;
      while ((match = pRegex.exec(text)) !== null) {
        const attrs = match[1];
        const inner = match[2];
        const bMatch = attrs.match(/\bbegin\s*=\s*["']([^"']+)["']/i);
        const eMatch = attrs.match(/\bend\s*=\s*["']([^"']+)["']/i);
        const dMatch = attrs.match(/\bdur\s*=\s*["']([^"']+)["']/i);
        if (!bMatch) continue;
        const startTime = parseTimestamp(bMatch[1]);
        let endTime = eMatch ? parseTimestamp(eMatch[1]) : NaN;
        if (Number.isNaN(endTime) && dMatch) {
          const dur = parseTimestamp(dMatch[1]);
          if (!Number.isNaN(dur)) endTime = startTime + dur;
        }
        if (Number.isNaN(startTime) || Number.isNaN(endTime)) continue;
        const cleaned = cleanText(inner);
        if (cleaned) {
          cues.push({ startTime, endTime, text: cleaned });
        }
      }
      if (cues.length > 0) return cues;
    }

    // 2. Check for WebVTT
    if (text.includes('WEBVTT') || text.includes('-->')) {
      const blocks = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\n+/);
      for (const block of blocks) {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) continue;
        const arrowIdx = lines.findIndex((l) => l.includes('-->'));
        if (arrowIdx === -1) continue;
        const m = lines[arrowIdx].match(/([0-9:.,]+)\s*-->\s*([0-9:.,]+)/);
        if (!m) continue;
        const startTime = parseTimestamp(m[1]);
        const endTime = parseTimestamp(m[2]);
        if (Number.isNaN(startTime) || Number.isNaN(endTime)) continue;
        const cleaned = cleanText(lines.slice(arrowIdx + 1).join('\n'));
        if (cleaned) {
          cues.push({ startTime, endTime, text: cleaned });
        }
      }
    }

    return cues;
  }

  function inspectBufferOrText(data) {
    try {
      let text = '';
      if (typeof data === 'string') {
        text = data;
      } else if (data instanceof ArrayBuffer) {
        if (data.byteLength > 2 * 1024 * 1024) return; // Ignore huge video segments > 2MB
        text = new TextDecoder('utf-8', { fatal: false }).decode(data);
      } else if (ArrayBuffer.isView(data)) {
        if (data.byteLength > 2 * 1024 * 1024) return;
        text = new TextDecoder('utf-8', { fatal: false }).decode(data);
      }
      if (!text) return;
      if (text.includes('WEBVTT') || (text.includes('<tt') && text.includes('<p'))) {
        const cues = parsePayloadText(text);
        if (cues.length > 0) {
          emitCues(cues, 'network');
        }
      }
    } catch (_) {
      // Ignore decoding errors on binary buffers
    }
  }

  // --- Hook 1: TextTrack.prototype.addCue ---
  if (typeof TextTrack !== 'undefined' && TextTrack.prototype && TextTrack.prototype.addCue) {
    const origAddCue = TextTrack.prototype.addCue;
    TextTrack.prototype.addCue = function (cue) {
      try {
        if (
          cue &&
          typeof cue.startTime === 'number' &&
          typeof cue.endTime === 'number' &&
          typeof cue.text === 'string'
        ) {
          const cleaned = cleanText(cue.text);
          if (cleaned) {
            emitCues(
              [{ startTime: cue.startTime, endTime: cue.endTime, text: cleaned }],
              'addCue'
            );
          }
        }
      } catch (_) {}
      return origAddCue.apply(this, arguments);
    };
  }

  // --- Hook 2: window.fetch ---
  if (typeof window.fetch === 'function') {
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await origFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
        const contentType = (response.headers && response.headers.get('content-type')) || '';
        const isLikelySubtitle =
          /\.(vtt|ttml|dfxp|xml|mp4|m4s|dash|text)(\?|$)/i.test(url) ||
          /vtt|ttml|xml|text|mp4/i.test(contentType) ||
          /subtitle|caption|text/i.test(url);

        if (isLikelySubtitle && response && typeof response.clone === 'function') {
          const cloned = response.clone();
          cloned
            .arrayBuffer()
            .then((buf) => inspectBufferOrText(buf))
            .catch(() => {});
        }
      } catch (_) {}
      return response;
    };
  }

  // --- Hook 3: XMLHttpRequest ---
  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype) {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__maxVietSubUrl = typeof url === 'string' ? url : '';
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      this.addEventListener('load', function () {
        try {
          const url = this.__maxVietSubUrl || '';
          const isLikelySubtitle =
            /\.(vtt|ttml|dfxp|xml|mp4|m4s|dash)(\?|$)/i.test(url) ||
            /subtitle|caption|text/i.test(url);
          if (!isLikelySubtitle && this.responseType && this.responseType !== 'text') {
            return;
          }
          if (this.responseType === 'arraybuffer' && this.response) {
            inspectBufferOrText(this.response);
          } else if (
            (!this.responseType || this.responseType === 'text') &&
            typeof this.responseText === 'string'
          ) {
            inspectBufferOrText(this.responseText);
          }
        } catch (_) {}
      });
      return origSend.apply(this, arguments);
    };
  }
})();
