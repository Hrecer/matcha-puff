import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'pinyin-sort', caller: 'ui' })

const run = (input: Parameters<typeof execute>[0]) => {
  const result = execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('pinyin-sort', () => {
  it('按拼音升序排列字符串中的字符', () => {
    expect(run({ text: '张三李四王五阿七', by: 'pinyin', direction: 'asc' }).text).toBe('阿李七三四王五张')
  })

  it('按拼音降序', () => {
    expect(run({ text: '张三李四', by: 'pinyin', direction: 'desc' }).text[0]).toBe('张')
  })

  it('按笔画排序给出结果', () => {
    const data = run({ text: '张三李四', by: 'stroke', direction: 'asc' })
    expect(data.total).toBe(4)
    expect([...data.text].sort()).toEqual([...'张三李四'].sort())
  })

  it('空格和换行会被去掉', () => {
    expect(run({ text: '张 三\n李四', by: 'pinyin', direction: 'asc' }).total).toBe(4)
  })
})
