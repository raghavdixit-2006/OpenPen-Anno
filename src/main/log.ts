import { app } from 'electron'
import log from 'electron-log/main'

/**
 * File logging for both dev and installed builds. electron-log resolves its
 * path from `app.getPath('logs')`, which follows the pinned userData directory,
 * so logs share the `openpen-anno` profile with settings.
 */
export function initializeLogging(): void {
  log.initialize({ preload: false })
  log.transports.file.level = 'info'
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.transports.console.level = app.isPackaged ? 'warn' : 'debug'

  process.on('uncaughtException', (error) => {
    log.error('[openpen-anno] uncaught exception', error)
  })
  process.on('unhandledRejection', (reason) => {
    log.error('[openpen-anno] unhandled rejection', reason)
  })
}

export { log }
