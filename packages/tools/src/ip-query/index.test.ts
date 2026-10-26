import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'ip-query', caller: 'ui' })

describe('ip-query', () => {
  it('校验 IPv4 并给出 ip-api 地址', () => {
    const result = execute({ ip: '114.114.114.114' }, context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.queryUrl).toBe('http://ip-api.com/json/114.114.114.114?lang=zh-CN')
    expect(result.data.fields).toContain('运营商')
  })

  it('拒绝超出范围的地址', () => {
    const result = execute({ ip: '999.1.1.1' }, context)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('IP输入错误')
  })
})
