document.addEventListener('DOMContentLoaded', function() {
  const enableCheckbox = document.getElementById('enableOverlay');
  const resetBtn = document.getElementById('resetBtn');
  const status = document.getElementById('status');

  function updateStatus() {
    status.textContent = enableCheckbox.checked ? 'Overlay enabled' : 'Overlay disabled';
  }

  function sendUpdate(settings) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || !tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateSettings',
        settings: settings
      });
    });
  }

  // Load saved settings
  chrome.storage.sync.get([
    'overlayEnabled',
    'opacity',
    'width',
    'height',
    'positionX',
    'positionY',
    'chatIntervalMs',
    'paused'
  ], function(result) {
    const current = {
      overlayEnabled: result.overlayEnabled || false,
      opacity: result.opacity || 0.8,
      width: result.width || 400,
      height: result.height || 600,
      positionX: result.positionX || 20,
      positionY: result.positionY || 20,
      chatIntervalMs: typeof result.chatIntervalMs === 'number' ? result.chatIntervalMs : 500,
      paused: !!result.paused
    };

    enableCheckbox.checked = current.overlayEnabled;
    updateStatus();

    // Toggle enable state
    enableCheckbox.addEventListener('change', function() {
      current.overlayEnabled = enableCheckbox.checked;
      chrome.storage.sync.set(current, function() {
        updateStatus();
        sendUpdate(current);
      });
    });

    // Reset to defaults
    resetBtn.addEventListener('click', function() {
      const defaults = {
        overlayEnabled: false,
        opacity: 0.8,
        width: 400,
        height: 600,
        positionX: 20,
        positionY: 20,
        chatIntervalMs: 500,
        paused: false
      };
      enableCheckbox.checked = false;
      chrome.storage.sync.set(defaults, function() {
        updateStatus();
        sendUpdate(defaults);
      });
    });
  });
});
