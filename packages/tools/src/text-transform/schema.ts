import { z } from 'zod'

export const inputSchema = z
  .object({
    text: z.string(),
    mode: z.enum(['dedupe', 'replace']).default('dedupe'),
    // 去重
    trimLines: z.boolean().default(false),
    keepEmptyLines: z.boolean().default(true),
    // 替换
    search: z.string().default(''),
    replacement: z.string().default(''),
    useRegex: z.boolean().default(false),
    caseSensitive: z.boolean().default(true),
  })
  .refine((value) => value.mode !== 'replace' || value.search.length > 0, {
    message: '替换模式下必须填写 search',
  })

export type TextTransformInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  text: z.string(),
  inputLines: z.number().int(),
  outputLines: z.number().int(),
  removedLines: z.number().int(),
  replacements: z.number().int(),
})

export type TextTransformOutput = z.infer<typeof outputSchema>
