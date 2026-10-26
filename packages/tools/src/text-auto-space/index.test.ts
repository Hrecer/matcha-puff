import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute, insertSpaces, toFullWidthPunctuation } from './execute'

const context = createExecutionContext({ toolId: 'text-auto-space', caller: 'ui' })

const run = (text: string, operation: 'space' | 'punct') => {
  const result = execute({ text, operation }, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('text-auto-space', () => {
  it('汉字与字母之间补空格，两侧都要补', () => {
    expect(insertSpaces('中文abc中文')).toBe('中文 abc 中文')
  })

  it('汉字与数字之间也补空格', () => {
    expect(insertSpaces('第3名')).toBe('第 3 名')
  })

  it('已经有空格时不重复补', () => {
    expect(insertSpaces('中文 abc 中文')).toBe('中文 abc 中文')
  })

  it('纯中文与纯英文都不动', () => {
    expect(insertSpaces('只有中文')).toBe('只有中文')
    expect(insertSpaces('only english 123')).toBe('only english 123')
  })

  it('重复执行稳定（幂等）', () => {
    const once = insertSpaces('混排ab数字12测试')
    expect(insertSpaces(once)).toBe(once)
  })

  it('标点、引号、括号、百分号按 pangu 完整规则处理', () => {
    expect(insertSpaces('「引号」前后A1%的测试')).toBe('「引号」前后 A1% 的测试')
    expect(insertSpaces('中文(括号)与[方括号]以及《书名》')).toBe(
      '中文 (括号) 与 [方括号] 以及《书名》',
    )
    expect(insertSpaces('100%的进度')).toBe('100% 的进度')
    expect(insertSpaces('"引号"中文')).toBe('"引号" 中文')
    expect(insertSpaces('中文，逗号English.')).toBe('中文，逗号 English.')
  })

  it('半角标点转全角', () => {
    expect(toFullWidthPunctuation('你好,世界!真的吗?')).toBe('你好，世界！真的吗？')
  })

  it('小数、时间与省略号不误伤', () => {
    expect(toFullWidthPunctuation('1.5倍')).toBe('1.5倍')
    expect(toFullWidthPunctuation('12:30开会')).toBe('12:30开会')
    expect(toFullWidthPunctuation('等等...')).toBe('等等...')
  })

  it('输出长度与字数变化统计正确', () => {
    const data = run('中文abc', 'space')
    expect(data.text).toBe('中文 abc')
    expect(data.inputLength).toBe(5)
    expect(data.outputLength).toBe(6)
  })
})
