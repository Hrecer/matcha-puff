import { z } from 'zod'

export const inputSchema = z.object({
  keyword: z.string().max(64).optional(),
  limit: z.number().int().min(1).max(999).optional(),
})

export type KaomojiInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  total: z.number(),
  items: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    }),
  ),
})

export type KaomojiOutput = z.infer<typeof outputSchema>
