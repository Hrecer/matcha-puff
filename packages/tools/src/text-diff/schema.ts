import { z } from 'zod'

export const diffLineSchema = z.object({
  type: z.enum(['equal', 'add', 'del']),
  text: z.string(),
  oldNumber: z.number().int().nullable(),
  newNumber: z.number().int().nullable(),
})

export const diffHunkSchema = z.object({
  oldStart: z.number().int(),
  oldLines: z.number().int(),
  newStart: z.number().int(),
  newLines: z.number().int(),
  lines: z.array(diffLineSchema),
})

export const inputSchema = z.object({
  left: z.string(),
  right: z.string(),
  mode: z.enum(['lines', 'words', 'chars']).default('lines'),
  ignoreWhitespace: z.boolean().default(false),
  /** 上下文行数；0 表示输出全部内容（含未变更部分） */
  context: z.number().int().min(0).max(50).default(3),
})

export type TextDiffInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  identical: z.boolean(),
  additions: z.number().int(),
  deletions: z.number().int(),
  hunks: z.array(diffHunkSchema),
})

export type TextDiffOutput = z.infer<typeof outputSchema>
export type DiffLine = z.infer<typeof diffLineSchema>
export type DiffHunk = z.infer<typeof diffHunkSchema>
