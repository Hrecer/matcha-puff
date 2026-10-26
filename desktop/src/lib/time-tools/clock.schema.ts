import { z } from 'zod'

export const inputSchema = z.object({
  base: z.string().min(1, '请提供基准时间'),
})

export type ClockInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  baseUtc: z.string(),
  zones: z.array(
    z.object({
      label: z.string(),
      offsetLabel: z.string(),
      offset: z.number(),
      places: z.array(z.string()),
      date: z.string(),
      time: z.string(),
      weekday: z.string(),
      /** 相对基准日期偏几天：-1 表示当地还在昨天 */
      dayShift: z.number(),
    }),
  ),
})

export type ClockOutput = z.infer<typeof outputSchema>
