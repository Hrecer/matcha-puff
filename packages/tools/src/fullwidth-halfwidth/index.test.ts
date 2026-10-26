import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'fullwidth-halfwidth', caller: 'ui' })

describe('fullwidth-halfwidth', () => {
  it('半角转全角', () => {
    const result = execute({"text":"abc 123","operation":"toFull"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("ａｂｃ　１２３")
  })

  it('全角转半角', () => {
    const result = execute({"text":"ＡＢＣ　１２３","operation":"toHalf"}, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.text).toBe("ABC 123")
  })

  it('纯函数：重复执行结果一致', () => {
    const input: Parameters<typeof execute>[0] = {"text":"abc 123","operation":"toFull"}
    expect(execute(input, context)).toEqual(execute(input, context))
  })
})
