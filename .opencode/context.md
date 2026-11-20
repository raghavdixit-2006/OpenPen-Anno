# OpenPen Anno — project context

Living notes for anyone (human or agent) picking this project up. Last updated
2026-11-20, after the ultra-thin single-column dock and high-headroom labels.

---

## 1. What this is

OpenPen Anno (formerly InkSpace) is a Windows screen-annotation app (Epic Pen
style): a transparent, always-on-top canvas over the whole desktop. The user
draws on top of any app, then flips to passthrough so clicks reach the app
underneath while the ink stays visible.

Repository: <https://github.com/raghavdixit-2006/OpenPen-Anno>

Target: Windows 10 (1903+) / Windows 11.

Non-goals: login, backend, cloud sync, AI, collaboration.

---

## 2. Delivery plan and status

Five approved steps, stopping for confirmation after each.

| Step | Scope                                                                       | Status                                         |
| ---- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| 1    | Scaffold, transparent overlay, draw/passthrough, pen, hotkeys               | **Done, verified**                             |
| 2    | Engine module: vector strokes, two-canvas rendering, undo/redo/erase, tests | **Done, verified** (21 tests)                  |
| 3    | React + Tailwind + Zustand toolbar window, shared state over IPC            | **Done, verified**                             |
| 4    | `perfect-freehand` pressure/velocity strokes + highlighter                  | **Done**                                       |
| 5    | `electron-store` settings, tray icon, hardware-acceleration toggle          | **Code complete; manual verification pending** |

All five steps are implemented. The dev-only debug code (`diagnostics.ts`,
`remote-debugging-port=9222`) was removed as part of step 5.

### OpenPen Anno v2 plan

The renamed project continues in approved steps; implement only the current
step, then stop and report.

| Step | Scope                                                     | Status          |
| ---- | --------------------------------------------------------- | --------------- |
| 1    | Rebrand, settings migration, packaging metadata, doc sync | **Implemented** |
| 2    | Engine item-model foundation (`InkItem`, mixed history)   | **Implemented** |
| 3    | Shapes: arrow, line, rect, ellipse                        | **Implemented** |
| 4    | Whole-stroke + pixel-level eraser                         | **Implemented** |
| 5    | Text tool + focusable popup window                        | **Implemented** |
| 6    | Whiteboard/blackboard backdrop + spotlight                | **Implemented** |
| 7    | Laser pointer + numbered stamps                           | **Implemented** |
| 8    | Multi-monitor + mixed-DPI display selection               | **Implemented** |
| 9    | Freeze-frame zoom                                         | **Implemented** |
| 10   | Annotated screenshot capture                              | **Implemented** |
| 11   | Playwright Electron E2E suite                             | **Implemented** |
| 12   | Production logging + auto-update evaluation               | **Implemented** |

---

## 3. Stack

- Electron 44 (`^44.7.2`), electron-vite 6, TypeScript 5.9
- pnpm 12 (via corepack). Build approvals live in `pnpm-workspace.yaml`
  (`allowBuilds`: electron/esbuild true, electron-winstaller false).
- Renderer: React 19, Tailwind CSS 4 (`@tailwindcss/vite`), Zustand 5
- Engine tests: Vitest 5
- HTML Canvas 2D + rAF + `getCoalescedEvents()`; `perfect-freehand` for stroke
  outlines; `electron-store` 12 for persisted preferences (ESM-only, so it is
  dynamically imported from the CJS main bundle).
- `electron-log` 5 writes main-process logs; `electron-updater` 6 checks GitHub
  releases in installed builds.
- `@playwright/test` launches the built Electron app for E2E.

Scripts:

```bash
pnpm dev          # electron-vite dev (HMR for renderer, app for main)
pnpm test         # Vitest run (engine)
pnpm test:e2e     # build, then Playwright Electron E2E
pnpm typecheck    # node + web tsconfigs
pnpm lint         # eslint --cache .
pnpm build        # typecheck + production build
pnpm build:win    # NSIS installer
```

---

## 4. Process / window architecture

Three processes: main, preload (sandboxed, contextBridge), and two renderer
entries.

