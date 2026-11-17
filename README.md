# InkSpace

Draw on top of any Windows app. InkSpace puts a transparent, always-on-top
overlay over the screen; draw on it, then switch to passthrough so the apps
underneath stay clickable while the ink stays visible.

Windows 10 (1903+) / Windows 11.

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
