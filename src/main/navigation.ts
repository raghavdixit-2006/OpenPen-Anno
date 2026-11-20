import type { WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'

/**
 * Every window is a single fixed page, so foreign navigations must be blocked.
 *
 * Vite reloads a page with `location.reload()` when an edited module has no HMR
 * accept handler — the plain-TypeScript overlay page has none. Electron reports
 * that reload through `will-navigate`, so a blanket `preventDefault()` freezes
 * the window on stale JavaScript for the rest of the dev session while the dev
 * server keeps logging successful updates. Allow the dev server's own origin in
 * development and block everything else in every build.
 */
export function guardNavigation(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (isDevServerUrl(url)) return
    event.preventDefault()
  })
}

function isDevServerUrl(target: string): boolean {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!is.dev || !devUrl) return false

  try {
    return new URL(target).origin === new URL(devUrl).origin
  } catch {
    return false
  }
}
