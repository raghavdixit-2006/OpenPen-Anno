import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const TOOLBAR_WIDTH = 860
const TOOLBAR_HEIGHT = 82
const BOTTOM_MARGIN = 20

let toolbar: BrowserWindow | null = null

export function getToolbarWindow(): BrowserWindow | null {
  return toolbar
}

/**
 * Both windows are topmost at the `screen-saver` level, so whichever was
 * raised last wins. The overlay must stay below the toolbar or it would
 * swallow clicks on the controls while drawing.
 */
export function raiseToolbar(): void {
  if (toolbar && !toolbar.isDestroyed()) toolbar.moveTop()
}

function loadToolbar(window: BrowserWindow): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/toolbar/index.html`)
  } else {
    window.loadFile(join(__dirname, '../renderer/toolbar/index.html'))
  }
}

/**
 * The toolbar is its own always-on-top window. Because it never sets
 * ignoreMouseEvents, it stays clickable while the overlay is in passthrough;
 * the overlay ignores the pointer and the click lands on this window instead.
 */
export function createToolbarWindow(): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workArea
  const x = workArea.x + Math.round((workArea.width - TOOLBAR_WIDTH) / 2)
  const y = workArea.y + workArea.height - TOOLBAR_HEIGHT - BOTTOM_MARGIN

  toolbar = new BrowserWindow({
    x,
    y,
    width: TOOLBAR_WIDTH,
    height: TOOLBAR_HEIGHT,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false
    }
  })

  toolbar.setMenu(null)
  toolbar.setAlwaysOnTop(true, 'screen-saver')
  toolbar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  toolbar.once('ready-to-show', () => {
    toolbar?.showInactive()
    // Both windows sit at the same topmost level; whichever was raised last
    // wins, so make sure the toolbar is above the overlay it controls.
    toolbar?.moveTop()
  })

  toolbar.on('closed', () => {
    toolbar = null
  })

  toolbar.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  toolbar.webContents.on('will-navigate', (event) => event.preventDefault())

  loadToolbar(toolbar)
  return toolbar
}
