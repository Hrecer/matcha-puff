import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'pinyin-convert', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('pinyin-convert', () => {
  it('带声调输出', () => {
    expect(run({ text: '汉字', mode: 'tone', separator: ' ' }).result).toBe('Hàn Zì')
  })

  it('纯小写输出', () => {
    expect(run({ text: '汉字', mode: 'low', separator: '' }).result).toBe('hanzi')
  })

  it('首字母输出', () => {
    expect(run({ text: '重庆', mode: 'first', separator: '' }).result).toBe('CQ')
  })

  it('多音字会列出全部读音', () => {
    const data = run({ text: '行', mode: 'low', separator: '' })
    expect(data.polyCount).toBe(1)
    expect(data.chars[0]?.poly.length).toBeGreaterThan(1)
  })

  it('标点与数字原样保留', () => {
    const data = run({ text: '好, 2026', mode: 'low', separator: '' })
    expect(data.result).toContain(',')
    expect(data.result).toContain('2026')
  })

  it('自定义分隔符', () => {
    expect(run({ text: '汉字', mode: 'low', separator: '-' }).result).toBe('han-zi')
  })
})

describe('pinyin-convert 单字读音', () => {
  it('单字沿用强制读音', () => {
    expect(run({ text: '乐', mode: 'tone', separator: '' }).result).toBe('Yuè')
    expect(run({ text: '脚', mode: 'tone', separator: '' }).result).toBe('Jiǎo')
  })

  it('去除空白开关生效', () => {
    expect(run({ text: '汉字', mode: 'tone', separator: ' ', stripSpaces: true }).result).toBe('HànZì')
  })
})
