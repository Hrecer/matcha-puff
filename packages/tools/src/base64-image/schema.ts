import { z } from 'zod'

export const inputSchema = z.object({
  operation: z.enum(['encode', 'decode']),
  text: z.string().min(1, '请输入内容').max(20_000_000, '内容过大'),
})

export type Base64ImageInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  operation: z.enum(['encode', 'decode']),
  mime: z.string(),
  dataUrl: z.string(),
  base64: z.string(),
  bytes: z.number(),
  /** 供通用编码工作台显示「x 字符 → y 字符」 */
  inputLength: z.number(),
  outputLength: z.number(),
})

export type Base64ImageOutput = z.infer<typeof outputSchema>
