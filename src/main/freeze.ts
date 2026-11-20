import { IPC, type FreezeFrame } from '../shared/ipc'
import { activeDisplay } from './display'
import { sendToOverlay } from './overlayWindow'
import { captureDisplay } from './screenCapture'
import { getState, patchState } from './state'

/**
 * Freeze-frame capture. Turning the freeze on switches to drawing mode and
 * grabs the active display at native resolution; the overlay paints the frame
 * under the ink and zooms it with the pointer wheel.
 *
 * The capture is asynchronous, so a quick off/on or an unfreeze while the
 * thumbnail is rendering must not deliver a stale frame.
 */
export async function captureFreezeFrame(): Promise<void> {
  const frame = await captureDisplay(activeDisplay())
  if (!getState().frozen || !frame) return

  const payload: FreezeFrame = { dataUrl: frame.dataUrl }
  sendToOverlay(IPC.freezeFrame, payload)
}

/** One entry point for the toolbar, tray and keyboard shortcut. */
export function setFrozen(frozen: boolean): void {
  if (!frozen) {
    patchState({ frozen: false })
    return
  }

  // Freezing without drawing would show a still image the user cannot annotate.
  patchState({ frozen: true, mode: 'draw' })
  void captureFreezeFrame()
}

export function toggleFrozen(): void {
  setFrozen(!getState().frozen)
}
