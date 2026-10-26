import { z } from 'zod'

export const inputSchema = z.object({})

export type ScreenCheckInput = z.infer<typeof inputSchema>

export const screenColorSchema = z.object({
  name: z.string(),
  hex: z.string(),
})

export const outputSchema = z.object({
  colors: z.array(screenColorSchema),
  note: z.string(),
})

export type ScreenCheckOutput = z.infer<typeof outputSchema>
