import { z } from 'zod'

export const inputSchema = z.object({
  start: z.string().min(1, '请选择起始时间'),
  end: z.string().min(1, '请选择结束时间'),
})

export type TimeDiffInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  rows: z.array(
    z.object({
      unit: z.enum(['second', 'minute', 'hour', 'day', 'week', 'month', 'year']),
      label: z.string(),
      value: z.number(),
      text: z.string(),
    }),
  ),
  humanized: z.string(),
  direction: z.enum(['future', 'past', 'same']),
  startText: z.string(),
  endText: z.string(),
  startLunar: z
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
  endLunar: z
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

export type TimeDiffOutput = z.infer<typeof outputSchema>
