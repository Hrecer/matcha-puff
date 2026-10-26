import { describe, expect, it, vi } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute, buildSvg, WATERMARK_TEXT } from './execute'

const context = createExecutionContext({ toolId: 'placeholder-image', caller: 'ui' })
const withImage = (transform = vi.fn(async () => 'data:image/png;base64,AAA')) =>
  createExecutionContext({ toolId: 'placeholder-image', caller: 'ui', services: { image: { info: vi.fn(), transform } } })

const run = async (input: Parameters<typeof execute>[0], ctx = context) => {
  const result = await execute(input, ctx)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('placeholder-image', () => {
  it('默认给 SVG data URL', async () => {
    const data = await run({ width: 600, height: 400, background: '#eee', foreground: '#333', text: '抹茶', format: 'svg' })
    expect(data.dataUrl.startsWith('data:image/svg+xml')).toBe(true)
    expect(data.text).toBe('抹茶')
  })

  it('不写文字时显示尺寸', async () => {
    const data = await run({ width: 300, height: 200, background: '#eee', foreground: '#333', text: '', format: 'svg' })
    expect(data.text).toBe('300 × 200')
  })

  it('SVG 里转义特殊字符', () => {
    const svg = buildSvg({ width: 100, height: 100, background: '#eee', foreground: '#333', text: '<a&b>', format: 'svg' })
    expect(svg).toContain('&lt;a&amp;b&gt;')
  })

  it('带水印文案与背景图', () => {
    const svg = buildSvg({
      width: 320,
      height: 180,
      background: '#a7a7a7',
      foreground: '#ffffff',
      text: '',
      backgroundImage: 'data:image/png;base64,AAAA',
      format: 'svg',
    })
    expect(svg).toContain(WATERMARK_TEXT)
    expect(svg).toContain('<image href="data:image/png;base64,AAAA"')
    expect(svg).toContain('320 × 180')
  })

  it('有图像服务时才生成 PNG', async () => {
    const data = await run(
      { width: 100, height: 100, background: '#eee', foreground: '#333', text: 'x', format: 'png' },
      withImage(),
    )
    expect(data.dataUrl).toBe('data:image/png;base64,AAA')
  })

  it('没有图像服务时明确报错，而不是崩溃', async () => {
    const result = await execute(
      { width: 100, height: 100, background: '#eee', foreground: '#333', text: 'x', format: 'png' },
      context,
    )
    expect(result.ok ? '' : result.error.code).toBe('EXECUTION_FAILED')
  })
})
