import { z } from 'zod'

export const inputSchema = z.object({
  password: z.string().max(256, '密码过长'),
})

export type PasswordStrengthInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  level: z.enum(['weak', 'medium', 'strong']),
  label: z.string(),
  length: z.number(),
  hasUpper: z.boolean(),
  hasLower: z.boolean(),
  hasDigit: z.boolean(),
  hasSymbol: z.boolean(),
  suggestions: z.array(z.string()),
})

export type PasswordStrengthOutput = z.infer<typeof outputSchema>
