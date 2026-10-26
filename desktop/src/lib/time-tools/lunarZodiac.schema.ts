import { z } from 'zod'

export const inputSchema = z.object({
  year: z.number().int('请输入整数年份').min(1900, '只支持 1900 年及以后').max(2100, '只支持 2100 年及以前'),
  /** 参照日期，仅用于「今日日历」卡，默认今天 */
  from: z.string().max(20).optional(),
})

export type LunarZodiacInput = z.infer<typeof inputSchema>

/** 今日日历卡：公历、农历、生肖与干支历 */
export const todaySchema = z.object({
  solar: z.string(),
  solarText: z.string(),
  weekday: z.string(),
  lunar: z.string(),
  lunarDate: z.string(),
  animal: z.string(),
  ganZhi: z.string(),
})

export const outputSchema = z.object({
  year: z.number(),
  animal: z.string(),
  ganZhi: z.string(),
  /** 该农历年的生肖地支，如「辰」 */
  branch: z.string(),
  /** 正月初一对应的公历日期 */
  start: z.string(),
  /** 除夕对应的公历日期 */
  end: z.string(),
  /** 全年天数（含闰月） */
  yearDays: z.number(),
  leapMonth: z.number(),
  today: todaySchema,
})

export type LunarZodiacOutput = z.infer<typeof outputSchema>
