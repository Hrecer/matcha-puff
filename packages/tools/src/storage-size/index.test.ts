import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'storage-size', caller: 'ui' })

const values = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return Object.fromEntries(result.data.results.map((item) => [item.unit, item.value]))
}

describe('storage-size', () => {
  it('1 GB 等于 1024 MB', () => {
    const map = values({ value: 1, unit: 'gb' })
    expect(map.mb).toBe(1024)
  })

  it('包含全部目标单位', () => {
    const result = execute({ value: 1, unit: 'bit' }, context)
    expect(result.ok && result.data.results).toHaveLength(6)
  })

  it('纯函数：重复执行结果一致', () => {
    const input: Parameters<typeof execute>[0] = { value: 1, unit: 'bit' }
    expect(execute(input, context)).toEqual(execute(input, context))
  })
})
