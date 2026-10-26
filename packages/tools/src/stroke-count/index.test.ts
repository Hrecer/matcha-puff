import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'stroke-count', caller: 'ui' })

const run = (text: string) => {
  const result = execute({ text }, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('stroke-count', () => {
  it('逐字给笔画并求和', () => {
    const data = run('汉字')
    expect(data.chars).toEqual([
      { char: '汉', strokes: 5 },
      { char: '字', strokes: 6 },
    ])
    expect(data.total).toBe(11)
  })

  it('非汉字被跳过并记录', () => {
    const data = run('汉a字1')
    expect(data.charCount).toBe(2)
    expect(data.skipped).toBe('a1')
  })

  it('标点不算笔画', () => {
    expect(run('你好，世界').charCount).toBe(4)
  })
})