```
src/main/
  index.ts          app lifecycle, boot order, IPC registration, wiring
  state.ts          authoritative OverlayState, validation, broadcast
  settings.ts       electron-store preferences, debounced writes, HW-accel flag
  tray.ts           system tray icon + menu
  shortcuts.ts      globalShortcut registration (context-aware undo/redo)
  overlayWindow.ts  overlay BrowserWindow + mode switching + bounds
  toolbarWindow.ts  toolbar BrowserWindow + z-order helper
  display.ts        active display (follow cursor or pinned) + hotplug events
  spotlight.ts      25 Hz cursor poller for the spotlight backdrop
  textPopup.ts      focusable text editor window
  freeze.ts         desktopCapturer freeze-frame capture + toggle
  screenCapture.ts  clean display capture with app windows hidden
  screenshot.ts     annotated-screenshot round trip + save dialog
  log.ts            electron-log file transport + process error handlers
  updater.ts        electron-updater startup/manual checks

e2e/                    Playwright Electron suite (built app, isolated profile)

src/preload/index.ts   typed window.api.{overlay,toolbar}
src/shared/ipc.ts      types + channel names (no Electron/DOM imports)

src/renderer/overlay/  transparent canvas page (vanilla TS)
src/renderer/toolbar/  React + Tailwind control bar
src/engine/            framework-free stroke model, renderer, history
```

Two separate BrowserWindows:

- **Overlay** — `transparent`, frameless, no shadow, skipTaskbar, covers
  `display.bounds`, `setAlwaysOnTop(true, 'screen-saver')`, **not**
  `fullscreen: true` (fullscreen kills DWM transparency on Windows).
  `focusable: false` (see §7).
- **Toolbar** — separate always-on-top window, `transparent`, frameless,
  docked to a screen edge (800×124 DIP horizontal, 208×680 DIP vertical; the
  extra cross-axis room is inward-facing transparent headroom for hover
  labels).
  Window flags: `resizable: false`, `thickFrame: false`, `hasShadow: false`,
  `backgroundColor: '#00000000'`. Dragging is native OS dragging
  (`-webkit-app-region: drag` on handle regions only); the main process never
  writes bounds during a drag.

