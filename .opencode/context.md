# InkSpace — project context

Living notes for anyone (human or agent) picking this project up. Last updated
2026-11-17, after step 3 implementation.

---

## 1. What this is

InkSpace is a Windows screen-annotation app (Epic Pen style): a transparent,
always-on-top canvas over the whole desktop. The user draws on top of any app,
then flips to passthrough so clicks reach the app underneath while the ink stays
visible.

Target: Windows 10 (1903+) / Windows 11.

Non-goals: login, backend, cloud sync, AI, collaboration.

---

## 2. Delivery plan and status

Five approved steps, stopping for confirmation after each.

| Step | Scope | Status |
| ---- | ----- | ------ |
| 1 | Scaffold, transparent overlay, draw/passthrough, pen, hotkeys | **Done, verified** |
| 2 | Engine module: vector strokes, two-canvas rendering, undo/redo/erase, tests | **Done, verified** (21 tests) |
| 3 | React + Tailwind + Zustand toolbar window, shared state over IPC | **Done, verified** |
| 4 | `perfect-freehand` pressure/velocity strokes + highlighter | **Code complete; manual verification pending** |
| 5 | `electron-store` settings, tray icon, hardware-acceleration toggle | Not started |

Step 3 is verified end-to-end (see §10 for the evidence). The only cleanup left
is the dev-only debug code, which is still useful for steps 4–5.

---

## 3. Stack

- Electron 44 (`^44.7.2`), electron-vite 6, TypeScript 5.9
- pnpm 12 (via corepack). Build approvals live in `pnpm-workspace.yaml`
  (`allowBuilds`: electron/esbuild true, electron-winstaller false).
- Renderer: React 19, Tailwind CSS 4 (`@tailwindcss/vite`), Zustand 5
- Engine tests: Vitest 5
- HTML Canvas 2D + rAF + `getCoalescedEvents()`; `perfect-freehand` arrives in step 4.

Scripts:

```bash
pnpm dev          # electron-vite dev (HMR for renderer, app for main)
pnpm test         # Vitest run (engine)
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
  index.ts          app lifecycle, IPC registration, wiring
  state.ts          authoritative OverlayState, validation, broadcast
  shortcuts.ts      globalShortcut registration (context-aware undo/redo)
  overlayWindow.ts  overlay BrowserWindow + mode switching + bounds
  toolbarWindow.ts  toolbar BrowserWindow + z-order helper
  diagnostics.ts    DEV ONLY console/load/crash forwarding

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
  docked to a screen edge (920×80 DIP horizontal, 104×680 DIP vertical).
  Window flags: `resizable: false`, `thickFrame: false`, `hasShadow: false`,
  `backgroundColor: '#00000000'`. Dragging is native OS dragging
  (`-webkit-app-region: drag` on handle regions only); the main process never
  writes bounds during a drag.

Security on both: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`, minimal preload surface, `will-navigate` / window-open denied.
Production CSP is strict (`script-src 'self'`); a dev-only Vite plugin adds
`'unsafe-inline'` for React Fast Refresh.

---

## 5. State and IPC contract

Main process owns the single source of truth (`src/main/state.ts`):

```ts
interface OverlayState {
  mode: 'draw' | 'passthrough'
  tool: 'pen' | 'highlighter' | 'eraser'
  color: string      // '#rrggbb'
  size: number       // 1..64, normalised in main
  dock: 'bottom' | 'top' | 'left' | 'right'
  collapsed: boolean // glassy circle vs full control bar
  canUndo: boolean
  canRedo: boolean
}
```

- Both windows call `getState()` on load and subscribe to `stateChanged`.
- Toolbar actions are **optimistic** locally, then reconciled by the broadcast.
- Input is validated in main (`isOverlayMode`, `isToolId`, `isDockPosition`,
  `normalizeColor`, `normalizeSize`). Never trust renderer payloads.
- The overlay reports `canUndo`/`canRedo` back after every mutation.
- Undo/redo/clear are commands sent to the overlay; history lives in the
  renderer engine.

Channels are declared once in `src/shared/ipc.ts` (`IPC` object). Add channels
there, never as string literals in components.

---

## 6. Engine

`src/engine/` has no React/Electron imports and is unit-tested.

- `types.ts` — `Point`, `Stroke`, `StrokeStyle`
- `stroke.ts` — stroke construction, point smoothing helpers,
  `hitTestStroke` for stroke-level erasing
