import { z } from 'zod'

export const inputSchema = z.object({
  dataUrl: z.string().min(1, '请先选择图片').max(30_000_000, '图片过大'),
  /** 缩放比例，0.1–1 */
  scale: z.number().min(0.1).max(1).default(1),
  /** 输出画质 0.05–1，JPEG / WebP 生效 */
  quality: z.number().min(0.05).max(1).default(0.8),
  /** 最大边长（像素）：给出时长边等比缩到不超过该值 */
  maxEdge: z.number().int().min(16).max(20_000).optional(),
  format: z.enum(['png', 'jpeg', 'webp']).default('jpeg'),
})

export type ImageCompressInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  dataUrl: z.string(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  beforeBytes: z.number(),
  savedPercent: z.number(),
})

export type ImageCompressOutput = z.infer<typeof outputSchema>
