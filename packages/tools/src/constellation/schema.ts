import { z } from 'zod'

export const inputSchema = z.object({
  date: z.string().min(1, '请选择日期'),
})

export type ConstellationInput = z.infer<typeof inputSchema>

export const signSchema = z.object({
  sign: z.string(),
  english: z.string(),
  emoji: z.string(),
  start: z.string(),
  end: z.string(),
})

export const outputSchema = z.object({
  sign: z.string(),
  english: z.string(),
  emoji: z.string(),
  start: z.string(),
  end: z.string(),
  dateText: z.string(),
  /** 十二星座完整列表，供左侧栏直接点选 */
  signs: z.array(signSchema),
})

export type ConstellationOutput = z.infer<typeof outputSchema>
