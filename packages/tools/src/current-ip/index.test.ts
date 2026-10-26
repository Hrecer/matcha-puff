import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'current-ip', caller: 'ui' })

describe('current-ip', () => {
  it('返回两栏标题与出口查询地址', () => {
    const result = execute({}, context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.localTitle).toBe('本地网络信息')
    expect(result.data.exitTitle).toBe('出口IP信息')
    expect(result.data.endpoint).toBe('http://myip.ipip.net')
  })
})