Security on both: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`, minimal preload surface, `will-navigate` / window-open denied.
Production CSP is strict (`script-src 'self'`); a dev-only Vite plugin adds
`'unsafe-inline'` for React Fast Refresh.

**Settings (`src/main/settings.ts`).** `electron-store` 12 persists `tool`,
`color`, `size`, `dock`, `collapsed` and `hardwareAcceleration` to
`%APPDATA%\openpen-anno\settings.json`. `src/main/index.ts` pins `userData` to
`appData/openpen-anno` before the single-instance lock, so the path does not
depend on `productName`. On first launch `migrateLegacySettings()` copies
`settings.json` from `%APPDATA%\inkspace` or `%APPDATA%\InkSpace` if the new
file does not exist yet; the old folder is left for rollback. The module is
ESM-only while the main bundle is CommonJS, so it is loaded with `await
import()` inside `loadSettings()`. That call is the first thing `bootstrap()`
does — before `app.whenReady()` and before any window — because
`hardwareAcceleration: false` must reach `app.disableHardwareAcceleration()`
before Electron initialises the GPU process, and because the toolbar window
must be created in its persisted dock/collapsed shape. Stored values are
sanitised through the same validators as IPC (`isToolId`, `isDockPosition`,
`normalizeColor`, `normalizeSize`); a corrupt file falls back to defaults and
never blocks startup.

**Tray (`src/main/tray.ts`).** A 32 px `resources/icon.png` in the notification
area (the resource is in `asarUnpack`, so the path works packaged). The menu is
the tertiary surface for when the toolbar is tucked behind the screen edge:
Drawing mode (checkbox), Collapse toolbar (checkbox), Clear all ink (enabled
when `canUndo`), Hardware acceleration (checkbox), Quit. It is rebuilt from
state on every `onStateChange`; the hardware-acceleration item persists the
flag immediately and offers `Restart now` / `Later`, since the setting only
applies on the next start.

---

## 5. State and IPC contract

Main process owns the single source of truth (`src/main/state.ts`):

```ts
interface OverlayState {
  mode: 'draw' | 'passthrough'
  tool:
    | 'pen'
    | 'highlighter'
    | 'eraser'
    | 'text'
    | 'laser'
    | 'stamp'
    | 'line'
    | 'arrow'
    | 'rect'
    | 'ellipse'
  color: string // '#rrggbb'
  size: number // 1..64, normalised in main
  eraserMode: 'stroke' | 'pixel'
  backdrop: 'none' | 'white' | 'black' | 'spotlight'
  frozen: boolean // paused screenshot under the ink; never persisted
  dock: 'bottom' | 'top' | 'left' | 'right'
  collapsed: boolean // tucked glass tab vs full control bar
  canUndo: boolean
  canRedo: boolean
}
```

- Both windows call `getState()` on load and subscribe to `stateChanged`.
- Toolbar actions are **optimistic** locally, then reconciled by the broadcast.
- Input is validated in main (`isOverlayMode`, `isToolId`, `isEraserMode`,
  `isDockPosition`, `normalizeColor`, `normalizeSize`). Never trust renderer
  payloads.
- The overlay reports `canUndo`/`canRedo` back after every mutation.
- Undo/redo/clear are commands sent to the overlay; history lives in the
  renderer engine.
- Preferences (`tool`, `color`, `size`, `eraserMode`, `backdrop`, `dock`,
  `collapsed`) are persisted in `src/main/settings.ts` and seeded into
  `state.ts` via `hydrateState()` before any window exists. `mode` and `frozen`
  are deliberately **not** persisted: a restart always starts in `passthrough`
  with no frozen frame, so the overlay never boots swallowing clicks.
- Persistence writes are debounced (250 ms, the size slider fires per step) and
  flushed synchronously on `before-quit`.

Channels are declared once in `src/shared/ipc.ts` (`IPC` object). Add channels
there, never as string literals in components.

---

## 6. Engine

`src/engine/` has no React/Electron imports and is unit-tested.

- `types.ts` — `Point`, `InkItemBase`, `Stroke` (`kind: 'freehand'`),
  `InkItem` union, `StrokeStyle`, `Bounds`
- `items.ts` — `getItemBounds` / `hitTestItem`: the single place that switches
  on `InkItem['kind']`; new item kinds add a branch here
- `shape.ts` — `Shape` construction, shift constraints (45° lines, square
  boxes), geometry, bounds, eraser hit tests and canvas painting
- `eraser.ts` — `EraserStroke` items for pixel-level erasing; `destination-out`
  painting so replaying history reproduces the same holes
- `text.ts` — `TextItem` construction, normalisation, estimated bounds, hit
  tests and canvas painting
- `stamp.ts` — numbered presentation badges (`StampItem`), legible numeral
  colour on bright swatches, bounds/hit tests/painting
- `laser.ts` — transient laser trail samples with age-based fade; pruned by
  timestamp, never enters history
- `backdrop.ts` — full-bleed whiteboard/blackboard fills and the spotlight
  sheet; `BackdropRenderer` owns its own canvas below the ink
- `freeze.ts` — `FreezeRenderer`: the captured still layer between the backdrop
  and the ink
- `zoom.ts` — pure viewport math for the freeze frame: `toWorld`, cursor-
  anchored `zoomAt` (1–4×), `panZoom`, edge `clampPan`, `zoomCss`
- `stroke.ts` — stroke construction, point smoothing helpers,
  `hitTestStroke` for stroke-level erasing
- `history.ts` — `InkHistory`: snapshot arrays of immutable `InkItem`s;
  `clear()` and `remove(ids)` are single undoable steps
- `renderer.ts` — `OverlayRenderer`: committed canvas + live canvas, DPR-aware,
  `renderItems` / `paintItem` / `repaintItemRegion`, `renderEraserCursor`;
  the exported `paintItem(ctx, item, outline?)` paints a single item on any
  context for offscreen screenshot composition
- `index.ts` — barrel

Invariants:

- Strokes are vectors (point arrays + style), never bitmaps.
- Shapes are two-corner vectors (`start`, `end`) normalized at paint time, so
  they can be dragged in any direction and stay resolution-independent.
- Pointer events are handled with Canvas 2D + rAF, **never** by putting
  pointer-move positions into React state.
- Undo/redo restores whole snapshots, so erased strokes come back exactly.
- Two eraser modes: **stroke** removes whole items by id (non-destructive,
  bounds-limited repaint); **pixel** commits an `EraserStroke` history item and
  clears pixels with `destination-out`, so undo/redo replays it in order.
- The two modes live in main state (`eraserMode`) and persist across restarts.
- Backdrops are a separate layer below all ink. Solid modes are one fill;
  spotlight dims the screen and punches a soft `destination-out` hole at the
  cursor. Main polls the OS cursor at 25 Hz so spotlight keeps working while
  the overlay is click-through, and the overlay reads pointer events directly
  while drawing.
- Freeze-frame mode captures the active display with `desktopCapturer` at
  native resolution and paints it below the ink. The freeze canvas, committed
  ink and live ink share one `#viewport` CSS transform, so annotations stay
  registered to the captured pixels while zooming. Wheel zooms 1–4× anchored
  at the pointer; middle/right drag pans, clamped so the still always covers the
  viewport. Every pointer position is converted with `toWorld` before it enters
  the engine. Freezing implies drawing mode; leaving drawing unfreezes, so a
  still frame can never sit on top of passthrough.
