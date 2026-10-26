import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import type { Note } from './schema'
import { createMemoryStorage } from '../shared/memoryStorage'

const storage = createMemoryStorage()
let clock = 1_700_000_000_000
const context = createExecutionContext({
  toolId: 'notes',
  caller: 'ui',
  services: { storage, now: () => clock },
})

const run = async (input: Parameters<typeof execute>[0]) => {
  const result = await execute(input, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

describe('notes', () => {
  it('一开始是空的', async () => {
    const data = await run({ action: 'list', color: 'yellow' })
    expect(data.total).toBe(0)
    expect(data.notes).toEqual([])
  })

  it('新建后能读到', async () => {
    const data = await run({ action: 'save', title: '买菜', content: '西红柿、鸡蛋', color: 'green' })
    expect(data.total).toBe(1)
    expect(data.notes[0]).toMatchObject({ title: '买菜', content: '西红柿、鸡蛋', color: 'green' })
    expect((await run({ action: 'list', color: 'yellow' })).total).toBe(1)
  })

  it('按更新时间倒序', async () => {
    clock += 1000
    await run({ action: 'save', title: '第二张', content: '内容', color: 'blue' })
    const data = await run({ action: 'list', color: 'yellow' })
    expect(data.notes[0]?.title).toBe('第二张')
  })

  it('带 id 保存是更新而不是新建', async () => {
    const before = await run({ action: 'list', color: 'yellow' })
    const target = before.notes.find((note) => note.title === '买菜')!
    clock += 1000
    const after = await run({
      action: 'save',
      id: target.id,
      title: '买菜（改）',
      content: '西红柿、鸡蛋、面条',
      color: 'pink',
    })
    expect(after.total).toBe(before.total)
    expect(after.notes.find((note: Note) => note.id === target.id)?.title).toBe('买菜（改）')
  })

  it('标题与内容都空时拒绝', async () => {
    const result = await execute({ action: 'save', title: '  ', content: '', color: 'yellow' }, context)
    expect(result.ok ? '' : result.error.message).toContain('不能都为空')
  })

  it('删除指定便签', async () => {
    const before = await run({ action: 'list', color: 'yellow' })
    const target = before.notes[0]!
    const after = await run({ action: 'delete', id: target.id, color: 'yellow' })
    expect(after.total).toBe(before.total - 1)
  })

  it('删除不存在的 id 会报错', async () => {
    const result = await execute({ action: 'delete', id: 'nope', color: 'yellow' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })

  it('清空后回到 0 条', async () => {
    const data = await run({ action: 'clear', color: 'yellow' })
    expect(data.total).toBe(0)
    expect((await run({ action: 'list', color: 'yellow' })).total).toBe(0)
  })

  it('宿主没有存储能力时给出明确提示', async () => {
    const bare = createExecutionContext({ toolId: 'notes', caller: 'ui' })
    const result = await execute({ action: 'list', color: 'yellow' }, bare)
    expect(result.ok ? '' : result.error.message).toContain('不支持本地存储')
  })
})
