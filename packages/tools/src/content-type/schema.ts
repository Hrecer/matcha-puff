import { z } from 'zod'

export const inputSchema = z.object({
  keyword: z.string().max(120).optional(),
})

export type ContentTypeInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  total: z.number(),
  items: z.array(
    z.object({
      extension: z.string(),
      description: z.string(),
      mime: z.string(),
    }),
  ),
})

export type ContentTypeOutput = z.infer<typeof outputSchema>
