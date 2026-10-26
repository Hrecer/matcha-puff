import { z } from 'zod'

export const inputSchema = z.object({
  direction: z.enum(['solar2lunar', 'lunar2solar']),
  year: z.number().int('请输入整数年份').min(1900, '只支持 1900 年及以后').max(2100, '只支持 2100 年及以前'),
  month: z.number().int().min(1, '月份 1–12').max(12, '月份 1–12'),
  day: z.number().int().min(1, '日期至少为 1').max(31, '日期最大 31'),
  /** 仅农历转公历时有效：表示输入的是闰月 */
  isLeap: z.boolean().default(false),
})

export type LunarConvertInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  direction: z.enum(['solar2lunar', 'lunar2solar']),
  solar: z.object({
    year: z.number(),
    month: z.number(),
    day: z.number(),
    text: z.string(),
    weekday: z.string(),
  }),
  lunar: z.object({
    year: z.number(),
    month: z.number(),
    day: z.number(),
    isLeap: z.boolean(),
    text: z.string(),
    fullText: z.string(),
    monthDays: z.number(),
    yearDays: z.number(),
    animal: z.string(),
    ganZhiYear: z.string(),
    ganZhiMonth: z.string(),
    ganZhiDay: z.string(),
    term: z.string().nullable(),
  }),
})

export type LunarConvertOutput = z.infer<typeof outputSchema>
