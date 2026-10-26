import { z } from 'zod'

export const inputSchema = z.object({
  keyword: z.string().max(30).optional(),
  /** contains 包含 / startsWith 开头 / endsWith 结尾 / pinyin 拼音 */
  mode: z.enum(['contains', 'startsWith', 'endsWith', 'pinyin']).default('contains'),
  /** 字数筛选，0 表示不限 */
  length: z.number().int().min(0).max(20).default(0),
  /** 随机返回一条，忽略其他条件 */
  random: z.boolean().default(false),
  /** 分页：从第几条开始、一次返回多少条 */
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(500).default(200),
})

export type IdiomInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  /** 命中总数（不受分页影响） */
  total: z.number(),
  /** 后面还有没有更多结果 */
  truncated: z.boolean(),
  hasMore: z.boolean(),
  offset: z.number(),
  items: z.array(
    z.object({
      word: z.string(),
      length: z.number(),
    }),
  ),
  /** 命中结果的字数分布 */
  lengthStats: z.array(z.object({ length: z.number(), count: z.number() })),
})

export type IdiomOutput = z.infer<typeof outputSchema>
