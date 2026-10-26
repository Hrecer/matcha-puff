import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入中文').max(20_000, '文本过长'),
  mode: z.enum(['tone', 'low', 'first', 'poly']).default('tone'),
  separator: z.string().max(4).default(' '),
  /** 输出时去掉所有空白 */
  stripSpaces: z.boolean().optional(),
})

export type PinyinConvertInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  result: z.string(),
  mode: z.string(),
  chars: z.array(
    z.object({
      char: z.string(),
      pinyin: z.string(),
      poly: z.array(z.string()),
      isChinese: z.boolean(),
    }),
  ),
  polyCount: z.number(),
})

export type PinyinConvertOutput = z.infer<typeof outputSchema>
