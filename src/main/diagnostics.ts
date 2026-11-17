import type { BrowserWindow } from 'electron'

/**
 * Dev-only window diagnostics. Renderer crashes, preload failures and CSP
 * violations are otherwise invisible when the window is transparent.
 */
export function logWindowDiagnostics(window: BrowserWindow, label: string): void {
  const contents = window.webContents

  contents.on('console-message', (_event, ...args: unknown[]) => {
    // Electron >= 36 passes a details object; older versions pass positional args.
    const first = args[0] as {
      level?: string
      message?: string
      lineNumber?: number
      sourceId?: string
    }
    if (first && typeof first === 'object' && 'message' in first) {
      console.log(
        `[${label}] ${first.level ?? 'log'}: ${first.message} (${first.sourceId}:${first.lineNumber})`
      )
      return
    }
    const [level, message, line, source] = args as [number, string, number, string]
    console.log(`[${label}] level ${level}: ${message} (${source}:${line})`)
  })

  contents.on('preload-error', (_event, path, error) => {
    console.error(`[${label}] preload error in ${path}:`, error)
  })

  contents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[${label}] did-fail-load ${code} ${description} ${url}`)
  })

  contents.on('render-process-gone', (_event, details) => {
    console.error(`[${label}] render process gone:`, details)
  })
}
