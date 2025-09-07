let overlay = null;
let chatContainer = null;
let settings = {
  overlayEnabled: false,
  opacity: 0.8,
  width: 400,
  height: 600,
  positionX: 20,
  positionY: 20
};

// Initialize extension
function init() {
  // Load settings from storage
  chrome.storage.sync.get([
    'overlayEnabled',
    'opacity',
    'width',
    'height',
    'positionX',
    'positionY'
  ], function(result) {
    settings = {
      overlayEnabled: result.overlayEnabled || false,
      opacity: result.opacity || 0.8,
      width: result.width || 400,
      height: result.height || 600,
      positionX: result.positionX || 20,
      positionY: result.positionY || 20
    };
    
    if (settings.overlayEnabled) {
      createOverlay();
    }
  });
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateSettings') {
      settings = request.settings;
      if (settings.overlayEnabled) {
        createOverlay();
      } else {
        removeOverlay();
      }
    }
  });
  
  // Monitor for fullscreen changes
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}

function handleFullscreenChange() {
  const isFullscreen = !!(document.fullscreenElement || 
                         document.webkitFullscreenElement || 
                         document.mozFullScreenElement || 
                         document.msFullscreenElement);
  
  if (isFullscreen && settings.overlayEnabled) {
    showOverlay();
  } else {
    hideOverlay();
  }
}

