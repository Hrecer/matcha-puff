import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'reaction-test', caller: 'ui' })

const run = (trials: number[]) => {
  const result = execute({ trials }, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('reaction-test', () => {
  it('最快、最慢、平均都算对', () => {
    const data = run([250, 200, 300, 250])
    expect(data.count).toBe(4)
    expect(data.best).toBe(200)
    expect(data.worst).toBe(300)
    expect(data.average).toBe(250)
  })

  it('偶数个样本取中间两个的平均', () => {
    expect(run([200, 300, 400, 500]).median).toBe(350)
  })

  it('奇数个样本取正中间', () => {
    expect(run([200, 300, 900]).median).toBe(300)
  })

  it('稳定度用样本标准差', () => {
    expect(run([200, 200, 200]).consistency).toBe(0)
    const data = run([200, 300])
    expect(data.consistency).toBe(71)
  })

  it('按平均时间给评级', () => {
    expect(run([150, 160]).rating).toBe('异常快')
    expect(run([200, 210]).rating).toBe('非常快')
    expect(run([250, 260]).rating).toBe('快')
    expect(run([300, 320]).rating).toBe('正常')
    expect(run([400, 420]).rating).toBe('偏慢')
    expect(run([500, 600]).rating).toBe('较慢')
  })

  it('200ms 是 100 分，越慢越低且不低于 0', () => {
    expect(run([200]).score).toBe(100)
    expect(run([300]).score).toBe(80)
    expect(run([5000]).score).toBe(0)
  })

  it('单次测试也能出结果', () => {
    const data = run([260])
    expect(data.count).toBe(1)
    expect(data.consistency).toBe(0)
    expect(data.median).toBe(260)
  })
})
