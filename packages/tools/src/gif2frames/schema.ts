import { z } from 'zod'

export const inputSchema = z.object({
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
  /** 每一帧的显示时长（毫秒），按顺序 */
  delays: z.array(z.number().min(0).max(60_000)).min(1).max(2000),
})

export type GifFramesInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  width: z.number(),
  height: z.number(),
  count: z.number(),
  totalDurationMs: z.number(),
  averageDelayMs: z.number(),
})

export type GifFramesOutput = z.infer<typeof outputSchema>
