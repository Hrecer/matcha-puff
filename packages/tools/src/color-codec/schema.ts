import { z } from 'zod'

export const inputSchema = z
  .object({
    from: z.enum(['hex', 'rgb']),
    hex: z.string().optional(),
    r: z.number().int().min(0).max(255).optional(),
    g: z.number().int().min(0).max(255).optional(),
    b: z.number().int().min(0).max(255).optional(),
  })
  .refine((value) => (value.from === 'hex' ? !!value.hex?.trim() : value.r !== undefined && value.g !== undefined && value.b !== undefined), {
    message: '请填写完整的颜色值',
  })

export type ColorCodecInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  hex: z.string(),
  r: z.number().int(),
  g: z.number().int(),
  b: z.number().int(),
  rgb: z.string(),
})

export type ColorCodecOutput = z.infer<typeof outputSchema>
