import { z } from 'zod'

export const inputSchema = z.object({
  dataUrl: z.string().min(1, '请先选择图片').max(30_000_000, '图片过大'),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive('裁剪宽度必须大于 0'),
  height: z.number().positive('裁剪高度必须大于 0'),
  /** 需要按指定像素输出时给出（如证件照 295×413） */
  outputWidth: z.number().int().positive().optional(),
  outputHeight: z.number().int().positive().optional(),
  format: z.enum(['png', 'jpeg', 'webp']).optional(),
})

export type ImageCropInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  dataUrl: z.string(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
})

export type ImageCropOutput = z.infer<typeof outputSchema>
