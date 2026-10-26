import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { inputSchema } from './schema'

const context = createExecutionContext({ toolId: 'random-string', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

const base = {
  length: 8,
  count: 5,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: '',
  allowDuplicates: true,
}

describe('random-string', () => {
  it('默认不附加符号且允许重复', () => {
    const parsed = inputSchema.parse({ length: 8, count: 5 })
    expect(parsed.symbols).toBe('')
    expect(parsed.allowDuplicates).toBe(true)
    expect(parsed.uppercase).toBe(true)
    expect(parsed.lowercase).toBe(true)
  })

  it('按长度与数量生成', () => {
    const data = run(base)
    expect(data.items).toHaveLength(5)
    expect(data.items.every((item) => item.length === 8)).toBe(true)
  })

  it('只使用选中的字符集', () => {
    const data = run({ ...base, uppercase: false, lowercase: false, symbols: '@#' })
    expect(data.charset).toBe('0123456789@#')
    expect(data.items.every((item) => /^[0-9@#]+$/.test(item))).toBe(true)
  })

  it('不允许重复时结果互不相同', () => {
    const data = run({ ...base, allowDuplicates: false, count: 20 })
    expect(new Set(data.items).size).toBe(20)
  })

  it('字符集为空时报 INVALID_INPUT', () => {
    const result = execute(
      { ...base, uppercase: false, lowercase: false, digits: false, symbols: '' },
      context,
    )
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })

  it('组合空间不足时报 INVALID_INPUT', () => {
    const result = execute(
      { ...base, uppercase: false, lowercase: false, digits: false, symbols: 'ab', length: 1, count: 5, allowDuplicates: false },
      context,
    )
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })
})
