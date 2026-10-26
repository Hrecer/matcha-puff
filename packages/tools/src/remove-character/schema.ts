import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入需要转换的内容'),
  operation: z.enum(['chinese', 'number', 'english', 'symbol']),
})

export type RemoveCharacterInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  text: z.string(),
  operation: z.string(),
  inputLength: z.number().int(),
  outputLength: z.number().int(),
})

export type RemoveCharacterOutput = z.infer<typeof outputSchema>
