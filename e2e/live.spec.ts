import { expect, test, type Browser, type Page } from '@playwright/test'

// Opt-in smoke test against the REAL CometChat app (needs .env.local): whisper, room chat and a
// shared video call via Chromium's fake camera/mic. Run with `npm run e2e:live`.
// Each run creates 2 CometChat users, which count toward the free tier's monthly active users.
test.setTimeout(150_000)
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
})

const RUN = Date.now().toString(36)
const ROOM_MSG = `room check ${RUN}`
const DM_MSG = `hello ${RUN}`

type TP = Window & { __pixelTownTeleport: (x: number, y: number) => void }

async function player(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`[${name}] pageerror ${e.message.slice(0, 200)}`))
  await page.goto('/?fresh=1')
  await expect(page.getByText('● Live: CometChat realtime')).toBeVisible()
  await page.getByLabel('Your name').fill(name)
  await page.getByRole('button', { name: /enter town/i }).click()
  const alert = page.getByRole('alert')
  const map = page.getByRole('img', { name: /pixel town map/i })
  await expect(map.or(alert)).toBeVisible({ timeout: 30_000 })
  if (await alert.isVisible()) throw new Error(`${name}: ${await alert.textContent()}`)
  return page
}

test('live CometChat: whisper, room chat and a shared video call', async ({ browser }) => {
  const a = await player(browser, 'LiveAna')
  const b = await player(browser, 'LiveBo')

  const aDm = a.getByRole('region', { name: /proximity dm: livebo/i })
  const bDm = b.getByRole('region', { name: /proximity dm: liveana/i })
  await expect(aDm).toBeVisible({ timeout: 20_000 })
  await expect(bDm).toBeVisible({ timeout: 20_000 })
  await bDm.getByPlaceholder('Whisper to LiveAna').pressSequentially(DM_MSG)
  await expect(aDm.getByText('LiveBo is typing…')).toBeVisible({ timeout: 15_000 })
  await bDm.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(aDm.getByText(DM_MSG)).toBeVisible({ timeout: 15_000 })

  await a.evaluate(() => (window as unknown as TP).__pixelTownTeleport(4 * 32 + 16, 3 * 32 + 16))
  await b.evaluate(() => (window as unknown as TP).__pixelTownTeleport(5 * 32 + 16, 3 * 32 + 16))
  const aRoom = a.getByRole('region', { name: /room chat: lantern café/i })
  const bRoom = b.getByRole('region', { name: /room chat: lantern café/i })
  await bRoom.getByPlaceholder('Message Lantern Café').fill(ROOM_MSG, { timeout: 20_000 })
  await bRoom.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(aRoom.getByText(ROOM_MSG)).toBeVisible({ timeout: 15_000 })

  // Both join the café's shared call.
  await aRoom.getByRole('button', { name: /join call/i }).click()
  await bRoom.getByRole('button', { name: /join call/i }).click()
  for (const [p, room] of [[a, aRoom], [b, bRoom]] as const) {
    const live = room.getByText(/LIVE in Lantern Café/)
    const error = room.getByRole('alert')
    await expect(live.or(error)).toBeVisible({ timeout: 45_000 })
    if (await error.isVisible()) throw new Error(`call failed: ${await error.textContent()}`)
    await expect(p.locator('.call__stage video').first()).toBeVisible({ timeout: 30_000 })
  }
  await a.waitForTimeout(4000)

  // Hang up with the button, then rejoin: the SDK must tear down cleanly both times.
  await bRoom.getByRole('button', { name: /hang up/i }).click()
  await expect(bRoom.getByRole('button', { name: /join call/i })).toBeEnabled({ timeout: 10_000 })
  await bRoom.getByRole('button', { name: /join call/i }).click()
  await expect(bRoom.getByText(/LIVE in Lantern Café/)).toBeVisible({ timeout: 45_000 })

  // Walking out of the room hangs up.
  await a.evaluate(() => (window as unknown as TP).__pixelTownTeleport(27 * 32 + 16, 16 * 32 + 16))
  await expect(aRoom).toHaveCount(0, { timeout: 10_000 })
  await expect(a.locator('.call__stage video')).toHaveCount(0)
})
