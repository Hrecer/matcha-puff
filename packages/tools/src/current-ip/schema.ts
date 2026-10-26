import { z } from 'zod'

export const inputSchema = z.object({})

export type CurrentIpInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  localTitle: z.string(),
  exitTitle: z.string(),
  endpoint: z.string(),
  note: z.string(),
})

export type CurrentIpOutput = z.infer<typeof outputSchema>
