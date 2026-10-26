import { z } from 'zod'

export const inputSchema = z.object({
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '生日形如 1995-08-12'),
  /** 预期寿命（周岁），默认 80 */
  lifeExpectancy: z.number().min(1).max(150).default(80),
  /** 参照日期，默认今天 */
  from: z.string().max(20).optional(),
})

export type RestOfLifeInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  birthday: z.string(),
  today: z.string(),
  /** 周岁 */
  age: z.number(),
  /** 预期寿命（周岁），回显输入方便 UI 展示 */
  lifeExpectancy: z.number(),
  /** 已度过：年、月、周、日、时、分六项 */
  yearsLived: z.number(),
  monthsLived: z.number(),
  weeksLived: z.number(),
  daysLived: z.number(),
  hoursLived: z.number(),
  minutesLived: z.number(),
  daysLeft: z.number(),
  weeksLeft: z.number(),
  percentLived: z.number(),
  percentLeft: z.number(),
  nextBirthday: z.object({ date: z.string(), days: z.number() }),
  /** 已过的周末数，按每周两个算 */
  weekendsLived: z.number(),
})

export type RestOfLifeOutput = z.infer<typeof outputSchema>
