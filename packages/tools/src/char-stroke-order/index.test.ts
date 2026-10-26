import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { strokeOrderOf } from '../shared/cnchar'

const context = createExecutionContext({ toolId: 'char-stroke-order', caller: 'ui' })

const run = (text: string) => {
  const result = execute({ text }, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('char-stroke-order', () => {
  it('「汉」是 5 画：点点提横撇捺', () => {
    const data = run('汉')
    expect(data.chars[0]?.strokes).toBe(5)
    expect(data.chars[0]?.names).toEqual(['点', '点', '提', '横撇', '捺'])
    expect(data.chars[0]?.shapes).toEqual(['丶', '丶', '㇀', '㇇', '㇏'])
  })

  it('「一」只有一横', () => {
    const data = run('一')
    expect(data.chars[0]?.strokes).toBe(1)
    expect(data.chars[0]?.names).toEqual(['横'])
  })

  it('「十」是横、竖', () => {
    expect(run('十').chars[0]?.names).toEqual(['横', '竖'])
  })

  it('多字会逐字列出并汇总笔画', () => {
    const data = run('抹茶')
    expect(data.total).toBe(2)
    expect(data.totalStrokes).toBe(data.chars[0]!.strokes + data.chars[1]!.strokes)
    expect(data.chars.map((item) => item.char)).toEqual(['抹', '茶'])
  })

  it('非汉字被跳过并记录', () => {
    const data = run('汉a1')
    expect(data.total).toBe(1)
    expect(data.skipped).toBe('a1')
  })

  it('名称里不会出现「点2」这种带数字的写法', () => {
    for (const item of run('字我').chars) {
      expect(item.names.every((name) => !/\d/.test(name))).toBe(true)
    }
  })

  it('笔顺名称与笔画数一致', () => {
    const order = strokeOrderOf('永')!
    expect(order.names).toHaveLength(order.strokes)
    expect(order.shapes).toHaveLength(order.strokes)
  })

  it('没有汉字时报错', () => {
    const result = execute({ text: 'abc' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })
})
