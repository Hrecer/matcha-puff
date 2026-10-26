import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入文字').max(5000, '文字过长'),
  fontSize: z.number().int().min(14).max(40).default(18),
  align: z.enum(['left', 'center']).default('left'),
})

export type Text2ImageInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  text: z.string(),
  fontSize: z.number(),
  width: z.number(),
  height: z.number(),
  /** data:image/svg+xml;charset=utf-8,… */
  dataUrl: z.string(),
})

export type Text2ImageOutput = z.infer<typeof outputSchema>
