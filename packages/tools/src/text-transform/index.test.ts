import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'text-transform', caller: 'ui' })

const dedupe = {
  mode: 'dedupe',
  trimLines: false,
  keepEmptyLines: true,
  search: '',
  replacement: '',
  useRegex: false,
  caseSensitive: true,
} as const

describe('text-transform', () => {
  it('去掉重复行并保留原顺序', () => {
    const result = execute({ ...dedupe, text: 'a\nb\na\nc' }, context)
    expect(result.ok && result.data.text).toBe('a\nb\nc')
    expect(result.ok && result.data.removedLines).toBe(1)
  })

  it('trimLines 忽略首尾空白', () => {
    const result = execute({ ...dedupe, text: 'a\n a \nb', trimLines: true }, context)
    expect(result.ok && result.data.removedLines).toBe(1)
  })

  it('keepEmptyLines=false 丢弃空行', () => {
    const result = execute({ ...dedupe, text: 'a\n\nb', keepEmptyLines: false }, context)
    expect(result.ok && result.data.text).toBe('a\nb')
  })

  it('字面替换并统计次数', () => {
    const result = execute(
      { ...dedupe, text: 'a.b.c', mode: 'replace', search: '.', replacement: '-' },
      context,
    )
    expect(result.ok && result.data.text).toBe('a-b-c')
    expect(result.ok && result.data.replacements).toBe(2)
  })

  it('正则替换', () => {
    const result = execute(
      { ...dedupe, text: 'a1b22c', mode: 'replace', search: '\\d+', replacement: '#', useRegex: true },
      context,
    )
    expect(result.ok && result.data.text).toBe('a#b#c')
    expect(result.ok && result.data.replacements).toBe(2)
  })

  it('不区分大小写', () => {
    const result = execute(
      { ...dedupe, text: 'Ab ab AB', mode: 'replace', search: 'ab', replacement: 'x', caseSensitive: false },
      context,
    )
    expect(result.ok && result.data.text).toBe('x x x')
  })

  it('$& 代表匹配原文', () => {
    const result = execute(
      { ...dedupe, text: 'ab', mode: 'replace', search: 'a', replacement: '[$&]' },
      context,
    )
    expect(result.ok && result.data.text).toBe('[a]b')
  })

  it('无效正则返回 INVALID_INPUT', () => {
    const result = execute(
      { ...dedupe, text: 'a', mode: 'replace', search: '(', replacement: 'x', useRegex: true },
      context,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_INPUT')
  })

  it('空输入不报错', () => {
    const result = execute({ ...dedupe, text: '' }, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.inputLines).toBe(0)
  })
})
