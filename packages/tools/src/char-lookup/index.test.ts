import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'char-lookup', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('char-lookup', () => {
  it('一笔画只有「一」和「乙」', () => {
    const data = run({ strokes: 1 })
    expect(data.count).toBe(2)
    expect(data.chars.join('')).toContain('一')
  })

  it('常用笔画能查出较多字', () => {
    expect(run({ strokes: 8 }).count).toBeGreaterThan(50)
  })

  it('可同时查单字详情', () => {
    const data = run({ strokes: 5, char: '汉' })
    expect(data.detail?.strokes).toBe(5)
    expect(data.detail?.pinyin).toBe('Hàn')
  })

  it('非汉字会报错', () => {
    const result = execute({ strokes: 5, char: 'a' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })
})
