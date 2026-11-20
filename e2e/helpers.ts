import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import type { OverlayState } from '../src/shared/ipc'

export interface LaunchedApp {
  app: ElectronApplication
  overlay: Page
  toolbar: Page
}

export async function pageByTitle(app: ElectronApplication, title: string): Promise<Page> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    for (const candidate of app.windows()) {
      if (candidate.isClosed()) continue
      try {
        if ((await candidate.title()) === title) return candidate
      } catch {
        // The window can still be navigating; try again on the next tick.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for the "${title}" window`)
}

/**
 * Dismisses every floating options panel. The panel closes itself on blur in a
 * real session, but Playwright clicks do not always move OS focus, so tests
 * close it explicitly between flows.
 */
export async function closePopovers(app: ElectronApplication): Promise<void> {
  for (const candidate of app.windows()) {
    if (candidate.isClosed()) continue
    try {
      if ((await candidate.title()) === 'OpenPen Anno Tool Options') {
        await candidate.evaluate(() => {
          const api = (
            globalThis as unknown as {
              api: { popover: { close: () => void } }
            }
          ).api
          api.popover.close()
        })

        // The close is sent over IPC; wait for the window to actually leave so
        // the next flow cannot pick up the dying page by its shared title.
        const deadline = Date.now() + 5_000
        while (!candidate.isClosed() && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }
    } catch {
      // The panel vanished while it was being inspected; nothing to close.
    }
  }
}

/**
 * Launches the built app with an isolated profile. The main process honours
 * OPENPEN_ANNO_USER_DATA, so tests never read or write the real settings file.
 */
export async function launchApp(userDataDir: string): Promise<LaunchedApp> {
  const app = await electron.launch({
    args: ['.'],
    env: {
      ...(process.env as Record<string, string>),
      OPENPEN_ANNO_USER_DATA: userDataDir
    },
    timeout: 30_000
  })

  const overlay = await pageByTitle(app, 'OpenPen Anno Overlay')
  const toolbar = await pageByTitle(app, 'OpenPen Anno Toolbar')
  return { app, overlay, toolbar }
}

export async function readState(page: Page): Promise<OverlayState> {
  return page.evaluate(() => {
    const api = (
      globalThis as unknown as {
        api: { overlay: { getState: () => Promise<OverlayState> } }
      }
    ).api
    return api.overlay.getState()
  })
}

/** Reads a toolbar window's OS bounds from the main process. */
export async function toolbarBounds(
  app: ElectronApplication
): Promise<{ width: number; height: number } | null> {
  return app.evaluate(({ BrowserWindow }) => {
    const toolbar = BrowserWindow.getAllWindows().find(
      (window) => window.getTitle() === 'OpenPen Anno Toolbar'
    )
    const bounds = toolbar?.getBounds()
    return bounds ? { width: bounds.width, height: bounds.height } : null
  })
}
