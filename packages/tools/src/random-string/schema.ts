import { z } from 'zod'

export const inputSchema = z.object({
  length: z.number().int().min(1, '长度至少为 1').max(256, '长度最多 256'),
  count: z.number().int().min(1, '数量至少为 1').max(100, '一次最多生成 100 条'),
  uppercase: z.boolean().default(true),
  lowercase: z.boolean().default(true),
  digits: z.boolean().default(false),
  symbols: z.string().max(64, '自定义字符最多 64 个').default(''),
  
  allowDuplicates: z.boolean().default(true),
})

export type RandomStringInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  items: z.array(z.string()),
  charsetSize: z.number(),
  charset: z.string(),
})

export type RandomStringOutput = z.infer<typeof outputSchema>
