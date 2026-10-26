import { z } from 'zod'

export const inputSchema = z.object({
  dataUrl: z.string().min(1, '请先选择图片').max(30_000_000, '图片过大'),
  
  colorCount: z.number().int().min(2).max(20).default(10),
})

export type GetColorThiefInput = z.infer<typeof inputSchema>

export const colorSampleSchema = z.object({
  hex: z.string(),
  rgb: z.string(),
  r: z.number(),
  g: z.number(),
  b: z.number(),
})

export const outputSchema = z.object({
  dominant: colorSampleSchema,
  palette: z.array(colorSampleSchema),
})

export type GetColorThiefOutput = z.infer<typeof outputSchema>
