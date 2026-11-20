import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { log } from './log'

/** Give the app a few seconds to finish booting before the silent check. */
const STARTUP_CHECK_DELAY_MS = 5000

let initialized = false

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Auto-update through the GitHub provider declared in `electron-builder.yml`.
 * Installed builds check once shortly after launch and download in the
 * background; the restart prompt appears when the download is complete.
 * Development builds never contact the network, but the tray command still
 * explains why.
 */
export function initializeUpdates(): void {
  if (initialized) return
  initialized = true

  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => log.info('[openpen-anno] checking for updates'))
  autoUpdater.on('update-available', (info) =>
    log.info('[openpen-anno] update available', info.version)
  )
  autoUpdater.on('update-not-available', () => log.info('[openpen-anno] already up to date'))
  autoUpdater.on('error', (error) => log.error('[openpen-anno] auto-update failed', error))

  autoUpdater.on('update-downloaded', (info) => {
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: `OpenPen Anno ${info.version} has been downloaded.`,
        detail: 'Restart now to finish installing it, or it installs when the app quits.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })

  if (app.isPackaged) {
    setTimeout(() => {
      void autoUpdater
        .checkForUpdates()
        .catch((error) => log.error('[openpen-anno] startup update check failed', error))
    }, STARTUP_CHECK_DELAY_MS)
  }
}

/** Tray command. Manual checks explain their result instead of failing silently. */
export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Check for updates',
      message: 'Update checks are only available in an installed build.',
      detail: `This development copy is version ${app.getVersion()}.`,
      buttons: ['OK'],
      noLink: true
    })
    return
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo.version === app.getVersion()) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Check for updates',
        message: 'You are up to date.',
        detail: `OpenPen Anno ${app.getVersion()} is the latest version.`,
        buttons: ['OK'],
        noLink: true
      })
    }
  } catch (error) {
    log.error('[openpen-anno] manual update check failed', error)
    await dialog.showMessageBox({
      type: 'error',
      title: 'Check for updates',
      message: 'Could not check for updates.',
      detail: errorMessage(error),
      buttons: ['OK'],
      noLink: true
    })
  }
}
