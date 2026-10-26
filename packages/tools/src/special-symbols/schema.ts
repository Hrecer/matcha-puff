import { z } from 'zod'

export const inputSchema = z.object({
  keyword: z.string().max(64).optional(),
  group: z.string().max(32).optional(),
})

export type SpecialSymbolsInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  total: z.number(),
  groups: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      symbols: z.array(z.string()),
    }),
  ),
})

export type SpecialSymbolsOutput = z.infer<typeof outputSchema>
