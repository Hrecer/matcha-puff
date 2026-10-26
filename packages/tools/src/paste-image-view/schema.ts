import { z } from 'zod'

export const inputSchema = z.object({})

export type PasteImageViewInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  note: z.string(),
})

export type PasteImageViewOutput = z.infer<typeof outputSchema>
