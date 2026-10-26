import { z } from 'zod'

export const inputSchema = z.object({})

export type ImageViewerInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  formats: z.array(z.string()),
  note: z.string(),
})

export type ImageViewerOutput = z.infer<typeof outputSchema>
