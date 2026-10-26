import { z } from 'zod'

export const inputSchema = z.object({
  url: z.string().min(1, '请输入微博图片地址'),
})

export type WeiboUserInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  uid: z.string(),
  homepage: z.string(),
  code: z.string(),
  note: z.string(),
})

export type WeiboUserOutput = z.infer<typeof outputSchema>
