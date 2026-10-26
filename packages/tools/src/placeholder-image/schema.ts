import { z } from 'zod'

export const inputSchema = z.object({
  width: z.number().int().min(10).max(4000),
  height: z.number().int().min(10).max(4000),
  background: z.string().max(32).default('#e5e7eb'),
  foreground: z.string().max(32).default('#6b7280'),
  text: z.string().max(60).default(''),
  fontSize: z.number().int().min(8).max(400).optional(),
  /** 本地模式可选背景图（data URL） */
  backgroundImage: z.string().max(30_000_000).optional(),
  format: z.enum(['svg', 'png']).default('svg'),
})

export type PlaceholderImageInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  width: z.number(),
  height: z.number(),
  format: z.enum(['svg', 'png']),
  svg: z.string(),
  dataUrl: z.string(),
  text: z.string(),
})

export type PlaceholderImageOutput = z.infer<typeof outputSchema>
