document.addEventListener('DOMContentLoaded', function() {
  const enableCheckbox = document.getElementById('enableOverlay');
  const resetBtn = document.getElementById('resetBtn');
  const status = document.getElementById('status');
  const blockedListEl = document.getElementById('blockedList');

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
    'paused',
    'blockedAuthors'
  ], function(result) {
    const current = {
      overlayEnabled: result.overlayEnabled || false,
      opacity: result.opacity || 0.8,
      width: result.width || 400,
      height: result.height || 600,
      positionX: result.positionX || 20,
      positionY: result.positionY || 20,
      chatIntervalMs: typeof result.chatIntervalMs === 'number' ? result.chatIntervalMs : 500,
      paused: !!result.paused,
      blockedAuthors: Array.isArray(result.blockedAuthors) ? result.blockedAuthors : []
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

    function renderBlocked() {
      blockedListEl.innerHTML = '';
      if (!current.blockedAuthors.length) {
        const empty = document.createElement('div');
        empty.style.color = '#9ca3af';
        empty.style.fontSize = '12px';
        empty.textContent = 'No blocked users';
        blockedListEl.appendChild(empty);
        return;
      }
      current.blockedAuthors.forEach(function(name, idx) {
        const item = document.createElement('div');
        item.className = 'blocked-item';
        const label = document.createElement('div');
        label.textContent = name;
        const btn = document.createElement('button');
        btn.className = 'btn-unblock';
        btn.textContent = 'Unblock';
        btn.addEventListener('click', function() {
          current.blockedAuthors = current.blockedAuthors.filter(function(n) { return n !== name; });
          chrome.storage.sync.set({ blockedAuthors: current.blockedAuthors }, function() {
            renderBlocked();
            // Notify content script to refresh
            sendUpdate(current);
          });
        });
        item.appendChild(label);
        item.appendChild(btn);
        blockedListEl.appendChild(item);
      });
    }

    renderBlocked();

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
        paused: false,
        blockedAuthors: []
      };
      enableCheckbox.checked = false;
      chrome.storage.sync.set(defaults, function() {
        updateStatus();
        sendUpdate(defaults);
        renderBlocked();
      });
    });
  });
});
