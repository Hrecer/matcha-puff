import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'file-base64', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

/** "抹茶" 的 UTF-8 字节：E6 8A B9 E8 8C B6 */
const TEXT_URL = `data:text/plain;base64,${Buffer.from('抹茶', 'utf8').toString('base64')}`

describe('file-base64', () => {
  it('还原出 base64 与 data URL', () => {
    const data = run({ dataUrl: TEXT_URL, wrap: false })
    expect(data.mime).toBe('text/plain')
    expect(data.bytes).toBe(6)
    expect(data.dataUrl).toBe(TEXT_URL)
    expect(data.base64).toBe('5oq56Iy2')
  })

  it('算出膨胀率（base64 比原始大约 33%）', () => {
    const data = run({ dataUrl: TEXT_URL, wrap: false })
    expect(data.overheadPercent).toBe(33)
    expect(data.humanSize).toBe('6 B')
  })

  it('折行后每行不超过 76 字符', () => {
    const long = `data:application/octet-stream;base64,${'A'.repeat(200)}`
    const data = run({ dataUrl: long, wrap: true })
    expect(data.base64.split('\n').every((line) => line.length <= 76)).toBe(true)
    expect(data.base64.split('\n').length).toBe(3)
  })

  it('带空白的 base64 也能解析', () => {
    const messy = TEXT_URL.replace(/(.{12})/, '$1\n  ')
    expect(run({ dataUrl: messy, wrap: false }).bytes).toBe(6)
  })

  it('百分号编码的文本 data URL 也能处理', () => {
    const data = run({ dataUrl: 'data:text/plain,%E6%8A%B9%E8%8C%B6', wrap: false })
    expect(data.bytes).toBe(6)
    expect(data.base64).toBe('5oq56Iy2')
  })

  it('不是 data URL 会报错', () => {
    const result = execute({ dataUrl: 'hello', wrap: false }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })

  it('base64 含非法字符会报错', () => {
    const result = execute({ dataUrl: 'data:text/plain;base64,@@@', wrap: false }, context)
    expect(result.ok ? '' : result.error.message).toContain('非法字符')
  })
})
