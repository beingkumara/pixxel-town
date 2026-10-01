import { expect, test, type Page } from '@playwright/test'

/*
 * Runs against the offline BroadcastChannel transport (?local=1) so it needs
 * no CometChat credentials. Two pages in one browser context share the channel.
 */

const TILE = 32
const tile = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 })
const CAFE = tile(4, 3)
const FAR_CORNER = tile(27, 16)

async function enterTown(page: Page, name: string, avatarName: string) {
  await page.goto('/?local=1&fresh=1')
  await page.getByLabel('Your name').fill(name)
  await page.getByText(avatarName, { exact: true }).click()
  await page.getByRole('button', { name: /enter town/i }).click()
  await expect(page.getByRole('img', { name: /pixel town map/i })).toBeVisible()
}

async function teleport(page: Page, pos: { x: number; y: number }) {
  await page.evaluate(({ x, y }) => {
    const w = window as Window & { __pixelTownTeleport?: (x: number, y: number) => void }
    if (!w.__pixelTownTeleport) throw new Error('teleport hook missing (dev build only)')
    w.__pixelTownTeleport(x, y)
  }, pos)
}

test('lobby validates the name', async ({ page }) => {
  await page.goto('/?local=1&fresh=1')
  await page.getByRole('button', { name: /enter town/i }).click()
  await expect(page.getByRole('alert')).toHaveText('Pick a name first.')
})

test('proximity DM, typing indicator, rooms and walking away', async ({ context }) => {
  const ana = await context.newPage()
  const bo = await context.newPage()
  await enterTown(ana, 'Ana', 'Moth')
  await enterTown(bo, 'Bo', 'Fox')

  // Both spawn in the square, so they are in whisper range.
  const anaDm = ana.getByRole('region', { name: /whisper · proximity dm: bo/i })
  const boDm = bo.getByRole('region', { name: /whisper · proximity dm: ana/i })
  await expect(anaDm).toBeVisible()
  await expect(boDm).toBeVisible()

  // Typing shows up on the other side.
  await boDm.getByPlaceholder('Whisper to Ana').pressSequentially('hey')
  await expect(anaDm.getByText('Bo is typing…')).toBeVisible()

  await boDm.getByRole('button', { name: 'Send' }).click()
  await expect(anaDm.getByText('hey', { exact: true })).toBeVisible()
  await expect(anaDm.getByText('Bo is typing…')).toHaveCount(0)

  // Step into the café: room chat opens, calls are disabled in local mode.
  await teleport(ana, CAFE)
  await teleport(bo, { x: CAFE.x + TILE, y: CAFE.y })
  const anaRoom = ana.getByRole('region', { name: /room chat: lantern café/i })
  await expect(anaRoom).toBeVisible()
  await expect(ana.getByRole('banner').getByText('Lantern Café')).toBeVisible()
  await expect(anaRoom.getByRole('button', { name: /join call/i })).toBeDisabled()

  const boRoom = bo.getByRole('region', { name: /room chat: lantern café/i })
  await boRoom.getByPlaceholder('Message Lantern Café').fill('coffee anyone?')
  await boRoom.getByRole('button', { name: 'Send' }).click()
  await expect(anaRoom.getByText('coffee anyone?')).toBeVisible()

  // Walk away: both the room and the whisper close.
  await teleport(ana, FAR_CORNER)
  await expect(anaRoom).toHaveCount(0)
  await expect(anaDm).toHaveCount(0)
  await expect(ana.getByRole('heading', { name: 'Go for a wander' })).toBeVisible()
  await expect(ana.getByText('Bo', { exact: true })).toBeVisible()
})

test('report a message, block a player, then unblock them', async ({ context }) => {
  const ana = await context.newPage()
  const bo = await context.newPage()
  await enterTown(ana, 'Ana', 'Moth')
  await enterTown(bo, 'Bo', 'Fox')

  const anaDm = ana.getByRole('region', { name: /whisper · proximity dm: bo/i })
  const boDm = bo.getByRole('region', { name: /whisper · proximity dm: ana/i })
  await expect(anaDm).toBeVisible()
  await boDm.getByPlaceholder('Whisper to Ana').fill('buy cheap gold at spam.example')
  await boDm.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(anaDm.getByText('buy cheap gold at spam.example')).toBeVisible()

  // Report: pick a reason from the menu; the message is marked as reported.
  await anaDm.getByRole('button', { name: 'Report message from Bo' }).click()
  await anaDm.getByRole('group', { name: /why are you reporting/i }).getByRole('button', { name: 'Spam or misleading' }).click()
  await expect(anaDm.getByText(/· reported/)).toBeVisible()
  await expect(ana.getByRole('status')).toContainText('sent to the moderators')

  // Block: the whisper closes, Bo vanishes from the town and his room messages stay hidden.
  await anaDm.getByRole('button', { name: 'Block' }).click()
  await expect(anaDm).toHaveCount(0)
  await expect(ana.getByRole('status')).toContainText('Bo is blocked')
  await expect(ana.getByRole('heading', { name: /go for a wander/i })).toBeVisible()
  await expect(ana.getByText('Blocked · 1')).toBeVisible()
  await expect(ana.getByText('Townsfolk online · 0')).toBeVisible()

  await teleport(ana, CAFE)
  await teleport(bo, { x: CAFE.x + TILE, y: CAFE.y })
  const boRoom = bo.getByRole('region', { name: /room chat: lantern café/i })
  await boRoom.getByPlaceholder('Message Lantern Café').fill('can you hear me?')
  await boRoom.getByRole('button', { name: 'Send', exact: true }).click()
  const anaRoom = ana.getByRole('region', { name: /room chat: lantern café/i })
  await expect(anaRoom).toBeVisible()
  await expect(boRoom.getByText('can you hear me?')).toBeVisible()
  await expect(anaRoom.getByText('can you hear me?')).toHaveCount(0)

  // Unblock from the wander panel.
  await teleport(ana, FAR_CORNER)
  await ana.getByRole('button', { name: 'Unblock' }).click()
  await expect(ana.getByText('Blocked · 1')).toHaveCount(0)
})
