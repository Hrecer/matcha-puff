import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入文本').max(50_000, '文本过长'),
  direction: z.enum(['s2t', 't2s', 'spark']).default('s2t'),
})

export type SimplifiedTraditionalInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  result: z.string(),
  direction: z.string(),
  changed: z.number(),
  diffs: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    }),
  ),
})

export type SimplifiedTraditionalOutput = z.infer<typeof outputSchema>