- Annotated screenshots are a main↔overlay round trip: main hides both app
  windows, captures the active display natively, and sends the clean frame to
  the overlay. The overlay composites the frozen still (if any), solid backdrop
  colour, and every committed item with the current zoom, then returns a PNG
  that main writes through a save dialog. The toolbar camera button and the
  tray item are the entry points.

---

## 7. Windows-specific knowledge (hard-won)

**Z-order.** Both windows are topmost at `screen-saver` level, so whichever was
raised last wins. Clicking/drawing on the overlay activates and raises it above
the toolbar, which then swallows toolbar clicks. Mitigations:

- Overlay is `focusable: false` so drawing never activates it.
- `raiseToolbar()` is called after the overlay is shown, re-bounded, or has its
  mode changed (`overlayWindow.ts` → `toolbarWindow.ts`).
- Regression signature: toolbar stops responding after the first stroke.

**Bounds.** On Windows a frameless, non-resizable window created at full display
height can be silently clamped to the work area (48 px short at 1080p). Re-apply
the active display's bounds in `ready-to-show` (`syncOverlayBounds()`).

**DPI.** Test machine is 1920×1080 at 125% (120 DPI). Electron reports DIP
(1536×864). Any external screen-capture or click automation must call
`SetProcessDpiAwarenessContext(-4)` or the coordinates are virtualised and
screenshots silently show the wrong region. This caused a false "toolbar is
invisible" investigation — the toolbar was fine.

**Mouse behaviour.** Draw mode: `setIgnoreMouseEvents(false)`.
Passthrough: `setIgnoreMouseEvents(true, { forward: true })`. Draw mode must
**not** `focus()` the overlay: it receives mouse input while inactive, and
leaving keyboard focus in the underlying app is intentional.

**Layered windows.** `WindowFromPoint` is unreliable on layered/transparent
windows; verify click-through behaviourally instead.

---

## 8. Hotkeys (`src/main/shortcuts.ts`)

| Shortcut     | Action                    | Registered         |
| ------------ | ------------------------- | ------------------ |
| Ctrl+Shift+D | Toggle draw / passthrough | Always             |
| Ctrl+Shift+F | Toggle freeze frame       | Always             |
| Ctrl+Shift+C | Clear all (undoable)      | Always             |
| Ctrl+Z       | Undo                      | Only while drawing |
| Ctrl+Y       | Redo                      | Only while drawing |
| Ctrl+Shift+Q | Quit                      | Always             |

Ctrl+Z/Y are unregistered while in passthrough so Chrome/Word keep their own
undo. Any new shortcut that collides with common app bindings should follow the
same conditional pattern.

---

## 9. UI details (toolbar)

- Two window shapes in `toolbarWindow.ts` (`DOCK_SIZE`): horizontal docks are
  800×124 DIP, side docks are 208×680 DIP. The visible rail is 784×44 / 56×664
  (8px inset); the extra cross-axis room is inward-facing transparent headroom
  for the dock magnification and label pills. Both windows are flush to their
  work-area edge (margin 0) and centred on the long axis, and re-bounded through
  `applyToolbarDock()` whenever `state.dock` / `state.collapsed` changes or the
  display layout changes. The collapsed window (`COLLAPSED_SIZE`) is a uniform
  64×64 DIP box for all four docks — the popped tab fits with shadow room.
  `getToolbarRailBounds()` exposes the visible rail so the options popover is
  positioned against the bar, not the enlarged window. The side rail is a
  single 56px column; its 664px height is the cost of stacking nine 32px tools
  plus the utility, mode and dock groups linearly.
