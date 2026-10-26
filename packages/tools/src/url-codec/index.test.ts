import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'url-codec', caller: 'ui' })

describe('url-codec', () => {
  it('编码 URL', () => {
    const result = execute({"text":"搜索 a b&c","operation":"encode"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("%E6%90%9C%E7%B4%A2%20a%20b&c")
  })

  it('解码 URL', () => {
    const result = execute({"text":"%E6%8A%B9%E8%8C%B6%20puff","operation":"decode"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("抹茶 puff")
  })

  it('纯函数：重复执行结果一致', () => {
    const input: Parameters<typeof execute>[0] = {"text":"搜索 a b&c","operation":"encode"}
    expect(execute(input, context)).toEqual(execute(input, context))
  })
})
