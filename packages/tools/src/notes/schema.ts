import { z } from 'zod'

export const inputSchema = z.object({
  action: z.enum(['list', 'save', 'delete', 'clear']).default('list'),
  /** 编辑已有便签时传 id，新建留空 */
  id: z.string().max(40).optional(),
  title: z.string().max(120).optional(),
  content: z.string().max(20_000).optional(),
  color: z.enum(['yellow', 'green', 'blue', 'pink', 'gray']).default('yellow'),
})

export type NotesInput = z.infer<typeof inputSchema>

export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  color: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const outputSchema = z.object({
  action: z.string(),
  total: z.number(),
  notes: z.array(noteSchema),
})

export type NotesOutput = z.infer<typeof outputSchema>
export type Note = z.infer<typeof noteSchema>
