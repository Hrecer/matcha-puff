import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入内容').max(50_000, '文本过长'),
  by: z.enum(['pinyin', 'stroke']).default('pinyin'),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

export type PinyinSortInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  text: z.string(),
  total: z.number(),
})

export type PinyinSortOutput = z.infer<typeof outputSchema>
