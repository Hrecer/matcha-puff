import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'password-strength', caller: 'ui' })

const level = (password: string) => {
  const result = execute({ password }, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('password-strength', () => {
  it('八位且四类齐全为高级', () => {
    const data = level('Abc123!@')
    expect(data.level).toBe('strong')
    expect(data.label).toBe('高')
    expect(data.suggestions[0]).toContain('已达到最强组合')
  })

  it('七位且含两类为中级', () => {
    expect(level('abc1234').level).toBe('medium')
    expect(level('abc1234').label).toBe('中')
  })

  it('不足六位一律低级', () => {
    expect(level('Ab1!').level).toBe('weak')
    expect(level('Ab1!').label).toBe('低')
  })

  it('中文不算符号，不会把纯中文密码判成强', () => {
    const data = level('抹茶泡芙抹茶泡芙')
    expect(data.hasSymbol).toBe(false)
    expect(data.level).toBe('weak')
  })

  it('指出缺失的字符类别', () => {
    const data = level('abcdefgh')
    expect(data.suggestions).toContain('加入大写字母')
    expect(data.suggestions).toContain('加入数字')
    expect(data.suggestions).toContain('加入符号（如 !@#）')
  })

  it('长度按字符数而不是 UTF-16 单元计算', () => {
    expect(level('🍵🍵🍵🍵🍵🍵🍵🍵').length).toBe(8)
  })
})
