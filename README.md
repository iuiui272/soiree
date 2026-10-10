# Soirée

Design an invite, share it as a link. Static site: no server, no account.

## Deploy (GitHub Pages)
1. Put everything in this folder at the top of a repo (or in a subfolder).
2. Settings, Pages, deploy from the `main` branch.
3. On iPhone or iPad, open the Pages link in Safari, then Share, Add to Home Screen.

## Files
- `index.html` styles and boot
- `js/core.js` data, link packing, poster renderer, Dynamic Island ring
- `js/app.js` layout, sidebar, routing, views
- `js/editor.js` invite editor
- `js/settings.js` sheets, settings, profile
- `js/templates.js`, `js/assistant.js`, `js/nearby.js`, `js/services.js`, `js/export.js`, `js/qr.js`, `js/devtools.js`

## Testing tips
- `?preview` skips the iOS install gate
- `?sim=393x852` simulates a Dynamic Island screen
- Settings, tap "Device" five times: developer menu with a device emulator
- `?broker=wss://...` overrides the Nearby relay
