import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'text-hex', caller: 'ui' })

describe('text-hex', () => {
  it('文本转十六进制', () => {
    const result = execute({"text":"AB","operation":"encode"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("4142")
  })

  it('十六进制转中文', () => {
    const result = execute({"text":"E6 8A B9 E8 8C B6","operation":"decode"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("抹茶")
  })

  it('纯函数：重复执行结果一致', () => {
    const input: Parameters<typeof execute>[0] = {"text":"AB","operation":"encode"}
    expect(execute(input, context)).toEqual(execute(input, context))
  })
})
