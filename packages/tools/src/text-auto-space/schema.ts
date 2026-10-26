import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().max(200_000, '文本过大，请分段处理'),
  operation: z.enum(['space', 'punct']),
})

export type TextAutoSpaceInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  text: z.string(),
  operation: z.string(),
  inputLength: z.number(),
  outputLength: z.number(),
  changed: z.number(),
})

export type TextAutoSpaceOutput = z.infer<typeof outputSchema>
