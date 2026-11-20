# AGENTS.md

OpenPen Anno (formerly InkSpace): transparent always-on-top annotation
overlay for Windows, built with Electron + React. Detailed context and
decisions live in [`.opencode/context.md`](.opencode/context.md) — read it
before larger changes.

Repository: <https://github.com/raghavdixit-2006/OpenPen-Anno>

## Working agreement

- InkSpace v1 was delivered in 5 approved steps. OpenPen Anno v2 proceeds in
  approved steps: implement only the current step, then stop and report; do not
  add unrequested features.
- Do not add dependencies without asking. Approved so far:
  `perfect-freehand`, `electron-store`, `@playwright/test`, `electron-log`,
  `electron-updater`.
- No auth, backend, cloud, AI, or collaboration features.

## Commands

```bash
pnpm dev            # Electron app; renderer HMR. Restart after main/preload edits (see below)
pnpm test           # Vitest, only src/engine/**/*.test.ts
pnpm test:e2e       # pnpm build + Playwright Electron E2E (launches the app)
pnpm vitest run src/engine/history.test.ts        # single file
pnpm vitest run src/engine/history.test.ts -t "undo"  # single test
pnpm typecheck      # node + web tsconfigs, run both
pnpm lint           # eslint --cache .
pnpm build          # typecheck + electron-vite build
```

- `pnpm typecheck:node` covers `src/main`, `src/preload`, `src/shared`;
  `pnpm typecheck:web` covers `src/renderer`, `src/engine`, `src/shared`.
  Changes to `src/shared` require both.
- Vitest only includes `src/engine/**/*.test.ts`. Tests placed elsewhere are
  silently not run.
- pnpm build approvals live in `pnpm-workspace.yaml` (`allowBuilds`), not in
  `package.json`. pnpm runs through corepack.

## Architecture that matters

- **Main owns all state** (`src/main/state.ts`), validates every IPC payload,
  and broadcasts `stateChanged`. Renderers mirror it; they never own mode, tool,
  colour, or size. Toolbar updates are optimistic, then reconciled.
- **All IPC channel names/types live in `src/shared/ipc.ts`.** Do not invent
  string channels in components or preload.
- Two renderer entrypoints, both declared in `electron.vite.config.ts`
  (`overlay`, `toolbar`). Adding a page means adding it to that rollup input.
- **`src/engine/` must stay free of React and Electron imports.** It holds the
  vector stroke model, two-canvas renderer, and undo history; it is the only
  unit-tested layer.
- Pointer data is read in the overlay with Canvas 2D + rAF. Never route
  pointer-move coordinates through React state.
- Renderer security is load-bearing: `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`, minimal preload surface. Keep the
  strict production CSP in each HTML file; only the dev plugin may add
  `'unsafe-inline'` for React Fast Refresh.

## Windows-specific traps (already hit once)

- The overlay must **not** use `fullscreen: true` — it disables DWM
  transparency. It is a frameless transparent window sized to display bounds.
- Both windows are topmost at `screen-saver` level. Drawing activates/raises the
  overlay above the toolbar and breaks its buttons. The overlay is
  `focusable: false`; call `raiseToolbar()` after showing or re-bounding the
  overlay. Regression signature: toolbar stops responding after the first
  stroke.
- Windows clamps a frameless full-height window to the work area, leaving a
  ~48 px gap at the bottom. `syncOverlayBounds()` re-applies display bounds in
  `ready-to-show`.
- The dev machine runs at 125% DPI (1920×1080 physical, 1536×864 DIP). Any
  external screenshot/click automation must be DPI-aware or coordinates are
  virtualised — this caused a false "toolbar is invisible" bug hunt.
- `WindowFromPoint` is unreliable for layered/transparent windows; verify
  click-through behaviourally.

## Dev workflow gotchas

- The Electron main/preload watcher is unreliable in this environment. If a
  main-process change seems ignored, restart `pnpm dev`.
- Dev-only diagnostics were removed in v1 step 5: `src/main/diagnostics.ts` is
  gone and there is no `remote-debugging-port=9222` switch. Add Playwright E2E
  coverage instead of reintroducing CDP hooks.
- `out/` is generated; never edit it.
