import { expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  closePopovers,
  launchApp,
  pageByTitle,
  readState,
  toolbarBounds,
  type LaunchedApp
} from './helpers'

let launched: LaunchedApp
let profile = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  profile = await mkdtemp(join(tmpdir(), 'openpen-anno-app-'))
  launched = await launchApp(profile)
})

test.afterAll(async () => {
  await launched?.app.close()
  if (profile) await rm(profile, { recursive: true, force: true })
})

test('boots into passthrough with both real windows', async () => {
  const state = await readState(launched.overlay)

  expect(state.mode).toBe('passthrough')
  expect(state.frozen).toBe(false)
  await expect(launched.overlay).toHaveTitle('OpenPen Anno Overlay')
  await expect(launched.toolbar).toHaveTitle('OpenPen Anno Toolbar')
  await expect(
    launched.toolbar.getByRole('button', { name: 'Pass-through, start drawing' })
  ).toBeVisible()
})

test('mode toggle is authoritative in main and reaches the overlay', async () => {
  await launched.toolbar.getByRole('button', { name: 'Pass-through, start drawing' }).click()

  await expect.poll(async () => (await readState(launched.overlay)).mode).toBe('draw')
  await expect(
    launched.toolbar.getByRole('button', { name: 'Drawing, switch to pass-through' })
  ).toBeVisible()
})

test('tool and eraser mode selections survive the IPC round trip', async () => {
  await launched.toolbar.getByRole('button', { name: 'Eraser', exact: true }).click()
  const popover = await pageByTitle(launched.app, 'OpenPen Anno Tool Options')
  await popover.getByRole('button', { name: 'Erase individual pixels' }).click()

  await expect
    .poll(async () => {
      const state = await readState(launched.toolbar)
      return { tool: state.tool, eraserMode: state.eraserMode }
    })
    .toEqual({ tool: 'eraser', eraserMode: 'pixel' })

  await closePopovers(launched.app)
})

test('shape picker pops out and selects a shape tool', async () => {
  await launched.toolbar.getByRole('button', { name: 'Shapes' }).click()
  const popover = await pageByTitle(launched.app, 'OpenPen Anno Tool Options')

  await expect(popover.getByRole('button', { name: 'Rectangle' })).toBeVisible()
  await popover.getByRole('button', { name: 'Rectangle' }).click()

  await expect.poll(async () => (await readState(launched.toolbar)).tool).toBe('rect')
  await closePopovers(launched.app)
})

test('collapse shrinks the toolbar window and the tab restores it', async () => {
  await launched.toolbar.getByRole('button', { name: 'Collapse toolbar' }).click()
  await expect.poll(async () => (await toolbarBounds(launched.app))?.width).toBe(64)

  // The tucked tab is mostly behind the screen edge; a direct DOM click avoids
  // Playwright's actionability check on a deliberately clipped element.
  await launched.toolbar.getByRole('button', { name: 'Expand toolbar' }).dispatchEvent('click')
  await expect.poll(async () => (await toolbarBounds(launched.app))?.width).toBe(800)
})

test('freeze switches to drawing and unfreezes without leaving it', async () => {
  await launched.toolbar.getByRole('button', { name: 'Freeze frame' }).click()

  await expect.poll(async () => (await readState(launched.overlay)).frozen).toBe(true)
  const frozenState = await readState(launched.overlay)
  expect(frozenState.mode).toBe('draw')

  await launched.toolbar.getByRole('button', { name: 'Frozen frame, click to resume' }).click()
  await expect.poll(async () => (await readState(launched.overlay)).frozen).toBe(false)
  const resumedState = await readState(launched.overlay)
  expect(resumedState.mode).toBe('draw')
})
