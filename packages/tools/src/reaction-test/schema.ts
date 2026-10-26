import { z } from 'zod'

export const inputSchema = z.object({
  /** 每次的反应时间（毫秒），按测试顺序 */
  trials: z.array(z.number().min(50).max(10_000)).min(1, '至少测一次').max(50, '最多 50 次'),
})

export type ReactionInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  count: z.number(),
  best: z.number(),
  worst: z.number(),
  average: z.number(),
  median: z.number(),
  /** 标准差，越小越稳定 */
  consistency: z.number(),
  rating: z.string(),
  /** 0–100 的分数，便于对比 */
  score: z.number(),
  advice: z.string(),
})

export type ReactionOutput = z.infer<typeof outputSchema>
