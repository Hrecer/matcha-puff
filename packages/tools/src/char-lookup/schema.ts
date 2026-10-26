import { z } from 'zod'

export const inputSchema = z.object({
  /** 笔画数 */
  strokes: z.number().int().min(1).max(48),
  /** 需要额外查某个字的拼音与笔画 */
  char: z.string().max(4).optional(),
})

export type CharLookupInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  strokes: z.number(),
  count: z.number(),
  chars: z.array(z.string()),
  detail: z
    .object({
      char: z.string(),
      pinyin: z.string(),
      poly: z.array(z.string()),
      strokes: z.number(),
    })
    .nullable(),
})

export type CharLookupOutput = z.infer<typeof outputSchema>
