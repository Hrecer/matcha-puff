import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'bmi-calculator', caller: 'ui' })

describe('bmi-calculator', () => {
  it('170cm / 65kg', () => {
    const result = execute({ heightCm: 170, weightKg: 65 }, context)
    expect(result.ok && result.data).toEqual({ bmi: 22.49, category: '正常' })
  })

  it('边界 24 归入过重', () => {
    const result = execute({ heightCm: 100, weightKg: 24 }, context)
    expect(result.ok && result.data.category).toBe('过重')
  })

  it('负身高返回 INVALID_INPUT', () => {
    const result = execute({ heightCm: -170, weightKg: 65 }, context)
    expect(result.ok).toBe(false)
  })
})
