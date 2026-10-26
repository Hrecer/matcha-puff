import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { inputSchema } from './schema'

const context = createExecutionContext({ toolId: 'idiom-query', caller: 'ui' })

const run = async (input: Record<string, unknown>) => {
  const result = await execute(inputSchema.parse(input), context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('idiom-query', () => {
  it('不加条件时整库返回，只回前 200 条并标记还有更多', async () => {
    const data = await run({ mode: 'contains', length: 0, random: false })
    expect(data.total).toBe(30741)
    expect(data.truncated).toBe(true)
    expect(data.hasMore).toBe(true)
    expect(data.offset).toBe(0)
    expect(data.items).toHaveLength(200)
  })

  it('可以分页加载更多', async () => {
    const first = await run({ limit: 100 })
    const second = await run({ offset: 100, limit: 100 })
    expect(second.items).toHaveLength(100)
    expect(second.items[0]?.word).not.toBe(first.items[0]?.word)
    expect(second.total).toBe(first.total)
    expect(second.hasMore).toBe(true)
  })

  it('按开头匹配', async () => {
    const data = await run({ keyword: '一心', mode: 'startsWith', length: 0, random: false })
    expect(data.items.every((item) => item.word.startsWith('一心'))).toBe(true)
    expect(data.items.map((item) => item.word)).toContain('一心一意')
  })

  it('按结尾匹配', async () => {
    const data = await run({ keyword: '风', mode: 'endsWith', length: 4, random: false })
    expect(data.items.every((item) => item.word.endsWith('风') && item.length === 4)).toBe(true)
  })

  it('按字数筛选并给出字数分布', async () => {
    const data = await run({ keyword: '天', mode: 'contains', length: 4, random: false })
    expect(data.lengthStats).toEqual([{ length: 4, count: data.total }])
  })

  it('拼音查询：全拼与首字母都能命中', async () => {
    const full = await run({ keyword: 'yixinyiyi', mode: 'pinyin' })
    expect(full.items.map((item) => item.word)).toContain('一心一意')
    const initials = await run({ keyword: 'yxyy', mode: 'pinyin' })
    expect(initials.items.map((item) => item.word)).toContain('一心一意')
    const spaced = await run({ keyword: 'yi xin yi yi', mode: 'pinyin' })
    expect(spaced.items.map((item) => item.word)).toContain('一心一意')
  })

  it('拼音查询也支持字数过滤', async () => {
    const data = await run({ keyword: 'yiyi', mode: 'pinyin', length: 4 })
    expect(data.items.every((item) => item.length === 4)).toBe(true)
  })

  it('随机模式返回一条', async () => {
    const data = await run({ mode: 'contains', length: 0, random: true })
    expect(data.items).toHaveLength(1)
    expect([...data.items[0]!.word].length).toBeGreaterThanOrEqual(3)
  })

  it('没有命中时报错并说明关键词', async () => {
    const result = await execute(
      inputSchema.parse({ keyword: '不存在的成语串', mode: 'contains', length: 0, random: false }),
      context,
    )
    expect(result.ok ? '' : result.error.message).toContain('没有找到')
  })
})
