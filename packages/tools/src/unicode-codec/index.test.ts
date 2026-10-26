import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'unicode-codec', caller: 'ui' })

describe('unicode-codec', () => {
  it('编码中文', () => {
    const result = execute({"text":"中文","operation":"encode"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("%E4%B8%AD%E6%96%87")
  })

  it('解码中文', () => {
    const result = execute({"text":"%E6%8A%B9%E8%8C%B6","operation":"decode"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("抹茶")
  })

  it('纯函数：重复执行结果一致', () => {
    const input: Parameters<typeof execute>[0] = {"text":"中文","operation":"encode"}
    expect(execute(input, context)).toEqual(execute(input, context))
  })
})