- `history.ts` — `StrokeHistory`: snapshot arrays of immutable strokes;
  `clear()` and `remove(ids)` are single undoable steps
- `renderer.ts` — `OverlayRenderer`: committed canvas + live canvas, DPR-aware,
  `renderEraserCursor`
- `index.ts` — barrel

Invariants:

- Strokes are vectors (point arrays + style), never bitmaps.
- Pointer events are handled with Canvas 2D + rAF, **never** by putting
  pointer-move positions into React state.
- Undo/redo restores whole snapshots, so erased strokes come back exactly.
- Erasing is stroke-level (whole stroke), not pixel-level.

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
`screen.getPrimaryDisplay().bounds` in `ready-to-show` (`syncOverlayBounds()`).

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

| Shortcut | Action | Registered |
| -------- | ------ | ---------- |
| Ctrl+Shift+D | Toggle draw / passthrough | Always |
| Ctrl+Shift+C | Clear all (undoable) | Always |
| Ctrl+Z | Undo | Only while drawing |
| Ctrl+Y | Redo | Only while drawing |
| Ctrl+Shift+Q | Quit | Always |

Ctrl+Z/Y are unregistered while in passthrough so Chrome/Word keep their own
undo. Any new shortcut that collides with common app bindings should follow the
same conditional pattern.

---

## 9. UI details (toolbar)

- Two window shapes in `toolbarWindow.ts` (`DOCK_SIZE`): horizontal docks are
  920×80 DIP, side docks are 104×680 DIP (the bar surface is 88px wide via the
  8px inset; the rest is shadow room). Both are flush to their work-area edge
  (margin 0) and centred on the long axis, and re-bounded through
  `applyToolbarDock()` whenever `state.dock` / `state.collapsed` changes or the
  display layout changes. The collapsed window (`COLLAPSED_SIZE`) is a uniform
  64×64 DIP box for all four docks — a circle needs no mirroring.
- Collapsing swaps the bar for a single **glassy circular handle** at the
  screen edge: a 56px circle (white/70, hairline `ring-white/60`, backdrop
  blur, soft shadow) centred in the 64px window, 4px inset from the edge.
  There is no other collapsed chrome — the reference image's black bar is an
  illustration of the screen edge, not UI. The circle is the native drag
  handle; a 36px chevron island at its centre (`.app-no-drag`) takes pointer
  events and expands on click, its chevron pointing away from the dock.
  Hovering the island previews — the circle lifts on a `useMotionValue` scale
  via `animate()` (no re-render) and the chevron leans toward the expand
  direction (`chevronNudge` via variant propagation) — with no window-bounds
  or state churn. The expanded bar gets a matching collapse chevron right
  after the grip. Both chevrons rotate with the dock side *and* spin in on
  mount (`chevronSpin`), and `collapsed` travels in `OverlayState` so the main
  process resizes the window on the same broadcast the renderer reflows on.
  The expanded bar is dark glass (`zinc-950/85`), hairline `ring-white/10`,
  inset top highlight; text/icons are zinc-300/400.
- Collapse/expand is driven by **Motion for React** (`motion/react`, the only
  animation library). All variant/spring definitions live in
  `renderer/toolbar/animation.ts`, separate from the engine. AnimatePresence
  mounts exactly one keyed surface (`bar` / `pill`), so exit and enter run
  concurrently and crossfade in place; the tab is absolutely anchored to the
  spot it occupies in the collapsed window — the same screen spot in the
  expanded window (both shapes are flush to the edge and centred), computed by
  `dockMorph()` in `renderer/toolbar/geometry.ts`, which mirrors
  `toolbarWindow.ts` sizes and folds the bar into the **circle's footprint**
  (origin on the docked edge, ±4px inset slide: the circle sits 4px from the
  edge, the bar surface 8px inside its window). The bar's exit springs into
  that footprint (scale + translate, per `surfaceVariants`), the circle fades
  in over it (`tabVariants`). Collapse is optimistic: the UI folds first and
  `setCollapsed(true)` is only sent from AnimatePresence's `onExitComplete`,
  so the window stays large while folding and shrinks after. Expansion follows
  main: `toggleCollapsed(false)` first (window grows before the broadcast),
  then the store reconciles on the broadcast. `MotionConfig
  reducedMotion="user"` plus explicit duration-0 gating makes reduced motion
  instant. Positioning wrappers around animated elements stay plain divs so
  Motion's transform never clobbers Tailwind anchor translates.
