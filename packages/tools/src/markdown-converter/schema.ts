import { z } from 'zod'

export const headingSchema = z.object({
  level: z.number().int().min(1).max(6),
  text: z.string(),
})

export const inputSchema = z.object({
  markdown: z.string(),
  gfm: z.boolean().default(true),
  breaks: z.boolean().default(false),
  /** 移除 script / iframe 与内联事件属性；本地工具默认开启 */
  sanitize: z.boolean().default(true),
})

export type MarkdownInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  html: z.string(),
  headings: z.array(headingSchema),
  wordCount: z.number().int(),
  charCount: z.number().int(),
})

export type MarkdownOutput = z.infer<typeof outputSchema>
