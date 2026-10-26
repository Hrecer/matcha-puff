import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { Note, NotesInput, NotesOutput } from './schema'

const STORAGE_KEY = 'notes/v1'

const sortNotes = (notes: Note[]): Note[] =>
  [...notes].sort((a, b) => b.updatedAt - a.updatedAt)

export async function execute(
  input: NotesInput,
  context: ToolExecutionContext,
): Promise<ToolResult<NotesOutput>> {
  const storage = context.services.storage
  if (!storage) {
    return toolFail('EXECUTION_FAILED', '当前宿主不支持本地存储，便签只能在桌面端使用')
  }

  const notes = (await storage.get<Note[]>(STORAGE_KEY)) ?? []
  const now = context.services.now?.() ?? Date.now()

  if (input.action === 'list') {
    return toolOk({ action: 'list', total: notes.length, notes: sortNotes(notes) })
  }

  if (input.action === 'clear') {
    if (notes.length) await storage.set(STORAGE_KEY, [])
    return toolOk({ action: 'clear', total: 0, notes: [] })
  }

  if (input.action === 'delete') {
    if (!input.id) return toolFail('INVALID_INPUT', '删除便签需要提供 id')
    const rest = notes.filter((note) => note.id !== input.id)
    if (rest.length === notes.length) {
      return toolFail('INVALID_INPUT', `没有找到 id 为 ${input.id} 的便签`)
    }
    await storage.set(STORAGE_KEY, rest)
    return toolOk({ action: 'delete', total: rest.length, notes: sortNotes(rest) })
  }

  // save：有 id 就更新，没有就新建
  const title = (input.title ?? '').trim()
  const content = (input.content ?? '').trim()
  if (!title && !content) {
    return toolFail('INVALID_INPUT', '标题和内容不能都为空')
  }

  let next: Note[]
  if (input.id) {
    const index = notes.findIndex((note) => note.id === input.id)
    if (index === -1) return toolFail('INVALID_INPUT', `没有找到 id 为 ${input.id} 的便签`)
    next = notes.slice()
    next[index] = {
      ...next[index]!,
      title,
      content,
      color: input.color,
      updatedAt: now,
    }
  } else {
    next = [
      ...notes,
      {
        id: `n${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        title,
        content,
        color: input.color,
        createdAt: now,
        updatedAt: now,
      },
    ]
  }

  await storage.set(STORAGE_KEY, next)
  return toolOk({ action: 'save', total: next.length, notes: sortNotes(next) })
}
