import { z } from 'zod'

export const inputSchema = z.object({
  /** 每圈的毫秒数，按先后顺序排列 */
  laps: z.array(z.number().min(0).max(86_400_000)).min(1, '至少记一圈').max(200),
})

export type StopwatchInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  totalText: z.string(),
  totalMs: z.number(),
  averageMs: z.number(),
  fastest: z.object({ index: z.number(), ms: z.number(), text: z.string() }).nullable(),
  slowest: z.object({ index: z.number(), ms: z.number(), text: z.string() }).nullable(),
  laps: z.array(
    z.object({
      index: z.number(),
      lapText: z.string(),
      cumulativeText: z.string(),
      ms: z.number(),
      cumulativeMs: z.number(),
    }),
  ),
})

export type StopwatchOutput = z.infer<typeof outputSchema>
