import { defineConfig } from '@playwright/test'

/**
 * Electron E2E. Tests launch the built app (`pnpm test:e2e` builds first), so
 * they exercise the real main/preload/renderer boundary instead of a mocked
 * renderer. One worker: the app is a singleton with global hotkeys.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure'
  }
})
