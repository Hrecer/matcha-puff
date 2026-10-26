import { z } from 'zod'

export const hashAlgorithmSchema = z.enum(['MD5', 'SHA1', 'SHA256', 'SHA512'])

export const inputSchema = z.object({
  dataUrl: z.string().min(1, '请先选择文件'),
  algorithms: z.array(hashAlgorithmSchema).min(1, '至少选一种算法').default(['MD5', 'SHA1', 'SHA256']),
  uppercase: z.boolean().default(false),
})

export type FileHashInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  mime: z.string(),
  bytes: z.number(),
  humanSize: z.string(),
  hashes: z.array(
    z.object({
      algorithm: z.string(),
      hex: z.string(),
      length: z.number(),
    }),
  ),
})

export type FileHashOutput = z.infer<typeof outputSchema>
