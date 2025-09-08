# YouTube Live Chat Overlay Extension

Chrome extension that displays a non-intrusive live chat overlay while watching YouTube videos in fullscreen. The overlay is configurable, supports per-user blocking, and adapts to the video play/pause state.

## Features

- Show chat overlay in fullscreen
- Drag to move, resize via bottom-right handle
- Overlay settings panel (on the overlay header)
  - Background opacity
  - Width and height
  - Polling interval (ms)
  - Reset to defaults
- Pause-aware scanning (auto-stops when the video is paused; resumes on play)
- Click a chat message to block that author (inline, no exit from fullscreen)
- Persistent blocked users list (view/unblock from popup)
- Simplified popup: Enable/Disable overlay, Reset, and Blocked users list
- Stores settings in `chrome.storage.sync`

## Installation

1. Download all files to a folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. Extension will appear in extensions list

## Usage

1. Install and enable the extension
2. Open a YouTube video (live or replay with chat)
3. Open the extension popup
   - Toggle "Enable Overlay"
   - Optionally review/unblock users in the Blocked users list
4. Go fullscreen to see the overlay
5. On the overlay header, click "Settings" to adjust:
   - Opacity, width, height
   - Polling interval (ms)
   - Reset to defaults
6. Click on a chat message (author or message area) to open an inline Block/Cancel prompt
   - Choose Block to hide all future messages from that author

## Popup

- Enable Overlay: turns the overlay on/off for the current page
- Reset Overlay: restores default size, position, opacity, polling interval, clears paused state and blocked users
- Blocked users: shows all blocked authors; use Unblock to remove

## File Structure

- `manifest.json`: Extension configuration
- `popup.html`: Control popup interface
- `popup.js`: Popup logic
- `content.js`: Script injected into YouTube
- `overlay.css`: Overlay styles
- `background.js`: Background script

## Notes

- Works on YouTube pages only
- Overlay displays in fullscreen; it auto-hides when not in fullscreen
- Some chats embedded in cross-origin iframes may have restricted access
- All settings (including blocked users) are saved and restored via `chrome.storage.sync`

## Troubleshooting

If the overlay does not display:
1. Ensure the extension is enabled and the popup toggle is on
2. Refresh the YouTube page after enabling
3. Ensure the video is in fullscreen
4. Check DevTools console for errors on the YouTube tab

## Version

- Version: 1.1
- Compatible: Chrome Manifest V3
- Supports: YouTube Chat (live and replay where accessible)
