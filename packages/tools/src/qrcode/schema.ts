import { z } from 'zod'

export const DOT_TYPES = [
  'square',
  'dots',
  'rounded',
  'classy',
  'classy-rounded',
  'extra-rounded',
] as const

export const CORNER_TYPES = ['square', 'dot', 'extra-rounded'] as const

export const inputSchema = z.object({
  text: z.string().min(1, '请输入要生成二维码的内容').max(2000, '内容过长'),
  /** 容错级别：L 7% / M 15% / Q 25% / H 30% */
  level: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  size: z.number().int().min(128).max(1024).default(320),
  /** 点形，与 qr-code-styling 的 dotsOptions.type 对齐 */
  dotType: z.enum(DOT_TYPES).default('square'),
  /** 三个定位角的角形 */
  cornerType: z.enum(CORNER_TYPES).default('square'),
  /** 前景色（点与定位角） */
  foreground: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '前景色需为 #RRGGBB')
    .default('#111111'),
  /** 背景色 */
  background: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '背景色需为 #RRGGBB')
    .default('#ffffff'),
})

export type QrCodeInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  svg: z.string(),
  size: z.number(),
  level: z.string(),
  dotType: z.string(),
  cornerType: z.string(),
  foreground: z.string(),
  background: z.string(),
})

export type QrCodeOutput = z.infer<typeof outputSchema>
