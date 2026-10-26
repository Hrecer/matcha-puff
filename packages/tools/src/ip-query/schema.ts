import { z } from 'zod'

export const inputSchema = z.object({
  ip: z.string().min(7, '请输入 IP 地址').max(15, 'IPv4 地址最长 15 个字符'),
})

export type IpQueryInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  ip: z.string(),
  queryUrl: z.string(),
  fields: z.array(z.string()),
})

export type IpQueryOutput = z.infer<typeof outputSchema>
