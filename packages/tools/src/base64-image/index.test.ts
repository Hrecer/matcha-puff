import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'base64-image', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('base64-image', () => {
  it('data URL 转 Base64 并算出字节数', () => {
    const data = run({ operation: 'encode', text: 'data:image/png;base64,iVBORw0KGgo=' })
    expect(data.base64).toBe('iVBORw0KGgo=')
    expect(data.mime).toBe('image/png')
    expect(data.bytes).toBe(8)
  })

  it('Base64 转 data URL 并按头部字节猜类型', () => {
    expect(run({ operation: 'decode', text: 'iVBORw0KGgo=' }).mime).toBe('image/png')
    expect(run({ operation: 'decode', text: '/9j/4AAQSkZJRg==' }).mime).toBe('image/jpeg')
    expect(run({ operation: 'decode', text: 'R0lGODlhAQAB' }).mime).toBe('image/gif')
  })

  it('带换行的 Base64 也能处理', () => {
    const data = run({ operation: 'decode', text: 'iVBORw0K\nGgo=' })
    expect(data.dataUrl).toBe('data:image/png;base64,iVBORw0KGgo=')
  })

  it('非 data URL 报 INVALID_INPUT', () => {
    const result = execute({ operation: 'encode', text: 'iVBORw0KGgo=' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })

  it('含非法字符的 Base64 报 INVALID_INPUT', () => {
    const result = execute({ operation: 'decode', text: 'iVBOR***' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })
})