- Controls stagger into view on expand (`CONTROL_VARIANTS` orchestrated by the
  surface's `staggerChildren`) and fade out together on collapse. Every button
  gets `tapProps` (whileHover 1.08 / whileTap 0.9 spring); colour swatches use
  a stronger hover. Raw CSS `transition` is replaced with `transition-colors`
  on motion-animated buttons so Motion's transforms don't double-ease.
- The toolbar window is dragged **natively by the OS**: `.app-drag`
  (`-webkit-app-region: drag` + grab cursor) is applied only to designated
  handle regions — the bar's grip (enlarged 44×32/32×44 hit area) and the
  collapsed glassy circle. The circle's 36px chevron island carries
  `.app-no-drag` (`-webkit-app-region: no-drag`) because drag regions swallow
  renderer pointer events — that is also why the circle's hover lift is
  driven by a motion value from the island's pointer/focus handlers instead
  of a hover variant on the circle itself. Chromium moves the window itself:
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
  the same groups into a single column, so both orientations share one
  component tree.
- Controls: grip, pen / highlighter / eraser, 8-colour palette, brush size
  slider (1–32 UI, main clamps 1–64; rotated 90° in side docks), undo, redo,
  clear, draw/passthrough pill (icon-only in side docks), and four dock-position
  buttons drawn as a screen with a bar on the target edge.
- Icons are inline SVGs in `icons.tsx`; no icon font or extra dependency.
- Tailwind 4 entry: `styles.css` starts with `@import 'tailwindcss';`.
- Zustand store mirrors `OverlayState` plus optimistic actions that call
  `window.api.toolbar.*`.

Exact control geometry is queryable at runtime via CDP (see §12) instead of
guessing pixel offsets.

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
- All four docks re-bound and reflow correctly; no renderer overflow
  (104×680 and 920×80 viewports exactly match their window sizes).

Note: with the eraser selected, the dashed ring drawn on the live canvas stays
visible while hovering. That is intended hover feedback, not leftover ink — do
not count it as stroke residue.

Static checks at signoff: `pnpm test` (29 tests), `pnpm typecheck`, `pnpm lint`,
`pnpm build` all pass. README layout/toolbar sections updated.

Remaining before release (not blocking step 4):

1. Remove the dev-only debug hooks:
   - `src/main/diagnostics.ts` + `logWindowDiagnostics()` calls in `index.ts`
   - `app.commandLine.appendSwitch('remote-debugging-port', '9222')` in
     `src/main/index.ts`
   They are `is.dev`-gated, so they never reach a production build, and CDP is
   still the fastest way to verify steps 4–5. Pending an explicit decision to
   keep them until step 5, they stay.
2. Step 3 work is uncommitted in the working tree (`feat:` commit still owed).

---

## 11. Decisions log

- Main process is the single source of truth; renderers mirror, never own state.
- Optimistic toolbar updates for immediate feedback, reconciled by broadcast.
- Overlay is not focused in draw mode; keyboard focus stays in the app below.
- Two canvases: committed strokes + live stroke (avoids full redraw per move).
- History snapshots, not command logs: simpler and exact, fine at this scale.
- No new dependency without asking. Current extras: React, Tailwind, Zustand
  (step 3), `perfect-freehand` (step 4), `electron-store` (step 5).
- Scaffold lives at the repo root (was briefly in a temporary subdirectory).
- Single-instance lock prevents a second overlay fighting for hotkeys.
- Dock side is authoritative state, not a window property: the renderer needs it
  to reflow, the main process needs it to re-bound the window.
- `collapsed` is state for the same reason: one broadcast drives both the
  window size and the compact UI.
- One toolbar component serves both orientations (a `vertical` flag drives
  flex direction) instead of separate horizontal/vertical layouts.

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

CDP requires the dev-only `remote-debugging-port=9222` switch. Targets:
`"Inkspace Overlay"` and `"InkSpace Toolbar"`.

Note: the Electron main-process file watcher did not always pick up edits in
this environment — if a main-process change seems ignored, restart `pnpm dev`.

---

## 13. Conventions

- Keep `src/shared/ipc.ts` free of Electron/DOM APIs.
- Keep `src/engine/` free of React/Electron imports and covered by Vitest.
- Read pointer data in the overlay only; do not lift pointer coordinates into
  React state.
- Validate everything crossing IPC in main.
- Match the existing style (`satisfies`, explicit return types, small modules).
- Formatting: Prettier (`.prettierrc.yaml`), ESLint flat config.
