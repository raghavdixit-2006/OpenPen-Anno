# OpenPen Anno

Draw on top of any Windows app. OpenPen Anno puts a transparent, always-on-top
overlay over the screen; draw on it, then switch to passthrough so the apps
underneath stay clickable while the ink stays visible.

Windows 10 (1903+) / Windows 11.

Repository: <https://github.com/raghavdixit-2006/OpenPen-Anno>

## Scripts

```bash
pnpm install
pnpm dev          # electron-vite dev with HMR
pnpm test         # engine unit tests (Vitest)
pnpm typecheck
pnpm build        # typecheck + production bundles
pnpm build:win    # NSIS installer
```

## Hotkeys

| Shortcut     | Action                               |
| ------------ | ------------------------------------ |
| Ctrl+Shift+D | Toggle drawing / passthrough         |
| Ctrl+Shift+C | Clear all strokes (undoable)         |
| Ctrl+Z       | Undo — registered only while drawing |
| Ctrl+Y       | Redo — registered only while drawing |
| Ctrl+Shift+Q | Quit                                 |

Ctrl+Z/Ctrl+Y are captured globally only in drawing mode, so Chrome, Word and
friends keep their own undo while the overlay is click-through.

## Layout

```
src/main/       Electron main process: overlay + toolbar windows, hotkeys, IPC
src/preload/    contextBridge API (contextIsolation, sandboxed)
src/renderer/   overlay page (transparent canvas) and React toolbar
src/engine/     framework-independent stroke model, renderer, history + tests
src/shared/     IPC channel names and types shared by all processes
```

## Toolbar

A floating control bar docks to any screen edge (bottom by default; the four
dock buttons switch sides). It holds the pen / highlighter / eraser tools, an
eight-colour palette, a brush-size slider, undo / redo / clear, and the
draw/pass-through toggle. Everything is mirrored from the main process over
IPC, so the toolbar and hotkeys never disagree.

Collapse it with the chevron next to the grip. The bar becomes a **48×48
rounded-square glass tab** inside a 64×64 DIP window. At rest the tab tucks
36 px behind the screen edge, leaving a 12 px sliver as the hover target;
hovering spring-pops it out flush and a click expands it. The whole tab is the
click target, so it is intentionally **not** a native drag region — Windows
drag regions never receive hover. Re-dock by expanding and dragging the bar's
grip. Reduced-motion mode keeps the tab fully visible and still.

## Tray

The tray icon is the app's tertiary surface, useful when the toolbar is tucked
behind the screen edge. Its menu can toggle Drawing mode, collapse the toolbar,
clear all ink, toggle hardware acceleration, and quit.

## Settings

Preferences are stored with `electron-store` in
`%APPDATA%\openpen-anno\settings.json`:

- tool, colour, brush size
- dock side and collapsed state
- hardware-acceleration preference

Drawing mode is deliberately **not** persisted: the app always starts in
passthrough so a restart cannot leave the overlay swallowing every click.
Settings are written shortly after a change and flushed on quit.

Hardware acceleration is on by default. If it is turned off from the tray, the
app offers to restart immediately; the change only takes effect on the next
launch.
