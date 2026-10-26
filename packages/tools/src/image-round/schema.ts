import { z } from 'zod'

export const inputSchema = z.object({
  dataUrl: z.string().min(1, '请先选择图片').max(30_000_000, '图片过大'),
  /** 圆角像素值 */
  radius: z.number().min(0).max(2000).default(24),
  /** 按短边百分比算圆角时设为 true，此时 radius 是 0–50 */
  byPercent: z.boolean().default(false),
})

export type ImageRoundInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  dataUrl: z.string(),
  width: z.number(),
  height: z.number(),
  radius: z.number(),
  bytes: z.number(),
})

export type ImageRoundOutput = z.infer<typeof outputSchema>
