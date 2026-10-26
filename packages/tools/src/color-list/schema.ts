import { z } from 'zod'

export const inputSchema = z.object({
  keyword: z.string().max(60).optional(),
  group: z.enum(['全部', '中国传统色', '日本传统色', 'Material Design', 'Flat UI', 'WEB 安全色']).default('全部'),
})

export type ColorListInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  total: z.number(),
  groups: z.array(z.string()),
  items: z.array(
    z.object({
      name: z.string(),
      hex: z.string(),
      group: z.string(),
    }),
  ),
})

export type ColorListOutput = z.infer<typeof outputSchema>
