import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入需要转换的内容'),
  operation: z.enum(['encode', 'decode']),
})

export type UnicodeCodecInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  text: z.string(),
  operation: z.string(),
  inputLength: z.number().int(),
  outputLength: z.number().int(),
})

export type UnicodeCodecOutput = z.infer<typeof outputSchema>
