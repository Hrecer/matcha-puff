import { z } from 'zod'
import { TRENDING_SINCE } from './languages'

export const inputSchema = z.object({
  language: z.string().default(''),
  since: z.enum(TRENDING_SINCE).default('monthly'),
})

export type GithubTrendingInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  url: z.string(),
  language: z.string(),
  languageTitle: z.string(),
  since: z.string(),
  sinceLabel: z.string(),
  languages: z.array(z.object({ name: z.string(), title: z.string() })),
})

export type GithubTrendingOutput = z.infer<typeof outputSchema>
