import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'content-type', caller: 'ui' })

const run = (keyword?: string) => {
  const result = execute({ keyword }, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('content-type', () => {
  it('不带关键词时返回全部 66 条', () => {
    expect(run().total).toBe(66)
  })

  it('按扩展名查 MIME', () => {
    expect(run('.json').items[0]?.mime).toBe('application/json')
    expect(run('.aac').items[0]?.mime).toBe('audio/aac')
  })

  it('按 MIME 反查扩展名', () => {
    const hit = run('text/html').items.find((item) => item.mime === 'text/html')
    expect(hit?.extension).toContain('.html')
  })

  it('大小写不敏感', () => {
    expect(run('IMAGE/PNG').total).toBe(run('image/png').total)
  })

  it('无命中返回空集', () => {
    expect(run('不存在的类型').total).toBe(0)
  })
})
