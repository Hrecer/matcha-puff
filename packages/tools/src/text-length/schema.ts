import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string(),
})

export type TextLengthInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  chars: z.number().int(),
  codePoints: z.number().int(),
  bytes: z.number().int(),
  lines: z.number().int(),
  words: z.number().int(),
  chineseChars: z.number().int(),
})

export type TextLengthOutput = z.infer<typeof outputSchema>
