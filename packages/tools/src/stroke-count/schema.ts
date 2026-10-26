import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入汉字').max(10_000, '文本过长'),
})

export type StrokeCountInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  total: z.number(),
  charCount: z.number(),
  chars: z.array(
    z.object({
      char: z.string(),
      strokes: z.number(),
    }),
  ),
  skipped: z.string(),
})

export type StrokeCountOutput = z.infer<typeof outputSchema>
