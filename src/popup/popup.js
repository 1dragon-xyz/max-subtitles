// Max VietSub - Popup Controller
document.addEventListener('DOMContentLoaded', async () => {
  const toggleEnabled = document.getElementById('toggle-enabled');
  const fontSizeInput = document.getElementById('font-size');
  const fontSizeValue = document.getElementById('font-size-value');
  const previewText = document.getElementById('preview-text');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const presetButtons = document.querySelectorAll('.preset-btn');

  // Default configuration
  const defaultSettings = {
    enabled: true,
    fontSize: 24
  };

  // Safe chrome storage accessor
  const storage = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync)
    ? chrome.storage.sync
    : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
      ? chrome.storage.local
      : null;

  // Load saved settings
  async function loadSettings() {
    if (storage) {
      storage.get(defaultSettings, (items) => {
        applySettingsToUI(items);
      });
    } else {
      applySettingsToUI(defaultSettings);
    }
  }

  // Update UI components
  function applySettingsToUI(settings) {
    const isEnabled = settings.enabled !== false;
    const size = Number(settings.fontSize) || 24;

    if (toggleEnabled) {
      toggleEnabled.checked = isEnabled;
    }

    if (fontSizeInput) {
      fontSizeInput.value = size;
    }

    if (fontSizeValue) {
      fontSizeValue.textContent = `${size}px`;
    }

    if (previewText) {
      previewText.style.fontSize = `${Math.min(size, 26)}px`;
      previewText.style.display = isEnabled ? 'inline-block' : 'none';
    }

    if (statusIndicator && statusText) {
      if (isEnabled) {
        statusIndicator.classList.remove('disabled');
        statusText.textContent = 'Đang bật';
      } else {
        statusIndicator.classList.add('disabled');
        statusText.textContent = 'Tạm tắt';
      }
    }

    // Update preset active class
    presetButtons.forEach(btn => {
      const btnSize = Number(btn.getAttribute('data-size'));
      if (btnSize === size) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Save settings and notify content scripts
  function saveSettings(settings) {
    if (storage) {
      storage.set(settings, () => {
        broadcastSettings(settings);
      });
    } else {
      broadcastSettings(settings);
    }
  }

  // Send message to active HBO Max / Max tabs
  function broadcastSettings(settings) {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SETTINGS_CHANGED',
          settings
        }).catch(() => {
          // Tab might not have content script injected (e.g. settings page)
        });
      }
    });
  }

  // Event listener: Toggle
  if (toggleEnabled) {
    toggleEnabled.addEventListener('change', () => {
      const enabled = toggleEnabled.checked;
      const fontSize = Number(fontSizeInput ? fontSizeInput.value : 24);
      applySettingsToUI({ enabled, fontSize });
      saveSettings({ enabled, fontSize });
    });
  }

  // Event listener: Slider
  if (fontSizeInput) {
    fontSizeInput.addEventListener('input', () => {
      const size = Number(fontSizeInput.value);
      const enabled = toggleEnabled ? toggleEnabled.checked : true;
      applySettingsToUI({ enabled, fontSize: size });
      saveSettings({ enabled, fontSize: size });
    });
  }

  // Event listeners: Presets
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const size = Number(btn.getAttribute('data-size'));
      const enabled = toggleEnabled ? toggleEnabled.checked : true;
      applySettingsToUI({ enabled, fontSize: size });
      saveSettings({ enabled, fontSize: size });
    });
  });

  // Initial load
  loadSettings();
});
