import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'kaomoji', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('kaomoji', () => {
  it('不带参数时返回全部 999 条', () => {
    const data = run({})
    expect(data.total).toBe(999)
    expect(data.items).toHaveLength(999)
  })

  it('按关键词筛选名称或表情本身', () => {
    const data = run({ keyword: '摔桌' })
    expect(data.total).toBeGreaterThan(0)
    expect(data.items[0]?.name).toBe('摔桌')
  })

  it('limit 生效且 total 仍是完整命中数', () => {
    const data = run({ keyword: '笑', limit: 5 })
    expect(data.items).toHaveLength(5)
    expect(data.total).toBeGreaterThanOrEqual(5)
  })

  it('无命中时返回空集', () => {
    const data = run({ keyword: '绝不存在的颜文字' })
    expect(data.total).toBe(0)
    expect(data.items).toHaveLength(0)
  })
})
