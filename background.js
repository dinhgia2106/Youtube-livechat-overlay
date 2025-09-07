// Background script for YouTube Chat Overlay Extension

// Extension installation/update handler
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.sync.set({
      overlayEnabled: false,
      opacity: 0.8,
      width: 400,
      height: 600,
      positionX: 20,
      positionY: 20
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get([
      'overlayEnabled',
      'opacity',
      'width',
      'height',
      'positionX',
      'positionY'
    ], function(result) {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'updateBadge') {
    chrome.action.setBadgeText({
      text: request.enabled ? 'ON' : 'OFF',
      tabId: sender.tab.id
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: request.enabled ? '#4CAF50' : '#f44336',
      tabId: sender.tab.id
    });
  }
});
