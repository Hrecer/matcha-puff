import { z } from 'zod'

export const inputSchema = z.object({
  heightCm: z.number().positive('身高必须大于 0'),
  weightKg: z.number().positive('体重必须大于 0'),
})

export type BmiCalculatorInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  bmi: z.number(),
  category: z.enum(['偏瘦', '正常', '过重', '肥胖']),
})

export type BmiCalculatorOutput = z.infer<typeof outputSchema>
