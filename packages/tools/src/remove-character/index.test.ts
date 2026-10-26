import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'remove-character', caller: 'ui' })

describe('remove-character', () => {
  it('移除中文', () => {
    const result = execute({"text":"abc中文123","operation":"chinese"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("abc123")
  })

  it('移除数字', () => {
    const result = execute({"text":"abc中文123","operation":"number"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("abc中文")
  })

  it('移除英文', () => {
    const result = execute({"text":"abc中文123","operation":"english"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("中文123")
  })

  it('移除符号', () => {
    const result = execute({"text":"abc，。！123","operation":"symbol"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("abc123")
  })

  it('纯函数：重复执行结果一致', () => {
    const input: Parameters<typeof execute>[0] = {"text":"abc中文123","operation":"chinese"}
    expect(execute(input, context)).toEqual(execute(input, context))
  })
})
