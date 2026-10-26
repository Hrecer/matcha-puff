import { z } from 'zod'

export const inputSchema = z.object({
  text: z.string().min(1, '请输入内容').max(50_000, '内容过长'),
  mode: z.enum(['encode', 'decode']).default('encode'),
  /** 编码时把密文夹在这段可见文字中间，方便直接粘到聊天窗口 */
  carrier: z.string().max(200).optional(),
})

export type ZeroWidthInput = z.infer<typeof inputSchema>

export const outputSchema = z.object({
  mode: z.enum(['encode', 'decode']),
  /** 编码得到（或解码前看到的）零宽字符串 */
  payload: z.string(),
  /** 最终给用户拿走的那段文本（含载体） */
  output: z.string(),
  /** 藏在里面的原始文字；解码时是还原结果，编码时就是输入 */
  plain: z.string(),
  bits: z.number(),
  visible: z.number(),
  zeroWidthCount: z.number(),
})

export type ZeroWidthOutput = z.infer<typeof outputSchema>
