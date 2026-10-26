import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'screencheck', caller: 'ui' })

describe('screencheck', () => {
  it('返回调色板的 10 个测试色', () => {
    const result = execute({}, context)
    if (!result.ok) throw new Error(result.error.message)
    const colors = result.data.colors
    expect(colors).toHaveLength(10)
    const hexes = colors.map((color) => color.hex)
    expect(hexes).toContain('#ffffff')
    expect(hexes).toContain('#000000')
    expect(hexes).toContain('#ff0000')
    expect(hexes).toContain('#00ff00')
    expect(hexes).toContain('#ffff00')
    expect(hexes).toContain('#ff00ff')
    expect(hexes).toContain('#00ffff')
    expect(result.data.note).toContain('ESC')
    expect(result.data.note).toContain('全屏')
  })
})