- Collapsing swaps the bar for a **rounded-square glass tab** (48px,
  `rounded-[10px]`, white/70, hairline `ring-white/60`, backdrop blur, soft
  shadow) that lives mostly behind the screen edge. Tucked, it sits
  `TAB_TUCK` (36px) out of view with only a `TAB_SLIVER` (12px) visible as
  the hover target; hovering spring-pops it flush with the edge
  (`tabTuckVariants`), revealing its chevron (pointing away from the dock),
  and a click anywhere on the tab expands. The whole tab is the click target,
  so it is deliberately not a native drag region — drag regions never receive
  hover; drag the expanded bar's grip to re-dock instead. The pop is
  renderer-side transform only: no window-bounds or state churn. Reduced
  motion keeps the tab fully visible and still. The expanded bar gets a
  matching collapse chevron right after the grip. Both chevrons rotate with
  the dock side _and_ spin in on mount (`chevronSpin`), and `collapsed`
  travels in `OverlayState` so the main process resizes the window on the
  same broadcast the renderer reflows on. The expanded bar is dark glass
  (`zinc-950/85`), hairline `ring-white/10`, inset top highlight;
  text/icons are zinc-300/400.
- Collapse/expand is driven by **Motion for React** (`motion/react`, the only
  animation library). All variant/spring definitions live in
  `renderer/toolbar/animation.ts`, separate from the engine. AnimatePresence
  mounts exactly one keyed surface (`bar` / `pill`), so exit and enter run
  concurrently and crossfade in place; the tab is absolutely anchored to the
  spot it occupies in the collapsed window — the same screen spot in the
  expanded window (both shapes are flush to the edge and centred), computed by
  `dockMorph()` in `renderer/toolbar/geometry.ts`, which mirrors
  `toolbarWindow.ts` sizes and folds the bar into the **tucked tab's sliver
  footprint** (48×12, flush to the edge; origin on the docked edge, ±8px
  inset slide: the sliver is flush while the bar surface sits 8px inside its
  window). The bar's exit springs into that footprint (scale + translate, per
  `surfaceVariants`), the tab fades in over it, tucked (`tabVariants` +
  `tabTuckVariants`). Collapse is optimistic: the UI folds first and
  `setCollapsed(true)` is only sent from AnimatePresence's `onExitComplete`,
  so the window stays large while folding and shrinks after. Expansion follows
  main: `toggleCollapsed(false)` first (window grows before the broadcast),
  then the store reconciles on the broadcast. `MotionConfig
reducedMotion="user"` plus explicit duration-0 gating makes reduced motion
  instant. Positioning wrappers around animated elements stay plain divs so
  Motion's transform never clobbers Tailwind anchor translates.
