import { z } from 'zod'

export const inputSchema = z.object({
  value: z.number().finite('请输入有效数字'),
  unit: z.enum(['bit', 'byte', 'kb', 'mb', 'gb', 'tb']),
})

export type StorageSizeInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  results: z.array(
    z.object({
      unit: z.string(),
      label: z.string(),
      symbol: z.string(),
      group: z.string(),
      value: z.number(),
    }),
  ),
})

export type StorageSizeOutput = z.infer<typeof outputSchema>
