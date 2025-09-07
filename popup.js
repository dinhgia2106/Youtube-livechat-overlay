document.addEventListener('DOMContentLoaded', function() {
  const enableCheckbox = document.getElementById('enableOverlay');
  const opacitySlider = document.getElementById('opacity');
  const widthSlider = document.getElementById('width');
  const heightSlider = document.getElementById('height');
  const positionXSlider = document.getElementById('positionX');
  const positionYSlider = document.getElementById('positionY');
  const toggleBtn = document.getElementById('toggleBtn');
  const resetBtn = document.getElementById('resetBtn');
  const status = document.getElementById('status');
  
  const opacityValue = document.getElementById('opacityValue');
  const widthValue = document.getElementById('widthValue');
  const heightValue = document.getElementById('heightValue');
  const positionXValue = document.getElementById('positionXValue');
  const positionYValue = document.getElementById('positionYValue');
  
  // Load saved settings
  chrome.storage.sync.get([
    'overlayEnabled',
    'opacity',
    'width',
    'height',
    'positionX',
    'positionY'
  ], function(result) {
    enableCheckbox.checked = result.overlayEnabled || false;
    opacitySlider.value = result.opacity || 0.8;
    widthSlider.value = result.width || 400;
    heightSlider.value = result.height || 600;
    positionXSlider.value = result.positionX || 20;
    positionYSlider.value = result.positionY || 20;
    
    updateDisplayValues();
    updateStatus();
  });
  
  // Update display values
  function updateDisplayValues() {
    opacityValue.textContent = opacitySlider.value;
    widthValue.textContent = widthSlider.value;
    heightValue.textContent = heightSlider.value;
    positionXValue.textContent = positionXSlider.value;
    positionYValue.textContent = positionYSlider.value;
  }
  
  // Update status display
  function updateStatus() {
    if (enableCheckbox.checked) {
      status.textContent = 'Overlay enabled';
      status.className = 'status active';
      toggleBtn.textContent = 'Disable Overlay';
      toggleBtn.className = 'toggle-btn disabled';
    } else {
      status.textContent = 'Overlay disabled';
      status.className = 'status inactive';
      toggleBtn.textContent = 'Enable Overlay';
      toggleBtn.className = 'toggle-btn';
    }
  }
  
  // Save settings
  function saveSettings() {
    const settings = {
      overlayEnabled: enableCheckbox.checked,
      opacity: parseFloat(opacitySlider.value),
      width: parseInt(widthSlider.value),
      height: parseInt(heightSlider.value),
      positionX: parseInt(positionXSlider.value),
      positionY: parseInt(positionYSlider.value)
    };
    
    chrome.storage.sync.set(settings, function() {
      // Send message to content script to update overlay
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSettings',
          settings: settings
        });
      });
    });
  }
  
  // Event listeners
  enableCheckbox.addEventListener('change', function() {
    saveSettings();
    updateStatus();
  });
  
  opacitySlider.addEventListener('input', function() {
    updateDisplayValues();
    saveSettings();
  });
  
  widthSlider.addEventListener('input', function() {
    updateDisplayValues();
    saveSettings();
  });
  
  heightSlider.addEventListener('input', function() {
    updateDisplayValues();
    saveSettings();
  });
  
  positionXSlider.addEventListener('input', function() {
    updateDisplayValues();
    saveSettings();
  });
  
  positionYSlider.addEventListener('input', function() {
    updateDisplayValues();
    saveSettings();
  });
  
  toggleBtn.addEventListener('click', function() {
    enableCheckbox.checked = !enableCheckbox.checked;
    saveSettings();
    updateStatus();
  });
  
  resetBtn.addEventListener('click', function() {
    enableCheckbox.checked = false;
    opacitySlider.value = 0.8;
    widthSlider.value = 400;
    heightSlider.value = 600;
    positionXSlider.value = 20;
    positionYSlider.value = 20;
    
    updateDisplayValues();
    saveSettings();
    updateStatus();
  });
});
