import { z } from 'zod'

export const inputSchema = z.object({
  url: z.string().min(1, '请输入需要播放的视频地址'),
})

export type M3u8PlayerInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  url: z.string(),
  format: z.enum(['hls', 'video', 'unsupported']),
  extension: z.string(),
  note: z.string(),
})

export type M3u8PlayerOutput = z.infer<typeof outputSchema>
