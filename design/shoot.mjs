// Renders Pixel Town's key screens for the design-loop critics.
// Usage: node design/shoot.mjs <outDir>
// Reuses a dev server on :5199 if one is running, otherwise starts (and stops) its own.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const out = process.argv[2]
if (!out) throw new Error('usage: node design/shoot.mjs <outDir>')
mkdirSync(out, { recursive: true })
const BASE = 'http://localhost:5199'

const alreadyUp = await fetch(BASE).then(() => true, () => false)
const server = alreadyUp
  ? null
  : await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { port: 5199, strictPort: true } })
if (server) await server.listen()
const T = 32
const tp = (page, tx, ty) => page.evaluate(([x, y]) => window.__pixelTownTeleport(x, y), [tx * T + 16, ty * T + 16])

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const a = await ctx.newPage()
const b = await ctx.newPage()

async function enter(page, name, avatar, shootLobby) {
  await page.goto(`${BASE}/?local=1&fresh=1`)
  await page.evaluate(() => document.fonts.ready)
  await page.getByLabel('Your name').fill(name)
  await page.getByText(avatar, { exact: true }).click()
  if (shootLobby) {
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${out}/lobby-desktop.png` })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${out}/lobby-mobile.png`, fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
  }
  await page.getByRole('button', { name: /enter town/i }).click()
  await page.getByRole('img', { name: /pixel town map/i }).waitFor()
}

await enter(a, 'Ana', 'Moth', true)
await enter(b, 'Bo', 'Fox', false)

await b.getByPlaceholder('Whisper to Ana').waitFor()
await b.getByPlaceholder('Whisper to Ana').pressSequentially('hey ana! love the lanterns')
await b.getByRole('button', { name: 'Send', exact: true }).click()
await a.getByPlaceholder('Whisper to Bo').fill('right?? meet me at the café')
await a.getByRole('button', { name: 'Send', exact: true }).click()
await b.getByPlaceholder('Whisper to Ana').pressSequentially('omw')
await a.getByText('Bo is typing…').waitFor()
await a.waitForTimeout(300)
await a.screenshot({ path: `${out}/town-whisper.png` })

await tp(a, 4, 3)
await tp(b, 6, 3)
await b.getByPlaceholder('Message Lantern Café').fill('coffee anyone?')
await b.getByRole('button', { name: 'Send', exact: true }).click()
await a.getByText('coffee anyone?').waitFor()
await a.getByRole('img', { name: /pixel town map/i }).click()
await a.keyboard.press('Digit4')
await a.waitForTimeout(400)
await a.screenshot({ path: `${out}/town-room.png` })

await tp(a, 22, 9)
await tp(b, 12, 12)
await a.getByRole('heading', { name: /go for a wander/i }).waitFor()
await a.waitForTimeout(600)
await a.screenshot({ path: `${out}/town-wander.png` })

await a.setViewportSize({ width: 375, height: 812 })
await a.waitForTimeout(400)
await a.screenshot({ path: `${out}/town-mobile.png`, fullPage: true })

await browser.close()
if (server) await server.close()
console.log('rendered to', out)
