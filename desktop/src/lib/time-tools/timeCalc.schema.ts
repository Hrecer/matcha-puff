import { z } from 'zod'

export const inputSchema = z.object({
  base: z.string().min(1, '请选择起始时间'),
  amount: z.number().int('请输入整数').min(-100000).max(100000),
  unit: z.enum(['year', 'month', 'day', 'hour', 'minute']),
})

export type TimeCalcInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  result: z.string(),
  date: z.string(),
  time: z.string(),
  weekday: z.string(),
  summary: z.string(),
  lunar: z
    .object({
      text: z.string(),
      fullText: z.string(),
      animal: z.string(),
      ganZhiYear: z.string(),
      ganZhiMonth: z.string(),
      ganZhiDay: z.string(),
      isLeap: z.boolean(),
      monthDays: z.number(),
      term: z.string().nullable(),
    })
    .nullable(),
})

export type TimeCalcOutput = z.infer<typeof outputSchema>
