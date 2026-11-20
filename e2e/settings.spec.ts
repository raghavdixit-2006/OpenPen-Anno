import { expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closePopovers, launchApp, pageByTitle, readState } from './helpers'

test('persists toolbar preferences across launches but never the mode', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'openpen-anno-settings-'))

  try {
    const first = await launchApp(profile)
    await first.toolbar.getByRole('button', { name: 'Pass-through, start drawing' }).click()

    // Colour and size live in the floating options panel; the pen is the
    // starting tool, so clicking it only opens the panel.
    await first.toolbar.getByRole('button', { name: 'Pen', exact: true }).click()
    const popover = await pageByTitle(first.app, 'OpenPen Anno Tool Options')
    await popover.getByRole('button', { name: 'Colour #0a84ff' }).click()

    await expect.poll(async () => (await readState(first.overlay)).color).toBe('#0a84ff')

    // Let the 250 ms debounced write land before the quit flush is needed.
    await new Promise((resolve) => setTimeout(resolve, 400))
    await closePopovers(first.app)
    await first.app.close()

    const second = await launchApp(profile)
    const state = await readState(second.overlay)
    expect(state.color).toBe('#0a84ff')
    expect(state.mode).toBe('passthrough')
    await second.app.close()
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
})
