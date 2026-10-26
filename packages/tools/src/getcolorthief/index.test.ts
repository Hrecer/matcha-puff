import { describe, expect, it, vi } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { quantize } from './mmcq'
import { inputSchema } from './schema'

type RGB = [number, number, number]

const solidPixels = (color: RGB, count: number): RGB[] => Array.from({ length: count }, () => color)

const makeContext = (pixels: { width: number; height: number; data: Uint8ClampedArray | number[] }) =>
  createExecutionContext({
    toolId: 'getcolorthief',
    caller: 'ui',
    services: {
      image: {
        info: vi.fn(),
        transform: vi.fn(),
        pixels: vi.fn(async () => pixels),
      },
    },
  })

const rgbaOf = (colors: RGB[]): number[] => colors.flatMap(([r, g, b]) => [r, g, b, 255])

describe('mmcq quantize', () => {
  it('单色图返回该色', () => {
    const result = quantize(solidPixels([200, 60, 30], 50), 5)
    expect(result?.palette).toHaveLength(1)
    const [r, g] = result?.palette[0] ?? [0, 0, 0]
    expect(r).toBeGreaterThanOrEqual(196)
    expect(r).toBeLessThanOrEqual(204)
    expect(g).toBeGreaterThanOrEqual(56)
    expect(g).toBeLessThanOrEqual(64)
  })

  it('红蓝两色图分成两格且都能找到', () => {
    const pixels = [...solidPixels([230, 30, 30], 60), ...solidPixels([30, 30, 230], 40)]
    const result = quantize(pixels, 4)
    const palette = result?.palette ?? []
    expect(palette.length).toBeGreaterThanOrEqual(2)
    const hasRed = palette.some(([r, g, b]) => r > 200 && g < 80 && b < 80)
    const hasBlue = palette.some(([r, g, b]) => b > 200 && r < 80 && g < 80)
    expect(hasRed).toBe(true)
    expect(hasBlue).toBe(true)
  })

  it('目标色数夹在 2–260 外返回 null', () => {
    expect(quantize(solidPixels([1, 2, 3], 4), 1)).toBeNull()
    expect(quantize([], 5)).toBeNull()
  })
})

describe('getcolorthief', () => {
  it('默认提取 10 色，仍允许 2–20', () => {
    expect(inputSchema.parse({ dataUrl: 'x' }).colorCount).toBe(10)
    expect(() => inputSchema.parse({ dataUrl: 'x', colorCount: 1 })).toThrow()
    expect(() => inputSchema.parse({ dataUrl: 'x', colorCount: 21 })).toThrow()
  })

  it('主色在前，hex 与 rgb 格式正确', async () => {
    const colors: RGB[] = [...solidPixels([200, 60, 30], 80), ...solidPixels([30, 200, 60], 20)]
    const ctx = makeContext({ width: 10, height: 10, data: rgbaOf(colors) })
    const result = await execute({ dataUrl: 'data:image/png;base64,AAAA', colorCount: 5 }, ctx)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.palette.length).toBeGreaterThanOrEqual(2)
    expect(result.data.dominant.hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(result.data.dominant.rgb).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
    expect(result.data.dominant.r).toBeGreaterThan(180)
    expect(result.data.dominant.g).toBeLessThan(100)
  })

  it('跳过纯白与透明像素', async () => {
    const colors: RGB[] = [
      ...solidPixels([255, 255, 255], 50),
      ...solidPixels([200, 60, 30], 50),
    ]
    const data = [
      ...Array.from({ length: 50 }, () => [255, 255, 255, 255]),
      ...Array.from({ length: 25 }, () => [10, 10, 10, 0]),
      ...Array.from({ length: 50 }, () => [200, 60, 30, 255]),
    ].flat()
    const ctx = makeContext({ width: 10, height: 13, data })
    const result = await execute({ dataUrl: 'data:image/png;base64,AAAA', colorCount: 5 }, ctx)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.dominant.r).toBeGreaterThan(180)
    expect(result.data.dominant.g).toBeLessThan(100)
    expect(colors.length).toBe(100)
  })

  it('宿主没有 pixels 能力时明确报错', async () => {
    const ctx = createExecutionContext({
      toolId: 'getcolorthief',
      caller: 'ui',
      services: { image: { info: vi.fn(), transform: vi.fn() } },
    })
    const result = await execute({ dataUrl: 'data:image/png;base64,AAAA', colorCount: 5 }, ctx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('不支持取色')
  })

  it('全是纯白时报可读错误', async () => {
    const ctx = makeContext({ width: 2, height: 2, data: rgbaOf([[255, 255, 255]] as RGB[]) })
    const result = await execute({ dataUrl: 'data:image/png;base64,AAAA', colorCount: 5 }, ctx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('没有可提取的颜色')
  })
})
