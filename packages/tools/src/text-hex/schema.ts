import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入需要转换的内容'),
  operation: z.enum(['encode', 'decode']),
})

export type TextHexInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  text: z.string(),
  operation: z.string(),
  inputLength: z.number().int(),
  outputLength: z.number().int(),
})

export type TextHexOutput = z.infer<typeof outputSchema>
