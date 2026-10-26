import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入汉字').max(500, '最多 500 个字'),
})

export type StrokeOrderInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  total: z.number(),
  totalStrokes: z.number(),
  skipped: z.string(),
  chars: z.array(
    z.object({
      char: z.string(),
      strokes: z.number(),
      names: z.array(z.string()),
      shapes: z.array(z.string()),
      /** 名称连写，方便直接读 */
      text: z.string(),
    }),
  ),
})

export type StrokeOrderOutput = z.infer<typeof outputSchema>
