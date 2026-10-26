import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'file-hash', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

const asDataUrl = (bytes: Buffer, mime = 'application/octet-stream') =>
  `data:${mime};base64,${bytes.toString('base64')}`

const HELLO = asDataUrl(Buffer.from('hello'), 'text/plain')

describe('file-hash', () => {
  it('hello 的三种哈希都对得上标准向量', () => {
    const data = run({ dataUrl: HELLO, algorithms: ['MD5', 'SHA1', 'SHA256'], uppercase: false })
    expect(data.hashes.map((item) => item.hex)).toEqual([
      '5d41402abc4b2a76b9719d911017c592',
      'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    ])
  })

  it('与 Node 原生 crypto 对随机二进制结果一致', () => {
    const bytes = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37) % 256))
    const data = run({ dataUrl: asDataUrl(bytes), algorithms: ['MD5', 'SHA512'], uppercase: false })
    expect(data.hashes[0]?.hex).toBe(createHash('md5').update(bytes).digest('hex'))
    expect(data.hashes[1]?.hex).toBe(createHash('sha512').update(bytes).digest('hex'))
  })

  it('大写开关生效', () => {
    const data = run({ dataUrl: HELLO, algorithms: ['MD5'], uppercase: true })
    expect(data.hashes[0]?.hex).toBe('5D41402ABC4B2A76B9719D911017C592')
  })

  it('重复算法只算一次', () => {
    const data = run({ dataUrl: HELLO, algorithms: ['MD5', 'MD5'], uppercase: false })
    expect(data.hashes).toHaveLength(1)
  })

  it('给出体积信息', () => {
    const data = run({ dataUrl: HELLO, algorithms: ['MD5'], uppercase: false })
    expect(data.bytes).toBe(5)
    expect(data.humanSize).toBe('5 B')
    expect(data.mime).toBe('text/plain')
  })

  it('非法 data URL 会报错', () => {
    expect(execute({ dataUrl: 'not-a-url', algorithms: ['MD5'], uppercase: false }, context).ok).toBe(false)
  })
})
