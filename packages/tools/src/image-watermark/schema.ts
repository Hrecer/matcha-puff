import { z } from 'zod'

export const inputSchema = z.object({
  dataUrl: z.string().min(1, '请先选择图片').max(30_000_000, '图片过大'),
  text: z.string().min(1, '请输入水印文字').max(40),
  fontSize: z.number().int().min(8).max(200).default(24),
  color: z.string().max(32).default('#333333'),
  opacity: z.number().min(0.02).max(1).default(0.2),
  
  angle: z.number().min(-180).max(180).default(-30),
  /** 兼容未给出 gapX / gapY 的调用：作为统一间距 */
  gap: z.number().int().min(0).max(2000).default(220),
  /** 水平间距（文字之间的空隙） */
  gapX: z.number().int().min(0).max(2000).optional(),
  /** 垂直间距（行之间的空隙） */
  gapY: z.number().int().min(0).max(2000).optional(),
  /** 水平偏移，可为负 */
  offsetX: z.number().int().min(-4000).max(4000).default(0),
  /** 垂直偏移，可为负 */
  offsetY: z.number().int().min(-4000).max(4000).default(0),
  /** 是否重复平铺 */
  repeat: z.boolean().default(true),
  /** 重复时是否错开排列 */
  staggered: z.boolean().default(true),
})

export type ImageWatermarkInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  dataUrl: z.string(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
})

export type ImageWatermarkOutput = z.infer<typeof outputSchema>
