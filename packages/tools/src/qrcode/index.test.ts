import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { inputSchema } from './schema'

const context = createExecutionContext({ toolId: 'qrcode', caller: 'ui' })

const make = (input: Record<string, unknown>) => inputSchema.parse(input)

describe('qrcode', () => {
  it('生成 SVG 二维码', async () => {
    const result = await execute(make({ text: 'https://example.com', level: 'M', size: 320 }), context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.svg.trimStart().startsWith('<svg')).toBe(true)
    expect(result.data.svg).toContain('viewBox')
    expect(result.data.size).toBe(320)
    expect(result.data.level).toBe('M')
  })

  it('不同容错级别都能出码', async () => {
    for (const level of ['L', 'Q', 'H'] as const) {
      const result = await execute(make({ text: '抹茶泡芙', level, size: 256 }), context)
      expect(result.ok).toBe(true)
    }
  })

  it('超出二维码容量的内容返回失败', async () => {
    const result = await execute(make({ text: 'x'.repeat(1900), level: 'H', size: 320 }), context)
    expect(result.ok).toBe(false)
  })

  it('默认是方形点与方形角', async () => {
    const result = await execute(make({ text: 'matcha' }), context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.dotType).toBe('square')
    expect(result.data.cornerType).toBe('square')
    expect(result.data.svg).toContain('<rect')
    expect(result.data.svg).toContain('width="1" height="1"')
    expect(result.data.svg).toContain('<path fill-rule="evenodd"')
  })

  it('圆点与圆角定位角会生成圆形路径', async () => {
    const result = await execute(
      make({ text: 'matcha', dotType: 'dots', cornerType: 'dot' }),
      context,
    )
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.svg).toContain('<circle')
    expect(result.data.svg).toContain('A3.5 3.5')
  })

  it('前景色与背景色写进 SVG', async () => {
    const result = await execute(
      make({ text: 'matcha', foreground: '#123456', background: '#fedcba' }),
      context,
    )
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.svg).toContain('fill="#123456"')
    expect(result.data.svg).toContain('fill="#fedcba"')
    expect(result.data.foreground).toBe('#123456')
  })

  it('自定义点形与尺寸', async () => {
    const result = await execute(
      make({ text: 'matcha', dotType: 'classy', cornerType: 'extra-rounded', size: 512 }),
      context,
    )
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.dotType).toBe('classy')
    expect(result.data.cornerType).toBe('extra-rounded')
    expect(result.data.svg).toContain('width="512"')
  })

  it('非法颜色被 schema 拦下', () => {
    expect(inputSchema.safeParse({ text: 'a', foreground: 'red' }).success).toBe(false)
  })
})
