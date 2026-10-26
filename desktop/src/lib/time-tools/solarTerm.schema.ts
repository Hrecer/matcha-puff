import { z } from 'zod'

export const inputSchema = z.object({
  year: z.number().int('请输入整数年份').min(1900, '只支持 1900 年及以后').max(2100, '只支持 2100 年及以前'),
  /** 只关心某一个节气时传序号（1 = 小寒，24 = 冬至） */
  term: z.number().int().min(1).max(24).optional(),
})

export type SolarTermInput = z.infer<typeof inputSchema>

const termSchema = z.object({
  index: z.number(),
  name: z.string(),
  month: z.number(),
  day: z.number(),
  date: z.string(),
  season: z.string(),
})

/** 今日日历卡：公历、农历、干支历 */
export const calendarSchema = z.object({
  solar: z.string(),
  solarText: z.string(),
  weekday: z.string(),
  lunar: z.string(),
  lunarDate: z.string(),
  animal: z.string(),
  ganZhi: z.string(),
})


export const termDetailSchema = z.object({
  solarDate: z.string(),
  lunarDate: z.string(),
  chineseLunar: z.string(),
  animal: z.string(),
  ganZhi: z.string(),
  weekday: z.string(),
})

export const outputSchema = z.object({
  year: z.number(),
  terms: z.array(termSchema),
  selected: termSchema.nullable(),
  selectedDetail: termDetailSchema.nullable(),
  today: calendarSchema,
})

export type SolarTermOutput = z.infer<typeof outputSchema>
export type SolarCalendar = z.infer<typeof calendarSchema>
export type SolarTermDetail = z.infer<typeof termDetailSchema>
