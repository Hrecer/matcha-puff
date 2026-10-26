import { z } from 'zod'

export const inputSchema = z.object({
  /** 由宿主的文件选择器读出的 data URL */
  dataUrl: z.string().min(1, '请先选择文件'),
  /** 每 76 字符折行 */
  wrap: z.boolean().default(false),
})

export type FileBase64Input = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  mime: z.string(),
  bytes: z.number(),
  humanSize: z.string(),
  base64: z.string(),
  dataUrl: z.string(),
  base64Length: z.number(),
  /** 相对原始体积的膨胀百分比 */
  overheadPercent: z.number(),
})

export type FileBase64Output = z.infer<typeof outputSchema>
