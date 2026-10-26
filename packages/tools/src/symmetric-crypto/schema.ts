import { z } from 'zod'
import { cipherAlgorithmSchema, cipherModeSchema, paddingSchema } from '../shared/cryptoAlg'

export const inputSchema = z.object({
  text: z.string().max(200_000, '文本过大，请分段处理'),
  /** 简易口令模式：true 时使用 password，忽略高级参数 */
  simple: z.boolean().optional(),
  password: z.string().max(4096).optional(),
  key: z.string().max(4096).optional(),
  /** 块密码的初始化向量；ECB 与流密码不需要 */
  iv: z.string().max(4096).optional(),
  algorithm: cipherAlgorithmSchema.default('AES'),
  mode: cipherModeSchema,
  padding: paddingSchema,
  operation: z.enum(['encrypt', 'decrypt']).default('encrypt'),
  keyFormat: z.enum(['utf8', 'hex']).default('utf8'),
  output: z.enum(['base64', 'hex']).default('base64'),
})

export type SymmetricCryptoInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  algorithm: z.string(),
  mode: z.string(),
  operation: z.enum(['encrypt', 'decrypt']),
  result: z.string(),
})

export type SymmetricCryptoOutput = z.infer<typeof outputSchema>
