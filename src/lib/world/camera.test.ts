import { describe, expect, test } from 'vitest'
import { CAMERA_BREAKPOINT, cameraView } from './camera'

const map = { w: 960, h: 576 }

describe('cameraView', () => {
  test('shows the whole map on wide displays', () => {
    expect(cameraView({ x: 100, y: 100 }, { w: 960, h: 576 }, map)).toEqual({ x: 0, y: 0, w: 960, h: 576 })
  })

  test('centres a native-size window on the focus on narrow displays', () => {
    expect(cameraView({ x: 480, y: 288 }, { w: 340, h: 340 }, map)).toEqual({ x: 310, y: 118, w: 340, h: 340 })
  })

  test('clamps the window to the map edges', () => {
    expect(cameraView({ x: 10, y: 570 }, { w: 340, h: 340 }, map)).toEqual({ x: 0, y: 236, w: 340, h: 340 })
  })

  test('falls back to the whole map when the display size is unknown', () => {
    expect(cameraView({ x: 1, y: 1 }, { w: 0, h: 0 }, map)).toEqual({ x: 0, y: 0, w: 960, h: 576 })
  })

  test('switches at the breakpoint', () => {
    expect(cameraView({ x: 1, y: 1 }, { w: CAMERA_BREAKPOINT, h: 300 }, map).w).toBe(960)
  })
})
