import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'text2image', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('text2image', () => {
  it('生成 SVG data URL 与尺寸', () => {
    const data = run({ text: '抹茶泡芙', fontSize: 18, align: 'left' })
    expect(data.dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(data.width).toBe(420)
    expect(data.height).toBeGreaterThan(80)
    const svg = decodeURIComponent(data.dataUrl.split(',')[1] ?? '')
    expect(svg).toContain('<text')
    expect(svg).toContain('抹茶泡芙')
  })

  it('长文本会自动换行，高度增加', () => {
    const short = run({ text: '短句', fontSize: 18, align: 'left' })
    const long = run({ text: '这是一段很长的文字，用来验证自动换行之后图片高度会随行数增加。'.repeat(3), fontSize: 18, align: 'left' })
    expect(long.height).toBeGreaterThan(short.height)
  })

  it('居中对齐使用 middle 锚点', () => {
    const data = run({ text: '居中', fontSize: 20, align: 'center' })
    const svg = decodeURIComponent(data.dataUrl.split(',')[1] ?? '')
    expect(svg).toContain('text-anchor="middle"')
  })

  it('XML 特殊字符被转义', () => {
    const data = run({ text: '<b>&"', fontSize: 18, align: 'left' })
    const svg = decodeURIComponent(data.dataUrl.split(',')[1] ?? '')
    expect(svg).toContain('&lt;b&gt;&amp;&quot;')
  })
})
