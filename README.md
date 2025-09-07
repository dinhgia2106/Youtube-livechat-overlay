# YouTube Live Chat Overlay Extension

Chrome extension to display chat overlay when watching YouTube live stream in fullscreen.

## Features

- Display chat overlay when in fullscreen mode
- **Drag overlay** to move position
- **Resize overlay** by dragging corner
- **Direct settings** on overlay (no popup needed)
- Adjust background opacity of overlay
- Change size and position of chat box
- Auto-update chat messages
- Transparent interface with dark background

## Installation

1. Download all files to a folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. Extension will appear in extensions list

## Usage

1. Visit YouTube and open a live stream
2. Click extension icon on toolbar
3. Enable "Chat Overlay" in popup
4. Enter fullscreen to see overlay
5. **Adjust directly on overlay:**
   - **Drag header** to move overlay
   - **Drag bottom-right corner** to resize
   - **Click ⚙ button** to open settings:
     - Background opacity (0.1 - 1.0)
     - Width (200 - 800px)
     - Height (200 - 800px)
     - Reset to default

## Keyboard Shortcuts

- `Ctrl+Shift+O`: Toggle overlay on/off

## File Structure

- `manifest.json`: Extension configuration
- `popup.html`: Control popup interface
- `popup.js`: Popup logic
- `content.js`: Script injected into YouTube
- `overlay.css`: Overlay styles
- `background.js`: Background script

## Notes

- Extension only works on YouTube
- Chat overlay only displays in fullscreen mode
- Some live streams may not support chat reading due to security settings
- Extension automatically saves settings and restores on restart

## Troubleshooting

If overlay doesn't display:
1. Check extension is enabled
2. Refresh YouTube page
3. Check console for errors
4. Try disabling/enabling extension

## Version

- Version: 1.0
- Compatible: Chrome Manifest V3
- Support: YouTube Live Chat
