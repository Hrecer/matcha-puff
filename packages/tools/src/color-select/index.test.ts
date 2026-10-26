import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'color-select', caller: 'ui' })

const run = (value: string) => {
  const result = execute({ value }, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('color-select', () => {
  it('纯红：HSL 与 CMYK 换算正确', () => {
    const data = run('#FF0000')
    expect(data.hsl).toEqual({ h: 0, s: 100, l: 50 })
    expect(data.cmyk).toEqual({ c: 0, m: 100, y: 100, k: 0 })
    expect(data.rgbText).toBe('rgb(255, 0, 0)')
  })

  it('三位缩写能展开', () => {
    expect(run('#fff').hex6).toBe('#FFFFFF')
    expect(run('fff').rgbText).toBe('rgb(255, 255, 255)')
  })

  it('rgb() 与 hsl() 都能解析', () => {
    expect(run('rgb(18, 52, 86)').hex6).toBe('#123456')
    expect(run('hsl(0, 100%, 50%)').hex6).toBe('#FF0000')
  })

  it('带透明度的十六进制保留 alpha', () => {
    expect(run('#ff000080').hex).toBe('#FF000080')
    expect(run('#ff000080').rgb.a).toBeCloseTo(0.5, 1)
  })

  it('黑白对比度符合 WCAG', () => {
    expect(run('#000000').contrastOnWhite).toBe(21)
    expect(run('#FFFFFF').contrastOnBlack).toBe(21)
    expect(run('#808080').isLight).toBe(false)
  })

  it('认不出的颜色报 INVALID_INPUT', () => {
    const result = execute({ value: '不是颜色' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })
})
