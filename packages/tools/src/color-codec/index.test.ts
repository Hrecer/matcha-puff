import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'color-codec', caller: 'ui' })

describe('color-codec', () => {
  it('十六进制转 RGB', () => {
    const result = execute({ from: 'hex', hex: '#4986CE' }, context)
    expect(result.ok && result.data).toMatchObject({
      r: 73,
      g: 134,
      b: 206,
      rgb: 'rgb(73, 134, 206)',
    })
  })

  it('RGB 转十六进制', () => {
    const result = execute({ from: 'rgb', r: 73, g: 134, b: 206 }, context)
    expect(result.ok && result.data.hex).toBe('#4986CE')
  })

  it('三位缩写', () => {
    const result = execute({ from: 'hex', hex: '#abc' }, context)
    expect(result.ok && result.data.hex).toBe('#AABBCC')
  })

  it('非法色值返回 INVALID_INPUT', () => {
    const result = execute({ from: 'hex', hex: '#12' }, context)
    expect(result.ok).toBe(false)
  })
})