function createOverlay() {
  if (overlay) {
    removeOverlay();
  }
  
  // Create overlay container
  overlay = document.createElement('div');
  overlay.id = 'youtube-chat-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: ${settings.positionY}px;
    left: ${settings.positionX}px;
    width: ${settings.width}px;
    height: ${settings.height}px;
    background-color: rgba(0, 0, 0, ${settings.opacity});
    border: none;
    border-radius: 8px;
    z-index: 999999;
    display: none;
    font-family: Arial, sans-serif;
    color: white;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    cursor: move;
    user-select: none;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    background-color: rgba(0, 0, 0, ${settings.opacity});
    padding: 8px 12px;
    font-weight: bold;
    font-size: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
  `;
  header.innerHTML = `
    <span>Live Chat</span>
    <div style="display: flex; gap: 8px;">
      <button id="overlay-settings" style="background: none; border: none; color: white; cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 3px; background-color: rgba(255,255,255,0.1);">⚙</button>
      <button id="overlay-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">&times;</button>
    </div>
  `;
  
  // Create chat container
  chatContainer = document.createElement('div');
  chatContainer.id = 'overlay-chat-container';
  chatContainer.style.cssText = `
    height: calc(100% - 40px);
    overflow-y: auto;
    padding: 8px;
    font-size: 13px;
    line-height: 1.4;
  `;
  
  // Add close button functionality
  header.querySelector('#overlay-close').addEventListener('click', function() {
    removeOverlay();
  });
  
  // Create resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.style.cssText = `
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    cursor: nw-resize;
    background: linear-gradient(-45deg, transparent 0%, transparent 30%, rgba(255,255,255,0.5) 30%, rgba(255,255,255,0.5) 40%, transparent 40%, transparent 70%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0.5) 80%, transparent 80%);
  `;
  
  overlay.appendChild(header);
  overlay.appendChild(chatContainer);
  overlay.appendChild(resizeHandle);
  document.body.appendChild(overlay);
  
  // Add drag functionality
  addDragFunctionality(overlay, header);
  
  // Add resize functionality
  addResizeFunctionality(overlay, resizeHandle);
  
  // Add settings functionality
  addSettingsFunctionality();
  
  // Start monitoring chat
  startChatMonitoring();
}

function removeOverlay() {
  if (overlay) {
    // Clear interval
    if (overlay.chatInterval) {
      clearInterval(overlay.chatInterval);
    }
    
    overlay.remove();
    overlay = null;
    chatContainer = null;
  }
}

// Drag functionality
function addDragFunctionality(overlayElement, dragHandle) {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  dragHandle.addEventListener('mousedown', function(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(overlayElement.style.left);
    startTop = parseInt(overlayElement.style.top);
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
  });
  
  function handleDrag(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newLeft = startLeft + deltaX;
    const newTop = startTop + deltaY;
    
    // Keep within viewport bounds
    const maxLeft = window.innerWidth - overlayElement.offsetWidth;
    const maxTop = window.innerHeight - overlayElement.offsetHeight;
    
    overlayElement.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
    overlayElement.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
  }
  
  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
    
    // Save new position
    settings.positionX = parseInt(overlayElement.style.left);
    settings.positionY = parseInt(overlayElement.style.top);
    chrome.storage.sync.set(settings);
  }
}

// Resize functionality
function addResizeFunctionality(overlayElement, resizeHandle) {
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  
  resizeHandle.addEventListener('mousedown', function(e) {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(overlayElement.style.width);
    startHeight = parseInt(overlayElement.style.height);
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
  });
  
  function handleResize(e) {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newWidth = Math.max(200, startWidth + deltaX);
    const newHeight = Math.max(200, startHeight + deltaY);
    
    overlayElement.style.width = newWidth + 'px';
    overlayElement.style.height = newHeight + 'px';
  }
  
  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    
    // Save new size
    settings.width = parseInt(overlayElement.style.width);
    settings.height = parseInt(overlayElement.style.height);
    chrome.storage.sync.set(settings);
  }
}

// Settings functionality
function addSettingsFunctionality() {
  const settingsBtn = overlay.querySelector('#overlay-settings');
  let settingsPanel = null;
  
  settingsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    
    if (settingsPanel) {
      settingsPanel.remove();
      settingsPanel = null;
      return;
    }
    
    // Create settings panel
    settingsPanel = document.createElement('div');
    settingsPanel.style.cssText = `
      position: absolute;
      top: 40px;
      right: 0;
      width: 200px;
      background-color: rgba(0, 0, 0, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 12px;
      z-index: 1000000;
      font-size: 12px;
    `;
    
    settingsPanel.innerHTML = `
      <div style="margin-bottom: 8px;">
        <label style="display: block; margin-bottom: 4px;">Opacity: ${settings.opacity}</label>
        <input type="range" id="overlay-opacity" min="0.1" max="1" step="0.1" value="${settings.opacity}" style="width: 100%;">
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; margin-bottom: 4px;">Width: ${settings.width}px</label>
        <input type="range" id="overlay-width" min="200" max="800" step="10" value="${settings.width}" style="width: 100%;">
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; margin-bottom: 4px;">Height: ${settings.height}px</label>
        <input type="range" id="overlay-height" min="200" max="800" step="10" value="${settings.height}" style="width: 100%;">
      </div>
      <button id="overlay-reset" style="width: 100%; padding: 6px; background-color: rgba(255,255,255,0.1); border: none; color: white; border-radius: 4px; cursor: pointer;">Reset</button>
    `;
    
    overlay.appendChild(settingsPanel);
    
    // Add event listeners
    const opacitySlider = settingsPanel.querySelector('#overlay-opacity');
    const widthSlider = settingsPanel.querySelector('#overlay-width');
    const heightSlider = settingsPanel.querySelector('#overlay-height');
    const resetBtn = settingsPanel.querySelector('#overlay-reset');
    
    opacitySlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      overlay.style.backgroundColor = `rgba(0, 0, 0, ${value})`;
      header.style.backgroundColor = `rgba(0, 0, 0, ${value})`;
      settings.opacity = value;
      chrome.storage.sync.set(settings);
    });
    
    widthSlider.addEventListener('input', function() {
      const value = parseInt(this.value);
      overlay.style.width = value + 'px';
      settings.width = value;
      chrome.storage.sync.set(settings);
    });
    
    heightSlider.addEventListener('input', function() {
      const value = parseInt(this.value);
      overlay.style.height = value + 'px';
      settings.height = value;
      chrome.storage.sync.set(settings);
    });
    
    resetBtn.addEventListener('click', function() {
      settings.opacity = 0.8;
      settings.width = 400;
      settings.height = 600;
      settings.positionX = 20;
      settings.positionY = 20;
      
      overlay.style.backgroundColor = `rgba(0, 0, 0, ${settings.opacity})`;
      header.style.backgroundColor = `rgba(0, 0, 0, ${settings.opacity})`;
      overlay.style.width = settings.width + 'px';
      overlay.style.height = settings.height + 'px';
      overlay.style.left = settings.positionX + 'px';
      overlay.style.top = settings.positionY + 'px';
      
      chrome.storage.sync.set(settings);
      settingsPanel.remove();
      settingsPanel = null;
    });
    
    // Close settings when clicking outside
    setTimeout(() => {
      document.addEventListener('click', function closeSettings(e) {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
          settingsPanel.remove();
          settingsPanel = null;
          document.removeEventListener('click', closeSettings);
        }
      });
    }, 100);
  });
}

function showOverlay() {
  if (overlay) {
    overlay.style.display = 'block';
  }
}

function hideOverlay() {
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function startChatMonitoring() {
  // Function to extract chat messages from YouTube
  function extractChatMessages() {
    // Look for YouTube live chat elements
    const chatSelectors = [
      '#chatframe',
      '#chat',
      'ytd-live-chat-frame',
      'ytd-live-chat-renderer',
      '[id*="chat"]',
      '[class*="chat"]',
      '[class*="live-chat"]'
    ];
    
    let chatElement = null;
    for (const selector of chatSelectors) {
      chatElement = document.querySelector(selector);
      if (chatElement) break;
    }
    
    if (!chatElement) {
      // Try to find chat in iframe
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          if (iframe.src && (iframe.src.includes('youtube.com/live_chat') || iframe.src.includes('live_chat'))) {
            chatElement = iframe;
            break;
          }
        } catch (e) {
          // Cross-origin access denied
        }
      }
    }
    
    return chatElement;
  }
  
  // Function to parse chat messages
  function parseChatMessages() {
    const chatElement = extractChatMessages();
    if (!chatElement || !chatContainer) return;
    
    try {
      // Try to access iframe content if it's an iframe
      let chatContent = chatElement;
      if (chatElement.tagName === 'IFRAME') {
        try {
          chatContent = chatElement.contentDocument || chatElement.contentWindow.document;
        } catch (e) {
          // Cross-origin access denied, use fallback
          chatContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ccc;">Cannot access chat from iframe.<br>Please open chat in separate tab.</div>';
          return;
        }
      }
      
      // Look for chat message elements
      const messageSelectors = [
        'yt-live-chat-text-message-renderer',
        'yt-live-chat-paid-message-renderer',
        'yt-live-chat-membership-item-renderer',
        '[id*="message"]',
        '[class*="message"]',
        '[class*="chat-message"]',
        '[class*="yt-live-chat"]',
        '.yt-live-chat-text-message-renderer',
        '.yt-live-chat-paid-message-renderer',
        '.yt-live-chat-membership-item-renderer'
      ];
      
      let messages = [];
      for (const selector of messageSelectors) {
        const foundMessages = chatContent.querySelectorAll(selector);
        if (foundMessages.length > 0) {
          messages = Array.from(foundMessages);
          break;
        }
      }
      
      if (messages.length === 0) {
        chatContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ccc;">Searching for chat messages...</div>';
        return;
      }
      
      // Display messages
      const messagesHTML = messages.slice(-50).map(msg => {
        // Try to extract author name
        let authorName = '';
        const authorSelectors = [
          '#author-name',
          '.author-name',
          '[class*="author"]',
          '[id*="author"]'
        ];
        
        for (const selector of authorSelectors) {
          const authorEl = msg.querySelector(selector);
          if (authorEl) {
            authorName = authorEl.textContent || authorEl.innerText || '';
            break;
          }
        }
        
        // Extract message text
        const textSelectors = [
          '#message',
          '.message',
          '[class*="message"]',
          '[id*="message"]'
        ];
        
        let messageText = '';
        for (const selector of textSelectors) {
          const textEl = msg.querySelector(selector);
          if (textEl) {
            messageText = textEl.textContent || textEl.innerText || '';
            break;
          }
        }
        
        // Fallback to full text if no specific selectors found
        if (!messageText) {
          messageText = msg.textContent || msg.innerText || '';
        }
        
        // Extract timestamp from chat message
        let messageTime = '00:00';
        const timestampSelectors = [
          '.yt-live-chat-timestamp-renderer',
          '[class*="timestamp"]',
          '[id*="timestamp"]',
          '.timestamp',
          '#timestamp'
        ];
        
        for (const selector of timestampSelectors) {
          const timeEl = msg.querySelector(selector);
          if (timeEl) {
            const timeText = timeEl.textContent || timeEl.innerText || '';
            // Extract time from text like "15:30" or "1:25:45"
            const timeMatch = timeText.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
            if (timeMatch) {
              messageTime = timeMatch[1];
              break;
            }
          }
        }
        
        // If no timestamp found, try to extract from message text
        if (messageTime === '00:00') {
          const timeMatch = messageText.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
          if (timeMatch) {
            messageTime = timeMatch[1];
          } else {
            // Fallback to current video time
            try {
              const videoPlayer = document.querySelector('video');
              if (videoPlayer && !isNaN(videoPlayer.currentTime)) {
                const currentTime = videoPlayer.currentTime;
                const hours = Math.floor(currentTime / 3600);
                const minutes = Math.floor((currentTime % 3600) / 60);
                const seconds = Math.floor(currentTime % 60);
                
                if (hours > 0) {
                  messageTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                } else {
                  messageTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
              }
            } catch (e) {
              messageTime = new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              });
            }
          }
        }
        
        return `<div style="margin-bottom: 8px; padding: 4px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <span style="color: #888; font-size: 11px;">${messageTime}</span>
          ${authorName ? `<span style="color: #4CAF50; font-weight: bold; margin-left: 8px;">${authorName}:</span>` : ''}<br>
          <span style="color: white;">${messageText}</span>
        </div>`;
      }).join('');
      
      chatContainer.innerHTML = messagesHTML;
      
      // Scroll to bottom
      chatContainer.scrollTop = chatContainer.scrollHeight;
      
    } catch (error) {
      console.log('Error parsing chat:', error);
      chatContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ccc;">Error reading chat.<br>Please try again.</div>';
    }
  }
  
  // Initial parse
  parseChatMessages();
  
  // Set up interval to update chat
  const chatInterval = setInterval(parseChatMessages, 2000);
  
  // Store interval ID for cleanup
  overlay.chatInterval = chatInterval;
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
