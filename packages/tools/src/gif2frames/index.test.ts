import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'gif2frames', caller: 'ui' })

describe('gif2frames', () => {
  it('汇总帧数与总时长', () => {
    const result = execute({ width: 320, height: 240, delays: [100, 100, 250] }, context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data).toEqual({
      width: 320,
      height: 240,
      count: 3,
      totalDurationMs: 450,
      averageDelayMs: 150,
    })
  })
})
