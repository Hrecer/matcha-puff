import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'text-length', caller: 'ui' })

describe('text-length', () => {
  it('空文本', () => {
    const result = execute({ text: '' }, context)
    expect(result.ok && result.data).toEqual({
      chars: 0,
      codePoints: 0,
      bytes: 0,
      lines: 0,
      words: 0,
      chineseChars: 0,
    })
  })

  it('中文与换行', () => {
    const result = execute({ text: '抹茶\npuff' }, context)
    expect(result.ok && result.data).toMatchObject({
      chars: 7,
      bytes: 11,
      lines: 2,
      words: 2,
      chineseChars: 2,
    })
  })

  it('emoji 按码点计数', () => {
    const result = execute({ text: '😀' }, context)
    expect(result.ok && result.data.chars).toBe(2)
    expect(result.ok && result.data.codePoints).toBe(1)
    expect(result.ok && result.data.bytes).toBe(4)
  })
})
