import { z } from 'zod'

export const inputSchema = z.object({
  /** 公历年份；0 表示今年（表单里的数字框清空后会传 0） */
  year: z.number().int().min(0).max(2100).optional(),
  /** 参照日期 YYYY-MM-DD，默认今天 */
  from: z.string().max(20).optional(),
})

export type HolidayInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  year: z.number(),
  today: z.string(),
  next: z
    .object({
      name: z.string(),
      date: z.string(),
      days: z.number(),
    })
    .nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      date: z.string(),
      weekday: z.string(),
      /** 相对参照日期的天数，负数表示已过去 */
      days: z.number(),
      isPast: z.boolean(),
      /** 法定放几天 */
      daysOff: z.number(),
      /** 日期怎么算出来的 */
      basis: z.string(),
      /** 官方放假区间（有区间数据时提供） */
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      rangeText: z.string().optional(),
      /** 调休上班日 */
      makeup: z.string().optional(),
    }),
  ),
  note: z.string(),
  /** 参照日期所在年份已过去的比例（0-100） */
  yearProgress: z.number(),
  /** 已放完的假期比例（0-100） */
  vacationProgress: z.number(),
  /** 是否有官方放假区间数据 */
  hasOfficialRanges: z.boolean(),
})

export type HolidayOutput = z.infer<typeof outputSchema>
