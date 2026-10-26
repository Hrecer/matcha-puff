import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'text-diff', caller: 'ui' })

const base = { mode: 'lines', ignoreWhitespace: false, context: 3 } as const

describe('text-diff', () => {
  it('内容相同时判定为无差异', () => {
    const result = execute({ ...base, left: 'a\nb\nc', right: 'a\nb\nc' }, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.identical).toBe(true)
    expect(result.data.hunks).toHaveLength(0)
  })

  it('识别新增行', () => {
    const result = execute({ ...base, left: 'a\nb', right: 'a\nb\nc' }, context)
    expect(result.ok && result.data.additions).toBe(1)
    expect(result.ok && result.data.deletions).toBe(0)
    expect(result.ok && result.data.identical).toBe(false)
  })

  it('识别删除行', () => {
    const result = execute({ ...base, left: 'a\nb\nc', right: 'a\nc' }, context)
    expect(result.ok && result.data.deletions).toBe(1)
    expect(result.ok && result.data.additions).toBe(0)
  })

  it('词粒度比较', () => {
    const result = execute({ ...base, mode: 'words', left: 'hello world', right: 'hello there' }, context)
    expect(result.ok && result.data.additions).toBe(1)
    expect(result.ok && result.data.deletions).toBe(1)
  })

  it('忽略空白差异', () => {
    const result = execute(
      { ...base, ignoreWhitespace: true, left: 'a   b', right: 'a b' },
      context,
    )
    expect(result.ok && result.data.identical).toBe(true)
  })

  it('context=0 输出全部行', () => {
    const result = execute({ ...base, context: 0, left: 'a', right: 'b' }, context)
    expect(result.ok && result.data.hunks[0]?.lines.length).toBe(2)
  })

  it('空输入不报错', () => {
    const result = execute({ ...base, left: '', right: '' }, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.identical).toBe(true)
  })

  it('行号连续且类型正确', () => {
    const result = execute({ ...base, context: 0, left: 'a\nb', right: 'a\nc' }, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const line of result.data.hunks[0]?.lines ?? []) {
      expect(['equal', 'add', 'del']).toContain(line.type)
    }
  })
})
