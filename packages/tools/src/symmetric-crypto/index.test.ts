import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'symmetric-crypto', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

const base = {
  text: '抹茶泡芙',
  key: '1234567890abcdef',
  iv: 'abcdef1234567890',
  algorithm: 'AES' as const,
  mode: 'CBC' as const,
  padding: 'Pkcs7' as const,
  operation: 'encrypt' as const,
  keyFormat: 'utf8' as const,
  output: 'base64' as const,
}

describe('symmetric-crypto', () => {
  it('AES-CBC 加完能解回原文', () => {
    const encrypted = run(base).result
    expect(encrypted).not.toBe(base.text)
    const decrypted = run({ ...base, text: encrypted, operation: 'decrypt' }).result
    expect(decrypted).toBe('抹茶泡芙')
  })

  it('同一密钥同一 IV 结果稳定（不随机加盐）', () => {
    expect(run(base).result).toBe(run(base).result)
  })

  it('改 IV 结果就变', () => {
    expect(run({ ...base, iv: 'abcdef1234567891' }).result).not.toBe(run(base).result)
  })

  it('密钥长度不对会明确报错', () => {
    const result = execute({ ...base, key: 'short' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
    expect(result.ok ? '' : result.error.message).toContain('字节')
  })

  it('DES 需要 8 字节密钥', () => {
    const ok = run({ ...base, algorithm: 'DES', key: '12345678', iv: 'abcdef12' }).result
    expect(run({ ...base, algorithm: 'DES', key: '12345678', iv: 'abcdef12', text: ok, operation: 'decrypt' }).result).toBe('抹茶泡芙')
    expect(execute({ ...base, algorithm: 'DES', key: '1234567890' }, context).ok).toBe(false)
  })

  it('3DES 需要 24 字节密钥', () => {
    const key = '123456789012345678901234'
    const ok = run({ ...base, algorithm: 'TripleDES', key, iv: 'abcdef12' }).result
    expect(run({ ...base, algorithm: 'TripleDES', key, iv: 'abcdef12', text: ok, operation: 'decrypt' }).result).toBe('抹茶泡芙')
  })

  it('RC4 是流密码，往返可逆', () => {
    const ok = run({ ...base, algorithm: 'RC4', key: 'any-key' }).result
    expect(run({ ...base, algorithm: 'RC4', key: 'any-key', text: ok, operation: 'decrypt' }).result).toBe('抹茶泡芙')
  })

  it('Rabbit 只需 16 字节密钥，不需要 IV', () => {
    const ok = run({ ...base, algorithm: 'Rabbit' }).result
    expect(run({ ...base, algorithm: 'Rabbit', text: ok, operation: 'decrypt' }).result).toBe('抹茶泡芙')
  })

  it('Rabbit 密钥不是 16 字节会报错', () => {
    const result = execute({ ...base, algorithm: 'Rabbit', key: 'short' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })

  it('十六进制密钥也能用', () => {
    const key = '00112233445566778899aabbccddeeff'
    const ok = run({ ...base, keyFormat: 'hex', key, iv: '00112233445566778899aabbccddeeff' }).result
    expect(run({ ...base, keyFormat: 'hex', key, iv: '00112233445566778899aabbccddeeff', text: ok, operation: 'decrypt' }).result).toBe('抹茶泡芙')
  })

  it('输出可以是十六进制', () => {
    const ok = run({ ...base, output: 'hex' }).result
    expect(ok).toMatch(/^[0-9a-f]+$/)
    expect(run({ ...base, output: 'hex', text: ok, operation: 'decrypt' }).result).toBe('抹茶泡芙')
  })
})

describe('symmetric-crypto 简易口令模式', () => {
  it('AES 口令加密后能用同一口令解回', () => {
    const encrypted = run({ ...base, simple: true, password: 'matcha-2026' }).result
    expect(encrypted.startsWith('U2FsdGVkX1')).toBe(true)
    const decrypted = run({ ...base, simple: true, password: 'matcha-2026', text: encrypted, operation: 'decrypt' }).result
    expect(decrypted).toBe('抹茶泡芙')
  })

  it('错误口令解不出来', () => {
    const encrypted = run({ ...base, simple: true, password: 'right' }).result
    const result = execute({ ...base, simple: true, password: 'wrong', text: encrypted, operation: 'decrypt' }, context)
    expect(result.ok).toBe(false)
  })

  it('口令模式不要求高级密钥长度', () => {
    expect(run({ ...base, simple: true, password: 'x', key: 'short', algorithm: 'DES' }).result).toBeTruthy()
  })
})
