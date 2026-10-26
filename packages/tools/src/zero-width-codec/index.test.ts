import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute, decodeZeroWidth, encodeZeroWidth } from './execute'

const context = createExecutionContext({ toolId: 'zero-width-codec', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('zero-width-codec', () => {
  it('编码后只剩零宽字符，看不见原文', () => {
    const data = run({ text: '抹茶', mode: 'encode' })
    expect(data.payload.length).toBe(48) // 2 个汉字 6 字节 → 48 位
    expect(data.output).not.toContain('抹')
    expect([...data.payload].every((char) => char === '\u200B' || char === '\u200C')).toBe(true)
  })

  it('英文与中文都能往返', () => {
    for (const text of ['matcha puff', '抹茶泡芙', 'a抹1混排🧋']) {
      expect(decodeZeroWidth(encodeZeroWidth(text)).plain).toBe(text)
    }
  })

  it('解码能从混排文本里挑出密文', () => {
    const hidden = encodeZeroWidth('秘密')
    const data = run({ text: `你看不见我${hidden}对吧`, mode: 'decode' })
    expect(data.plain).toBe('秘密')
    expect(data.zeroWidthCount).toBe(48)
    expect(data.visible).toBeGreaterThan(0)
  })

  it('夹载体文字后仍能解出', () => {
    const data = run({ text: '抹茶', mode: 'encode', carrier: '今晚八点老地方' })
    expect(data.output).toContain('今晚')
    expect(run({ text: data.output, mode: 'decode' }).plain).toBe('抹茶')
  })

  it('没有零宽字符时明确报错', () => {
    const result = execute({ text: '普通文本', mode: 'decode' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
    expect(result.ok ? '' : result.error.message).toContain('没有藏东西')
  })

  it('位数不足 8 的倍数会报不完整', () => {
    // 48 位截掉 12 位 → 36 位，凑不满整字节
    const broken = encodeZeroWidth('抹茶').slice(0, 36)
    const result = execute({ text: broken, mode: 'decode' }, context)
    expect(result.ok ? '' : result.error.message).toContain('不完整')
  })

  it('字节数够但不是合法 UTF-8 会报错', () => {
    // 40 位是 5 个字节，但 5 个字节解释不了「抹茶」的前半段
    const broken = encodeZeroWidth('抹茶').slice(0, 40)
    const result = execute({ text: broken, mode: 'decode' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })
})
