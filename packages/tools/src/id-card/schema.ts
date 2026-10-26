import { z } from 'zod'

export const inputSchema = z.object({
  id: z.string().min(1, '请输入身份证号').max(32),
})

export type IdCardInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  valid: z.boolean(),
  error: z.string().nullable(),
  length: z.number(),
  normalized: z.string(),
  address: z.string(),
  province: z.string(),
  city: z.string(),
  district: z.string(),
  birthday: z.string(),
  gender: z.string(),
  age: z.number(),
  constellation: z.string(),
  checkDigit: z.string(),
})

export type IdCardOutput = z.infer<typeof outputSchema>
