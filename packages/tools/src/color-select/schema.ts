import { z } from 'zod'

export const inputSchema = z.object({
  value: z.string().min(1, '请输入颜色值').max(60),
})

export type ColorSelectInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  hex: z.string(),
  hex6: z.string(),
  rgb: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }),
  rgbText: z.string(),
  hsl: z.object({ h: z.number(), s: z.number(), l: z.number() }),
  hslText: z.string(),
  cmyk: z.object({ c: z.number(), m: z.number(), y: z.number(), k: z.number() }),
  cmykText: z.string(),
  luminance: z.number(),
  contrastOnWhite: z.number(),
  contrastOnBlack: z.number(),
  isLight: z.boolean(),
})

export type ColorSelectOutput = z.infer<typeof outputSchema>
