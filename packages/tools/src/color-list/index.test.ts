import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'color-list', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('color-list', () => {
  it('默认返回全部 1741 个颜色、5 个色板', () => {
    const data = run({ group: '全部' })
    expect(data.total).toBe(1741)
    expect(data.groups).toHaveLength(5)
  })

  it('按色板筛选', () => {
    expect(run({ group: '中国传统色' }).total).toBe(526)
    expect(run({ group: 'Material Design' }).total).toBe(254)
  })

  it('按名称搜索', () => {
    const data = run({ group: '全部', keyword: '暗玉紫' })
    expect(data.items[0]?.hex).toBe('#5C2223')
  })

  it('按色值搜索（大小写不敏感）', () => {
    expect(run({ group: '全部', keyword: '#5c2223' }).total).toBeGreaterThan(0)
  })

  it('无命中返回空集', () => {
    expect(run({ group: '全部', keyword: '不存在的颜色' }).total).toBe(0)
  })
})
