let overlay = null;
let chatContainer = null;
let settings = {
  overlayEnabled: false,
  opacity: 0.8,
  width: 400,
  height: 600,
  positionX: 20,
  positionY: 20,
  chatIntervalMs: 500,
  paused: false
};
let blockedAuthors = [];

// Initialize extension
function init() {
  // Load settings from storage
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
    settings = {
      overlayEnabled: result.overlayEnabled || false,
      opacity: result.opacity || 0.8,
      width: result.width || 400,
      height: result.height || 600,
      positionX: result.positionX || 20,
      positionY: result.positionY || 20,
      chatIntervalMs: typeof result.chatIntervalMs === 'number' ? result.chatIntervalMs : 500,
      paused: !!result.paused
    };
    blockedAuthors = Array.isArray(result.blockedAuthors) ? result.blockedAuthors : [];
    
    if (settings.overlayEnabled && window === window.top) {
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
  
  if (isFullscreen && settings.overlayEnabled && window === window.top) {
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
  header.id = 'overlay-header';
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
      <button id="overlay-settings" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: white; cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 3px; background-color: rgba(255,255,255,0.1);">Settings</button>
      <button id="overlay-close" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: white; cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 3px;">Close</button>
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
  
  // Click to block author
  chatContainer.addEventListener('click', function(e) {
    const authorEl = e.target.closest('[data-author]');
    const containerEl = e.target.closest('[data-msg-container]');
    let author = '';
    if (authorEl) {
      author = authorEl.getAttribute('data-author') || '';
    } else if (containerEl) {
      author = containerEl.getAttribute('data-author') || '';
    }
    if (!author) return;
    if (blockedAuthors.includes(author)) return;
    showBlockPrompt(author, containerEl || authorEl);
  });
  
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
  // Bind video pause/play to scanning state
  bindVideoPauseListeners();
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
      <div style="margin-bottom: 8px;">
        <label style="display: block; margin-bottom: 4px;">Polling interval (ms): ${settings.chatIntervalMs}</label>
        <input type="number" id="overlay-interval" min="100" max="10000" step="50" value="${settings.chatIntervalMs}" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); color: #fff;">
      </div>
      <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="overlay-paused" ${settings.paused ? 'checked' : ''}>
        <label for="overlay-paused">Pause scanning</label>
      </div>
      <button id="overlay-reset" style="width: 100%; padding: 6px; background-color: rgba(255,255,255,0.1); border: none; color: white; border-radius: 4px; cursor: pointer;">Reset</button>
    `;
    
    overlay.appendChild(settingsPanel);
    
    // Add event listeners
    const opacitySlider = settingsPanel.querySelector('#overlay-opacity');
    const widthSlider = settingsPanel.querySelector('#overlay-width');
    const heightSlider = settingsPanel.querySelector('#overlay-height');
    const intervalInput = settingsPanel.querySelector('#overlay-interval');
    const pausedCheckbox = settingsPanel.querySelector('#overlay-paused');
    const resetBtn = settingsPanel.querySelector('#overlay-reset');
    
    opacitySlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      const headerEl = overlay.querySelector('#overlay-header');
      overlay.style.backgroundColor = `rgba(0, 0, 0, ${value})`;
      if (headerEl) headerEl.style.backgroundColor = `rgba(0, 0, 0, ${value})`;
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
    
    intervalInput.addEventListener('change', function() {
      let value = parseInt(this.value);
      if (isNaN(value)) value = 500;
      value = Math.max(100, Math.min(10000, value));
      this.value = value;
      settings.chatIntervalMs = value;
      chrome.storage.sync.set(settings);
      restartChatInterval();
    });
    
    pausedCheckbox.addEventListener('change', function() {
      settings.paused = this.checked;
      chrome.storage.sync.set(settings);
      if (settings.paused) {
        stopChatInterval();
      } else {
        restartChatInterval();
      }
    });
    
    resetBtn.addEventListener('click', function() {
      settings.opacity = 0.8;
      settings.width = 400;
      settings.height = 600;
      settings.positionX = 20;
      settings.positionY = 20;
      
      const headerEl = overlay.querySelector('#overlay-header');
      overlay.style.backgroundColor = `rgba(0, 0, 0, ${settings.opacity})`;
      if (headerEl) headerEl.style.backgroundColor = `rgba(0, 0, 0, ${settings.opacity})`;
      overlay.style.width = settings.width + 'px';
      overlay.style.height = settings.height + 'px';
      overlay.style.left = settings.positionX + 'px';
      overlay.style.top = settings.positionY + 'px';
      settings.chatIntervalMs = 500;
      settings.paused = false;
      
      chrome.storage.sync.set(settings);
      settingsPanel.remove();
      settingsPanel = null;
      restartChatInterval();
    });
    
    // Close settings when clicking outside (robust against panel removal)
    setTimeout(() => {
      const panelRef = settingsPanel;
      function closeSettings(e) {
        // If overlay or panel no longer exists, cleanup listener
        if (!overlay || !panelRef || !panelRef.parentNode) {
          document.removeEventListener('click', closeSettings);
          return;
        }
        const clickedSettingsBtn = (e.target === settingsBtn) || (settingsBtn && settingsBtn.contains && settingsBtn.contains(e.target));
        if (!panelRef.contains(e.target) && !clickedSettingsBtn) {
          if (panelRef.parentNode) panelRef.parentNode.removeChild(panelRef);
          if (settingsPanel === panelRef) settingsPanel = null;
          document.removeEventListener('click', closeSettings);
        }
      }
      document.addEventListener('click', closeSettings);
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
  // Function to auto-click the replay chat button
  function autoClickReplayButton() {
    const replayButtonSelectors = [
      '#show-hide-button button',
      'ytd-button-renderer button[aria-label*="Hiện nội dung phát lại cuộc trò chuyện"]',
      'ytd-button-renderer button[aria-label*="Show replay"]',
      'ytd-button-renderer button[aria-label*="replay"]',
      'button[aria-label*="Hiện nội dung phát lại"]',
      'button[aria-label*="Show replay"]',
      'button[title*="Hiện nội dung phát lại"]',
      'button[title*="Show replay"]'
    ];
    
    for (const selector of replayButtonSelectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) { // Check if button is visible
        console.log('Found replay button, clicking...');
        button.click();
        return true;
      }
    }
    
    // Also check in iframes
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (iframe.src && (iframe.src.includes('youtube.com/live_chat') || iframe.src.includes('live_chat'))) {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          for (const selector of replayButtonSelectors) {
            const button = iframeDoc.querySelector(selector);
            if (button && button.offsetParent !== null) {
              console.log('Found replay button in iframe, clicking...');
              button.click();
              return true;
            }
          }
        }
      } catch (e) {
        // Cross-origin access denied
      }
    }
    
    return false;
  }
  
  // Function to auto-click the live chat option in dropdown
  function autoClickLiveChatOption() {
    console.log('Looking for live chat dropdown option...');
    
    // First check if dropdown is visible with more comprehensive selectors
    const dropdownSelectors = [
      '.dropdown-content',
      'tp-yt-paper-listbox',
      'yt-dropdown-menu',
      '[slot="dropdown-content"]',
      '.style-scope.tp-yt-paper-menu-button',
      'tp-yt-paper-menu-button .dropdown-content',
      'yt-dropdown-menu .dropdown-content'
    ];
    
    let dropdownVisible = false;
    let dropdownElement = null;
    for (const selector of dropdownSelectors) {
      const dropdown = document.querySelector(selector);
      if (dropdown && dropdown.offsetParent !== null) {
        dropdownVisible = true;
        dropdownElement = dropdown;
        console.log('Found dropdown with selector:', selector);
        break;
      }
    }
    
    // If dropdown not visible, try to find and click dropdown button
    if (!dropdownVisible) {
      console.log('Dropdown not visible, looking for chat dropdown button...');
      
      // First, try to find the chat container to limit search scope
      const chatContainer = document.querySelector('ytd-live-chat-frame, #chatframe, #chat, ytd-live-chat-renderer, yt-live-chat-renderer');
      
      if (chatContainer) {
        console.log('Found chat container, searching within it...');
        
        // Look for dropdown button specifically within chat area
        const chatDropdownSelectors = [
          'ytd-live-chat-frame tp-yt-paper-button.dropdown-trigger',
          'ytd-live-chat-frame tp-yt-paper-button[aria-expanded="false"]',
          'ytd-live-chat-frame tp-yt-paper-button[aria-label*="Chọn chế độ Trò chuyện"]',
          'ytd-live-chat-frame tp-yt-paper-button[aria-label*="Trò chuyện trực tiếp"]',
          'ytd-live-chat-frame tp-yt-paper-menu-button',
          'ytd-live-chat-frame yt-dropdown-menu button',
          'ytd-live-chat-frame button[aria-haspopup="true"]',
          'ytd-live-chat-frame button[aria-expanded="false"]',
          '#chatframe tp-yt-paper-button.dropdown-trigger',
          '#chatframe tp-yt-paper-button[aria-expanded="false"]',
          '#chatframe tp-yt-paper-menu-button',
          '#chatframe yt-dropdown-menu button',
          '#chat tp-yt-paper-button.dropdown-trigger',
          '#chat tp-yt-paper-button[aria-expanded="false"]',
          '#chat tp-yt-paper-menu-button',
          '#chat yt-dropdown-menu button'
        ];
        
        for (const selector of chatDropdownSelectors) {
          const button = chatContainer.querySelector(selector);
          if (button && button.offsetParent !== null) {
            // Additional check to make sure it's a chat dropdown button
            const buttonText = button.textContent || button.innerText || '';
            const buttonAriaLabel = button.getAttribute('aria-label') || '';
            const buttonTitle = button.getAttribute('title') || '';
            
            // Skip if it looks like a user profile button
            if (buttonText.includes('Profile') || 
                buttonText.includes('Account') || 
                buttonText.includes('Settings') ||
                buttonAriaLabel.includes('Profile') ||
                buttonAriaLabel.includes('Account') ||
                buttonTitle.includes('Profile') ||
                buttonTitle.includes('Account')) {
              console.log('Skipping user profile button:', buttonText, buttonAriaLabel);
              continue;
            }
            
            // Check if it's the chat mode dropdown button
            if (buttonAriaLabel.includes('Chọn chế độ Trò chuyện') || 
                buttonAriaLabel.includes('Trò chuyện trực tiếp') ||
                buttonText.includes('Phát lại các tin nhắn') ||
                button.classList.contains('dropdown-trigger')) {
              console.log('Found chat dropdown button, clicking...', selector, buttonText, buttonAriaLabel);
            } else {
              console.log('Found button but not chat dropdown:', selector, buttonText, buttonAriaLabel);
              continue;
            }
            button.click();
            // Wait a bit for dropdown to appear
            setTimeout(() => {
              autoClickLiveChatOption();
            }, 1000);
            return true;
          }
        }
      }
      
      // If not found in chat container, try more specific selectors
      const specificDropdownSelectors = [
        'tp-yt-paper-button.dropdown-trigger[aria-label*="Chọn chế độ Trò chuyện"]',
        'tp-yt-paper-button.dropdown-trigger[aria-label*="Trò chuyện trực tiếp"]',
        'tp-yt-paper-button[aria-expanded="false"][aria-label*="Trò chuyện"]',
        'ytd-live-chat-frame tp-yt-paper-button.dropdown-trigger',
        'ytd-live-chat-frame tp-yt-paper-button[aria-expanded="false"]',
        'ytd-live-chat-frame tp-yt-paper-menu-button',
        'ytd-live-chat-frame yt-dropdown-menu button',
        'ytd-live-chat-frame button[aria-haspopup="true"]',
        'ytd-live-chat-frame button[aria-expanded="false"]',
        'ytd-live-chat-renderer tp-yt-paper-button.dropdown-trigger',
        'ytd-live-chat-renderer tp-yt-paper-menu-button',
        'ytd-live-chat-renderer yt-dropdown-menu button'
      ];
      
      for (const selector of specificDropdownSelectors) {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) {
          // Additional check to make sure it's a chat dropdown button
          const buttonText = button.textContent || button.innerText || '';
          const buttonAriaLabel = button.getAttribute('aria-label') || '';
          const buttonTitle = button.getAttribute('title') || '';
          
          // Skip if it looks like a user profile button
          if (buttonText.includes('Profile') || 
              buttonText.includes('Account') || 
              buttonText.includes('Settings') ||
              buttonAriaLabel.includes('Profile') ||
              buttonAriaLabel.includes('Account') ||
              buttonTitle.includes('Profile') ||
              buttonTitle.includes('Account')) {
            console.log('Skipping user profile button:', buttonText, buttonAriaLabel);
            continue;
          }
          
          // Check if it's the chat mode dropdown button
          if (buttonAriaLabel.includes('Chọn chế độ Trò chuyện') || 
              buttonAriaLabel.includes('Trò chuyện trực tiếp') ||
              buttonText.includes('Phát lại các tin nhắn') ||
              button.classList.contains('dropdown-trigger')) {
            console.log('Found specific chat dropdown button, clicking...', selector, buttonText, buttonAriaLabel);
          } else {
            console.log('Found button but not chat dropdown:', selector, buttonText, buttonAriaLabel);
            continue;
          }
          button.click();
          // Wait a bit for dropdown to appear
          setTimeout(() => {
            autoClickLiveChatOption();
          }, 1000);
          return true;
        }
      }
      
      // Try to find dropdown button by looking for buttons near chat elements
      console.log('Trying to find dropdown button by context...');
      const chatElements = document.querySelectorAll('ytd-live-chat-frame, #chatframe, #chat, ytd-live-chat-renderer, yt-live-chat-renderer');
      for (const chatEl of chatElements) {
        // Look for buttons within or near chat elements
        const nearbyButtons = chatEl.querySelectorAll('button, tp-yt-paper-menu-button, tp-yt-paper-button, [role="button"], yt-dropdown-menu, tp-yt-paper-dropdown-menu');
        for (const btn of nearbyButtons) {
          if (btn.offsetParent !== null) {
            const buttonText = btn.textContent || btn.innerText || '';
            const buttonAriaLabel = btn.getAttribute('aria-label') || '';
            const buttonTitle = btn.getAttribute('title') || '';
            
            // Skip if it looks like a user profile button
            if (buttonText.includes('Profile') || 
                buttonText.includes('Account') || 
                buttonText.includes('Settings') ||
                buttonAriaLabel.includes('Profile') ||
                buttonAriaLabel.includes('Account') ||
                buttonTitle.includes('Profile') ||
                buttonTitle.includes('Account')) {
              continue;
            }
            
            // Check if it's the chat mode dropdown button
            if ((buttonAriaLabel.includes('Chọn chế độ Trò chuyện') || 
                 buttonAriaLabel.includes('Trò chuyện trực tiếp') ||
                 buttonText.includes('Phát lại các tin nhắn') ||
                 /chat/i.test(buttonText) ||
                 btn.classList.contains('dropdown-trigger')) &&
                (btn.getAttribute('aria-haspopup') === 'true' || 
                 btn.getAttribute('aria-expanded') === 'false' ||
                 btn.classList.contains('tp-yt-paper-menu-button') ||
                 btn.classList.contains('tp-yt-paper-button'))) {
              console.log('Found potential chat dropdown button by context, clicking...', buttonText, buttonAriaLabel);
              btn.click();
              setTimeout(() => {
                autoClickLiveChatOption();
              }, 1000);
              return true;
            }
          }
        }
      }
      
      console.log('No chat dropdown button found, waiting...');
      return false;
    }
    
    // Debug: Log all available items in dropdown (limit to chat area)
    let allItems = [];
    
    // First try to find items within chat container
    const chatContainer = document.querySelector('ytd-live-chat-frame') || 
                         document.querySelector('#chatframe') || 
                         document.querySelector('#chat');
    
    if (chatContainer) {
      allItems = chatContainer.querySelectorAll('tp-yt-paper-item');
      console.log('Found', allItems.length, 'dropdown items in chat container');
    } else {
      allItems = document.querySelectorAll('tp-yt-paper-item');
      console.log('Found', allItems.length, 'dropdown items in document');
    }
    
    allItems.forEach((item, index) => {
      const textContent = item.textContent || item.innerText || '';
      const isSelected = item.getAttribute('aria-selected') === 'true';
      console.log(`Item ${index}: "${textContent.substring(0, 100)}" (selected: ${isSelected})`);
    });
    
    // Look for the live chat option by text content with more patterns
    for (const item of allItems) {
      const textContent = item.textContent || item.innerText || '';
      const isSelected = item.getAttribute('aria-selected') === 'true';
      
      // Skip if already selected
      if (isSelected) {
        console.log('Skipping selected item:', textContent.substring(0, 50));
        continue;
      }
      
      if (textContent.includes('Phát lại cuộc trò chuyện trực tiếp') || 
          textContent.includes('Live chat replay') ||
          textContent.includes('trực tiếp') ||
          textContent.includes('toàn bộ') ||
          textContent.includes('Tất cả tin nhắn') ||
          (textContent.includes('Live') && textContent.includes('chat')) ||
          (textContent.includes('replay') && textContent.includes('chat'))) {
        console.log('Found live chat option, clicking...', textContent.substring(0, 100));
        item.click();
        return true;
      }
    }
    
    // Try alternative selectors for the second option (not selected)
    const alternativeSelectors = [
      'a[aria-selected="false"] tp-yt-paper-item',
      'tp-yt-paper-item[role="option"]:not([aria-selected="true"])',
      'tp-yt-paper-item:not([aria-selected="true"])',
      '.yt-dropdown-menu tp-yt-paper-item:last-child',
      'tp-yt-paper-item:last-child',
      'a:not([aria-selected="true"]) tp-yt-paper-item'
    ];
    
    for (const selector of alternativeSelectors) {
      try {
        const item = document.querySelector(selector);
        if (item && item.offsetParent !== null) {
          const textContent = item.textContent || item.innerText || '';
          const isSelected = item.getAttribute('aria-selected') === 'true';
          if (!isSelected) {
            console.log('Found potential live chat option via selector, clicking...', textContent.substring(0, 100));
            item.click();
            return true;
          }
        }
      } catch (e) {
        // Selector might not be supported
      }
    }
    
    // Try clicking the second item if it exists (usually the live chat option)
    const secondItem = document.querySelector('tp-yt-paper-item:nth-child(2)');
    if (secondItem && secondItem.offsetParent !== null) {
      const textContent = secondItem.textContent || secondItem.innerText || '';
      const isSelected = secondItem.getAttribute('aria-selected') === 'true';
      if (!isSelected) {
        console.log('Trying second item as fallback, clicking...', textContent.substring(0, 100));
        secondItem.click();
        return true;
      }
    }
    
    // Try clicking any unselected item as last resort
    const unselectedItems = document.querySelectorAll('tp-yt-paper-item:not([aria-selected="true"])');
    if (unselectedItems.length > 0) {
      const lastUnselectedItem = unselectedItems[unselectedItems.length - 1];
      const textContent = lastUnselectedItem.textContent || lastUnselectedItem.innerText || '';
      console.log('Trying last unselected item as final fallback, clicking...', textContent.substring(0, 100));
      lastUnselectedItem.click();
      return true;
    }
    
    // Also check in iframes
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (iframe.src && (iframe.src.includes('youtube.com/live_chat') || iframe.src.includes('live_chat'))) {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const allItems = iframeDoc.querySelectorAll('tp-yt-paper-item');
          console.log('Found', allItems.length, 'items in iframe');
          for (const item of allItems) {
            const textContent = item.textContent || item.innerText || '';
            const isSelected = item.getAttribute('aria-selected') === 'true';
            if (!isSelected && (textContent.includes('Phát lại cuộc trò chuyện trực tiếp') || 
                textContent.includes('Live chat replay') ||
                textContent.includes('trực tiếp') ||
                textContent.includes('toàn bộ') ||
                textContent.includes('Tất cả tin nhắn'))) {
              console.log('Found live chat option in iframe, clicking...', textContent.substring(0, 100));
              item.click();
              return true;
            }
          }
        }
      } catch (e) {
        // Cross-origin access denied
      }
    }
    
    console.log('No live chat option found in dropdown');
    return false;
  }
  
  // Function to extract chat messages from YouTube
  function extractChatMessages() {
    // Look for YouTube live chat elements with more comprehensive selectors
    const chatSelectors = [
      '#chatframe',
      '#chat',
      'ytd-live-chat-frame',
      'ytd-live-chat-renderer',
      'ytd-live-chat-list-renderer',
      'ytd-live-chat-item-list-renderer',
      '[id*="chat"]',
      '[class*="chat"]',
      '[class*="live-chat"]',
      'yt-live-chat-frame',
      'yt-live-chat-renderer',
      'yt-live-chat-list-renderer',
      'yt-live-chat-item-list-renderer'
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
      
      // Look for chat message elements with more comprehensive selectors
      const messageSelectors = [
        'yt-live-chat-text-message-renderer',
        'yt-live-chat-paid-message-renderer',
        'yt-live-chat-membership-item-renderer',
        'yt-live-chat-super-chat-renderer',
        'yt-live-chat-paid-sticker-renderer',
        'ytd-live-chat-text-message-renderer',
        'ytd-live-chat-paid-message-renderer',
        'ytd-live-chat-membership-item-renderer',
        'ytd-live-chat-super-chat-renderer',
        'ytd-live-chat-paid-sticker-renderer',
        '[id*="message"]',
        '[class*="message"]',
        '[class*="chat-message"]',
        '[class*="yt-live-chat"]',
        '[class*="super-chat"]',
        '[class*="paid-message"]',
        '.yt-live-chat-text-message-renderer',
        '.yt-live-chat-paid-message-renderer',
        '.yt-live-chat-membership-item-renderer',
        '.yt-live-chat-super-chat-renderer',
        '.yt-live-chat-paid-sticker-renderer',
        '.ytd-live-chat-text-message-renderer',
        '.ytd-live-chat-paid-message-renderer',
        '.ytd-live-chat-membership-item-renderer',
        '.ytd-live-chat-super-chat-renderer',
        '.ytd-live-chat-paid-sticker-renderer'
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
        // Check current status and show appropriate message
        if (!replayButtonClicked && retryCount < maxRetries) {
          chatContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ccc;">Looking for replay button...</div>';
        } else if (replayButtonClicked && !liveChatOptionClicked) {
          chatContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ccc;">Looking for live chat option...</div>';
        } else if (!chatFound && chatRetryCount < maxChatRetries) {
          chatRetryCount++;
          chatContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: #ccc;">Searching for chat messages... (${chatRetryCount}/${maxChatRetries})<br><small>Please wait for chat to load</small></div>`;
        } else {
          chatContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ccc;">No chat messages found<br><small>Try refreshing the page or check if chat is enabled</small></div>';
        }
        return;
      }
      
      // Chat found successfully
      if (!chatFound) {
        chatFound = true;
        console.log('Chat messages found successfully');
      }
      
      // Display messages
      const messagesHTML = messages.slice(-50).map(msg => {
        // Detect message type based on HTML structure
        const hasPurchaseAmount = msg.querySelector('#purchase-amount') || msg.querySelector('.purchase-amount');
        const hasReplyButton = msg.querySelector('yt-live-chat-reply-button-view-model') || 
                              msg.querySelector('[class*="reply-button"]') ||
                              msg.querySelector('#reply-button') ||
                              msg.querySelector('[aria-label*="Phản hồi Super Chat"]') ||
                              msg.querySelector('[aria-label*="Super Chat"]');
        
        // Detect membership first
        const isMembership = msg.tagName === 'YT-LIVE-CHAT-MEMBERSHIP-ITEM-RENDERER' || 
                            msg.classList.contains('yt-live-chat-membership-item-renderer') ||
                            msg.classList.contains('membership') ||
                            msg.querySelector('[class*="membership"]') ||
                            msg.querySelector('yt-live-chat-author-badge-renderer[type="member"]');
        
        // Super Chat: has purchase amount and is not membership
        const isSuperChat = (msg.tagName === 'YT-LIVE-CHAT-SUPER-CHAT-RENDERER' || 
                           msg.classList.contains('yt-live-chat-super-chat-renderer') ||
                           msg.classList.contains('super-chat') ||
                           msg.querySelector('[class*="super-chat"]') ||
                           (hasPurchaseAmount && !isMembership));
        
        // Paid Message: has purchase amount but is not super chat or membership
        const isPaidMessage = (hasPurchaseAmount && !isMembership && !isSuperChat);
        
        // Detect moderator
        const isModerator = msg.querySelector('yt-live-chat-author-badge-renderer[type="moderator"]') ||
                           msg.querySelector('yt-live-chat-author-badge-renderer[type="owner"]') ||
                           msg.querySelector('[class*="moderator"]') ||
                           msg.querySelector('[class*="owner"]');
        
        // Try to extract author name
        let authorName = '';
        const authorSelectors = [
          '#author-name',
          '.author-name',
          '[class*="author"]',
          '[id*="author"]',
          'yt-live-chat-author-chip #author-name',
          '.yt-live-chat-author-chip #author-name'
        ];
        
        for (const selector of authorSelectors) {
          const authorEl = msg.querySelector(selector);
          if (authorEl) {
            authorName = authorEl.textContent || authorEl.innerText || '';
            break;
          }
        }

        // Skip if author is blocked
        if (authorName && blockedAuthors.includes(authorName)) {
          return '';
        }
        
        function escapeRegex(s) {
          return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        
        function removeAuthorPrefix(text, author) {
          if (!author) return text;
          const pattern = new RegExp('^\\s*' + escapeRegex(author).replace(/\\s+/g, '\\s*') + '(?:\\s*[:\\-–—])?\\s*', 'i');
          let result = text;
          let guard = 0;
          while (guard < 2 && pattern.test(result)) {
            result = result.replace(pattern, '');
            guard++;
          }
          if (author.length > 1) {
            const a = author.toLowerCase();
            const r = result.toLowerCase();
            if (r.startsWith(a.slice(1))) {
              result = result.slice(author.length - 1);
            }
          }
          return result;
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
            // Clean up the message text - remove timestamp and author name if duplicated
            if (messageText) {
              // Remove timestamp prefix optionally followed by AM/PM or letters
              messageText = messageText.replace(/^\d{1,2}:\d{2}(?:\s*[A-Za-z]{1,3})?\s*/, '');
              
              // Remove author name if it appears at the beginning (robust)
              messageText = removeAuthorPrefix(messageText, authorName);
              
              // Additional cleanup for patterns like "4:07cuong khac" (no space)
              messageText = messageText.replace(/^\d{1,2}:\d{2}[A-Za-z]+/, '');
              
              // Remove common prefixes that might be duplicated
              messageText = messageText.replace(/^(MEMBER|MOD|SUPER CHAT|PAID)\s*/, '');
              
              // Trim whitespace
              messageText = messageText.trim();
              
              // If after cleanup, message is empty or whitespace, mark as empty
              if (messageText === '' || messageText.match(/^\s*$/)) {
                messageText = '';
              }
            }
            break;
          }
        }
        
        // Fallback to full text if no specific selectors found
        if (!messageText) {
          let fullText = msg.textContent || msg.innerText || '';
          // Clean up the full text
          if (fullText) {
            // Remove timestamp prefix optionally followed by AM/PM or letters
            fullText = fullText.replace(/^\d{1,2}:\d{2}(?:\s*[A-Za-z]{1,3})?\s*/, '');
            
            // Remove author name if it appears at the beginning (robust)
            fullText = removeAuthorPrefix(fullText, authorName);
            
            // Additional cleanup for patterns like "4:07cuong khac" (no space)
            fullText = fullText.replace(/^\d{1,2}:\d{2}[A-Za-z]+/, '');
            
            // Remove common prefixes that might be duplicated
            fullText = fullText.replace(/^(MEMBER|MOD|SUPER CHAT|PAID)\s*/, '');
            
            // Trim whitespace
            fullText = fullText.trim();
            
            // Keep special characters like punctuation or emoji; only drop if whitespace-only
            if (fullText === '' || fullText.match(/^\s*$/)) {
              fullText = '';
            }
            
            messageText = fullText;
          }
        }
        
        // Extract Super Chat amount
        let superChatAmount = '';
        if (isSuperChat || isPaidMessage) {
          const amountSelectors = [
            '#purchase-amount',
            '.purchase-amount',
            '.yt-live-chat-paid-message-renderer-amount',
            '[class*="amount"]',
            '[class*="price"]',
            '[class*="super-chat-amount"]',
            'yt-formatted-string'
          ];
          
          for (const selector of amountSelectors) {
            const amountEl = msg.querySelector(selector);
            if (amountEl) {
              const amountText = amountEl.textContent || amountEl.innerText || '';
              // Check if it contains currency symbols or numbers
              if (amountText.match(/[\d,]+.*[₫$€£¥]|[\d,]+.*USD|[\d,]+.*VND/i)) {
                superChatAmount = amountText;
                break;
              }
            }
          }
          
          // Try to extract from message text if no amount element found
          if (!superChatAmount) {
            const amountMatch = messageText.match(/[\d,]+.*[₫$€£¥]|[\d,]+.*USD|[\d,]+.*VND|\$[\d,]+|\d+\.\d+\s*\$/i);
            if (amountMatch) {
              superChatAmount = amountMatch[0];
            }
          }
        }
        
        // Extract timestamp from chat message
        let messageTime = '00:00';
        const timestampSelectors = [
          '#timestamp',
          '.timestamp',
          '.yt-live-chat-timestamp-renderer',
          '[class*="timestamp"]',
          '[id*="timestamp"]'
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
        
        // Determine styling based on message type and user role
        let messageStyle = 'margin-bottom: 8px; padding: 4px; border-bottom: 1px solid rgba(255,255,255,0.1);';
        let authorColor = '#FFFFFF'; // Default white for regular users
        let badge = '';
        let messageClass = '';
        
        // Set user role colors and classes
        if (isModerator) {
          authorColor = '#2196F3'; // Blue for moderators
          badge = '<span style="background: #2196F3; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-right: 6px;">MOD</span>';
          messageClass = 'moderator-message';
        } else if (isMembership) {
          authorColor = '#4CAF50'; // Green for members
          badge = '<span style="background: #4CAF50; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-right: 6px;">MEMBER</span>';
          messageClass = 'membership-message';
        } else {
          // Regular user
          messageClass = 'regular-message';
        }
        
        // Override for special message types (priority order: Super Chat > Paid Message > Membership)
        if (isSuperChat) {
          messageStyle = 'margin-bottom: 8px; padding: 8px; border: 2px solid #FFD700; border-radius: 8px; background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,165,0,0.1));';
          authorColor = '#FFD700';
          badge = '<span style="background: #FFD700; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-right: 6px;">SUPER CHAT</span>';
          messageClass = 'super-chat-message';
        } else if (isPaidMessage) {
          messageStyle = 'margin-bottom: 8px; padding: 6px; border: 2px solid #FF6B6B; border-radius: 6px; background: rgba(255,107,107,0.1);';
          authorColor = '#FF6B6B';
          badge = '<span style="background: #FF6B6B; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-right: 6px;">PAID</span>';
          messageClass = 'paid-message';
        } else if (isMembership) {
          // Only apply membership styling if it's not a super chat or paid message
          messageStyle = 'margin-bottom: 8px; padding: 6px; border: 2px solid #4CAF50; border-radius: 6px; background: rgba(76,175,80,0.1);';
          authorColor = '#4CAF50';
          badge = '<span style="background: #4CAF50; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-right: 6px;">MEMBER</span>';
          messageClass = 'membership-message';
        }
        
        // Debug logging for all paid messages
        if (hasPurchaseAmount) {
          console.log('Detected paid message:', {
            tagName: msg.tagName,
            hasPurchaseAmount: !!hasPurchaseAmount,
            hasReplyButton: !!hasReplyButton,
            isSuperChat,
            isPaidMessage,
            isMembership,
            authorName,
            superChatAmount,
            messageText: messageText.substring(0, 50),
            html: msg.outerHTML.substring(0, 200)
          });
        }
        
        // Skip messages only if empty after trimming
        if (!messageText || messageText.trim() === '' || messageText === 'undefined' || messageText === 'null') {
          
          // Debug logging for filtered messages
          if (isSuperChat || isPaidMessage) {
            console.log('Filtered out special message:', {
              isSuperChat,
              isPaidMessage,
              authorName,
              messageText,
              messageTime,
              superChatAmount
            });
          }
          return '';
        }
        
        // Debug logging for Super Chat HTML generation
        if (isSuperChat) {
          console.log('Generating Super Chat HTML:', {
            authorName,
            messageText,
            messageTime,
            superChatAmount,
            messageClass,
            messageStyle: messageStyle.substring(0, 100)
          });
        }
        
        return `<div class="${messageClass}" style="${messageStyle}" data-msg-container="1" data-author="${authorName ? authorName.replace(/"/g,'&quot;') : ''}">
          <div style="display: flex; align-items: center; margin-bottom: 4px; gap: 6px;">
            <span style="color: #888; font-size: 11px;">${messageTime}</span>
            ${badge}
            ${authorName ? `<span style="color: ${authorColor}; font-weight: bold;" data-author="${authorName.replace(/"/g,'&quot;')}">${authorName}</span>` : ''}
            ${superChatAmount ? `<span style="color: #FFD700; font-weight: bold;">${superChatAmount}</span>` : ''}
          </div>
          <span style="color: white;">${messageText}</span>
        </div>`;
      }).join('');
      
      // Debug logging for final HTML
      const superChatCount = (messagesHTML.match(/super-chat-message/g) || []).length;
      const paidMessageCount = (messagesHTML.match(/paid-message/g) || []).length;
      const membershipCount = (messagesHTML.match(/membership-message/g) || []).length;
      const regularCount = (messagesHTML.match(/regular-message/g) || []).length;
      
      console.log('Final message counts:', {
        total: messages.length,
        superChat: superChatCount,
        paidMessage: paidMessageCount,
        membership: membershipCount,
        regular: regularCount,
        htmlLength: messagesHTML.length
      });
      
      chatContainer.innerHTML = messagesHTML;
      
      // Scroll to bottom
      chatContainer.scrollTop = chatContainer.scrollHeight;
      
    } catch (error) {
      console.log('Error parsing chat:', error);
      chatContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ccc;">Error reading chat.<br>Please try again.</div>';
    }
  }
  
  // Auto-click replay button and live chat option
  let replayButtonClicked = false;
  let liveChatOptionClicked = false;
  let retryCount = 0;
  const maxRetries = 10;
  let chatFound = false;
  let chatRetryCount = 0;
  const maxChatRetries = 15;
  let liveOptionRetryCount = 0;
  const maxLiveOptionRetries = 8;
  
  function tryAutoClickReplay() {
    if (!replayButtonClicked && retryCount < maxRetries) {
      if (autoClickReplayButton()) {
        replayButtonClicked = true;
        console.log('Replay button clicked successfully');
        // Wait a bit for dropdown to appear, then click live chat option
        setTimeout(() => {
          tryAutoClickLiveChatOption();
        }, 5000);
      } else {
        retryCount++;
        console.log(`Replay button not found, retry ${retryCount}/${maxRetries}`);
        // Retry after a delay
        setTimeout(tryAutoClickReplay, 1000);
      }
    } else if (!replayButtonClicked) {
      console.log('Max retries reached, proceeding without replay button');
      parseChatMessages();
    }
  }
  
  function tryAutoClickLiveChatOption() {
    if (!liveChatOptionClicked && (retryCount < maxRetries || liveOptionRetryCount < maxLiveOptionRetries)) {
      if (autoClickLiveChatOption()) {
        liveChatOptionClicked = true;
        console.log('Live chat option clicked successfully');
        // Wait a bit for chat to load after clicking
        setTimeout(() => {
          parseChatMessages();
        }, 3000);
      } else {
        liveOptionRetryCount++;
        console.log('Live chat option not found, retrying...', liveOptionRetryCount + '/' + maxLiveOptionRetries);
        if (liveOptionRetryCount >= maxLiveOptionRetries) {
          console.log('Live chat option not found after max retries, proceeding anyway');
          liveChatOptionClicked = true;
          parseChatMessages();
          return;
        }
        // Retry after a delay
        setTimeout(tryAutoClickLiveChatOption, 2000);
      }
    } else if (!liveChatOptionClicked) {
      console.log('Live chat option not found after max retries, proceeding without it');
      liveChatOptionClicked = true;
      parseChatMessages();
    }
  }
  
  // Start trying to click replay button
  tryAutoClickReplay();
  
  // Define tick function so we can restart interval dynamically
  overlay.chatTick = function() {
    if (settings.paused) return;
    if (!replayButtonClicked && retryCount < maxRetries) {
      tryAutoClickReplay();
    } else if (replayButtonClicked && !liveChatOptionClicked) {
      tryAutoClickLiveChatOption();
    } else {
      parseChatMessages();
    }
  };
  
  // Start interval with configured frequency
  restartChatInterval();
}

// Interval control helpers
function stopChatInterval() {
  if (overlay && overlay.chatInterval) {
    clearInterval(overlay.chatInterval);
    overlay.chatInterval = null;
  }
}

function restartChatInterval() {
  stopChatInterval();
  if (!overlay || settings.paused) return;
  const interval = Math.max(100, Math.min(10000, parseInt(settings.chatIntervalMs) || 500));
  overlay.chatInterval = setInterval(() => {
    if (overlay && typeof overlay.chatTick === 'function') {
      overlay.chatTick();
    }
  }, interval);
}

// Tie scanning pause to YouTube video pause/play
function bindVideoPauseListeners() {
  try {
    const video = document.querySelector('video');
    if (!video) return;
    if (video.__overlayPauseBound) return;
    video.__overlayPauseBound = true;
    
    const applyPausedState = function(paused) {
      settings.paused = paused;
      chrome.storage.sync.set(settings);
      if (paused) {
        stopChatInterval();
      } else {
        restartChatInterval();
      }
    };
    
    // Initialize based on current state
    applyPausedState(video.paused);
    
    video.addEventListener('pause', function() {
      applyPausedState(true);
    });
    video.addEventListener('play', function() {
      applyPausedState(false);
    });
  } catch (e) {
    // ignore
  }
}

// Non-intrusive block prompt inside overlay
function showBlockPrompt(author, anchorEl) {
  try {
    if (!overlay) return;
    // Remove existing prompt if any
    const existing = overlay.querySelector('#overlay-block-prompt');
    if (existing) existing.remove();
    
    const rect = (anchorEl && anchorEl.getBoundingClientRect) ? anchorEl.getBoundingClientRect() : overlay.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const prompt = document.createElement('div');
    prompt.id = 'overlay-block-prompt';
    prompt.style.cssText = `
      position: absolute;
      left: ${Math.max(8, Math.min(rect.left - overlayRect.left, overlay.offsetWidth - 180 - 8))}px;
      top: ${Math.max(40, Math.min(rect.top - overlayRect.top + 20, overlay.offsetHeight - 80))}px;
      width: 180px;
      background: rgba(0,0,0,0.9);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 10px;
      z-index: 1000001;
      font-size: 12px;
      color: #fff;
    `;
    prompt.innerHTML = `
      <div style="margin-bottom: 8px;">Block messages from <strong>${author.replace(/</g,'&lt;')}</strong>?</div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button id="block-cancel" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button id="block-confirm" style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.6); color: #fecaca; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Block</button>
      </div>
    `;
    overlay.appendChild(prompt);
    
    const cleanup = function() {
      if (prompt && prompt.parentNode) prompt.parentNode.removeChild(prompt);
      document.removeEventListener('click', outsideHandler, true);
    };
    const outsideHandler = function(ev) {
      if (!prompt.contains(ev.target)) {
        cleanup();
      }
    };
    setTimeout(() => document.addEventListener('click', outsideHandler, true), 0);
    
    prompt.querySelector('#block-cancel').addEventListener('click', function(ev) {
      ev.stopPropagation();
      cleanup();
    });
    prompt.querySelector('#block-confirm').addEventListener('click', function(ev) {
      ev.stopPropagation();
      cleanup();
      if (!blockedAuthors.includes(author)) blockedAuthors.push(author);
      chrome.storage.sync.set({ blockedAuthors: blockedAuthors });
      if (overlay && typeof overlay.chatTick === 'function') {
        overlay.chatTick();
      }
    });
  } catch (e) {}
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
