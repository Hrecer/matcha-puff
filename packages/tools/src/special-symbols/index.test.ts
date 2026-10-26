import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'special-symbols', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('special-symbols', () => {
  it('不带参数时返回全部分组与全部符号', () => {
    const data = run({})
    expect(data.groups).toHaveLength(31)
    expect(data.total).toBe(2059)
  })

  it('按分组筛选', () => {
    const data = run({ group: 'subsupscript' })
    expect(data.groups).toHaveLength(1)
    expect(data.groups[0]?.title).toBe('下标及上标')
  })

  it('按关键词命中符号或分组名', () => {
    expect(run({ keyword: '→' }).total).toBeGreaterThan(0)
    expect(run({ keyword: '货币' }).groups[0]?.id).toBe('currency')
  })

  it('关键词无命中时返回空集而不是报错', () => {
    const data = run({ keyword: '不存在的符号关键词' })
    expect(data.total).toBe(0)
    expect(data.groups).toHaveLength(0)
  })

  it('未知分组返回 INVALID_INPUT', () => {
    const result = execute({ group: 'not-exist' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })
})
