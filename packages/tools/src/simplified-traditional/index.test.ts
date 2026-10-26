import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'simplified-traditional', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('simplified-traditional', () => {
  it('简转繁', () => {
    const data = run({ text: '汉字转换测试', direction: 's2t' })
    expect(data.result).toBe('漢字轉換測試')
    expect(data.changed).toBe(5)
  })

  it('繁转简', () => {
    expect(run({ text: '漢字轉換測試', direction: 't2s' }).result).toBe('汉字转换测试')
  })

  it('本来就是目标字形时不报改动', () => {
    expect(run({ text: '汉字', direction: 's2t' }).changed).toBeGreaterThan(0)
    expect(run({ text: 'abc 123', direction: 's2t' }).changed).toBe(0)
  })

  it('火星文转换有结果', () => {
    expect(run({ text: '汉字', direction: 'spark' }).result.length).toBeGreaterThan(0)
  })

  it('给出逐字对照', () => {
    const data = run({ text: '汉', direction: 's2t' })
    expect(data.diffs[0]).toEqual({ from: '汉', to: '漢' })
  })
})