- Controls stagger into view on expand (`CONTROL_VARIANTS` orchestrated by the
  surface's `staggerChildren`) and fade out together on collapse. Utility
  buttons get `tapProps` (whileHover 1.08 / whileTap 0.9 spring); colour swatches
  use a stronger hover. Raw CSS `transition` is replaced with `transition-colors`
  on motion-animated buttons so Motion's transforms don't double-ease.
- Tool buttons (the six tools plus Shapes) are 32px dark squircle tiles in
  `DockTile.tsx`. Horizontal docks lay them in one row; side docks stack them
  in one 56px column (no cross-axis term — the bell follows the single axis).
  A `useMotionValue` / `useSpring` pointer position feeds each tile's
  `useTransform` bell: hovered ~1.18×, adjacent ~1.08×, second ~1.02×,
  otherwise 1×, with a 6px tile gap keeping magnified neighbours clear. The
  same bell lifts tiles 8px away from the docked edge (bottom = up, top = down,
  left = right, right = left). The hovered tile shows a floating
  `bg-zinc-950/95` label pill with an 8px gap on the inward side; horizontal
  pills get a tiny dock-aware arrow (down for bottom docks, up for top docks),
  and the pill is pointer-events-none and animates through `AnimatePresence`.
  `MotionConfig reducedMotion="user"` plus explicit `reduce` gates pin the
  scale/lift at rest while the static pill still appears. Backdrop and freeze
  share the tile surface but keep their plain toggle interaction.
- The toolbar window is dragged **natively by the OS**: `.app-drag`
  (`-webkit-app-region: drag` + grab cursor) is applied only to the expanded
  bar's grip (enlarged 44×32/32×44 hit area). The collapsed tab is not a
  drag region because drag regions swallow renderer pointer events and the
  tab must see hover to pop out; re-dock by expanding first. Chromium moves
  the window itself:
  zero IPC, zero bounds writes and zero React re-renders during the gesture;
  buttons and sliders live outside drag regions so they stay clickable with
  hover/press feedback. A previous JS-pointer-drag implementation (`use-drag-toolbar.ts`,
  per-frame `moveToolbar` IPC → `setBounds`) was removed: per-frame programmatic
  moves on a transparent topmost window block the main process and make DWM
  re-present the window's full rect, which read as a translucent sheet around
  the dock plus heavy lag.
- When the native move loop ends, the window's `moved` event fires once and
  the main process re-docks in a **single bounds change**
  (`snapToolbarToEdge()`): nearest edge by window centre; a dock change goes
  through `patchState` (the subscriber re-applies exact bounds, swapping
  orientation in the same tick), same-edge drops get one direct `setBounds`.
  No snap animation loop — an earlier `setInterval` spring glide did repeated
  `setBounds` per tick and had the same translucent-rect/lag problems.
- The dock is a dark glass floating surface (near-black, large radius, soft
  shadow, hairline ring). Bottom/top docks are one row; left/right docks stack
  the same groups into a single 56px column (tools, utility, mode and dock
  chooser are each `flex flex-col`), so both orientations share one component
  tree. Vertical tiles are 32×32, not stretched to the rail width.
- Controls: grip, pen / highlighter / eraser / text / laser / stamp, a shape
  picker (arrow, line, rect, ellipse), backdrop cycle (none / whiteboard /
  blackboard / spotlight), freeze-frame toggle, 8-colour palette, brush size
  slider (1–32 UI, main clamps 1–64; rotated 90° in side docks), undo, redo,
  save annotated screenshot, clear, draw/passthrough pill (icon-only in side
  docks), and four dock-position buttons drawn as a screen with a bar on the
  target edge. The palette slot swaps for eraser modes or the shape menu based
  on the active tool.
- Icons are inline SVGs in `icons.tsx`; no icon font or extra dependency.
- Tailwind 4 entry: `styles.css` starts with `@import 'tailwindcss';`.
- Zustand store mirrors `OverlayState` plus optimistic actions that call
  `window.api.toolbar.*`.

Exact control geometry is no longer inspected over CDP (that hook is gone); the
built app is exercised by the Playwright suite instead (see §12).

---

## 10. Open items / known state

Step 3 verification (2026-11-17, real Windows input via `ui.ps1`, state read
over CDP):

- Toolbar stays clickable **after drawing**, in both a side dock and the bottom
  dock — the `focusable: false` fix holds. First stroke no longer hides the
  controls.
- Undo / redo after a stroke: ink 2811 → 0 → 2780 (snapshot repaint).
- Eraser removes the whole stroke after a stroke exists; undo restores it
  exactly (2780).
- Clear empties the layer and is undoable.
- Tool, colour and size reach the canvas: red then `#0a84ff` ink, highlighter
  alpha 0.4, size 6 vs 32 changes ink ~4× for a same-length stroke.
- Mode pill and Ctrl+Shift+D stay in sync in both directions.
- Toolbar remains clickable while the overlay is in passthrough.
- All four docks re-bound and reflow correctly; no renderer overflow (the
  then-current 104×680 and 920×80 viewports matched their window sizes; the
  compact toolbar and dock magnification superseded those dimensions).

Note: with the eraser selected, the dashed ring drawn on the live canvas stays
visible while hovering. That is intended hover feedback, not leftover ink — do
not count it as stroke residue.

Static checks at signoff: `pnpm test` (29 tests), `pnpm typecheck`, `pnpm lint`,
`pnpm build` all pass. README layout/toolbar sections updated.

Remaining before release:

1. Manual verification of v1 step 5: preferences survive a restart, the app
   always starts in passthrough, tray menu actions work, and the
   hardware-acceleration toggle persists and offers a restart.
2. Manual verification of the rebrand: the legacy `inkspace` settings file is
   copied to `%APPDATA%\openpen-anno\settings.json` on first launch, and the
   NSIS build shows OpenPen Anno everywhere.
3. Manual verification of v2 steps 2–12 (see §2), especially mixed-DPI
   multi-monitor selection, freeze-frame zoom quality, the text popup, and the
   annotated-screenshot save dialog.

The dev-only debug hooks were removed in step 5: `src/main/diagnostics.ts` is
gone, and `src/main/index.ts` no longer appends
`remote-debugging-port=9222`.

---

## 11. Decisions log

- Main process is the single source of truth; renderers mirror, never own state.
- Optimistic toolbar updates for immediate feedback, reconciled by broadcast.
- Overlay is not focused in draw mode; keyboard focus stays in the app below.
- Two canvases: committed strokes + live stroke (avoids full redraw per move).
- History snapshots, not command logs: simpler and exact, fine at this scale.
- No new dependency without asking. Current extras: React, Tailwind, Zustand
  (step 3), `perfect-freehand` (step 4), `electron-store` (step 5),
  `@playwright/test` (E2E), `electron-log` and `electron-updater` (production).
- Scaffold lives at the repo root (was briefly in a temporary subdirectory).
- Single-instance lock prevents a second overlay fighting for hotkeys.
- Dock side is authoritative state, not a window property: the renderer needs it
  to reflow, the main process needs it to re-bound the window.
- `collapsed` is state for the same reason: one broadcast drives both the
  window size and the compact UI.
- One toolbar component serves both orientations (a `vertical` flag drives
  flex direction) instead of separate horizontal/vertical layouts.
- Preferences persist, transient state does not: `mode` is never stored, so the
  app always boots in `passthrough` and a crash/restart cannot leave the
  overlay swallowing every click.
- Hardware acceleration defaults on; the persisted switch is applied before
  `whenReady()` and therefore requires a restart, which the tray offers to do
  immediately.
- The tray menu is the tertiary surface for the app (after the toolbar and
  global hotkeys), and the only UI for the hardware-acceleration switch.

---

## 12. Local verification tooling

Not part of the product; lives in
`C:\Users\ragha\AppData\Local\Temp\opencode\` on the dev machine.

- `ui.ps1` — DPI-aware `click` / `absclick` / `drag` / `absdrag` / `rect`
  helpers driven by Win32 `mouse_event`.
- `cdp.mjs` — evaluates an expression (or `@file` expression) in a window over
  the Chrome DevTools Protocol.
- `expr-state.js` — reads toolbar mode/tool/colour/undo/redo/size from the DOM.
- `expr-ink.js` — counts non-transparent pixels on both overlay canvases. This
  is the reliable ink check; counting screen pixels is polluted by the app
  underneath.

CDP needed the dev-only `remote-debugging-port=9222` switch, which was removed
with the step-5 debug cleanup; re-add it temporarily if runtime inspection is
ever needed again. Targets: `"OpenPen Anno Overlay"` and
`"OpenPen Anno Toolbar"`.

**Playwright E2E** is the supported replacement for those runtime hooks:
`playwright.config.ts` runs `e2e/*.spec.ts` against the built app
(`pnpm test:e2e` builds first). Tests launch Electron with
`OPENPEN_ANNO_USER_DATA` pointing at a temp profile, so real settings and
logs are untouched. They cover window titles, mode/tool IPC, collapse bounds,
freeze toggling, and preference persistence across a relaunch. The suite is
Windows-first and launches the real app, so it is run manually, not in the
normal unit-test loop.

Note: the Electron main-process file watcher did not always pick up edits in
this environment — if a main-process change seems ignored, restart `pnpm dev`.

---

## 13. Production logging and updates

- `src/main/log.ts` initialises `electron-log` after `userData` is pinned.
  Main-process logs go to `<userData>/logs/main.log` (5 MB cap) and to the
  console in dev; uncaught exceptions and unhandled rejections are recorded.
- `src/main/updater.ts` uses `electron-updater` with the GitHub publish config
  in `electron-builder.yml`. Installed builds check five seconds after launch,
  download in the background, and prompt to restart when ready. The tray has
  a **Check for updates…** command; development builds show an explanatory
  dialog instead of touching the network.

---

## 14. Conventions

- Keep `src/shared/ipc.ts` free of Electron/DOM APIs.
- Keep `src/engine/` free of React/Electron imports and covered by Vitest.
- Read pointer data in the overlay only; do not lift pointer coordinates into
  React state.
- Validate everything crossing IPC in main.
- Match the existing style (`satisfies`, explicit return types, small modules).
- Formatting: Prettier (`.prettierrc.yaml`), ESLint flat config.
