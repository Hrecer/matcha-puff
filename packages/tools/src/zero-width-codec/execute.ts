import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { ZeroWidthInput, ZeroWidthOutput } from './schema'

/**
 * 零宽隐写：把文本的 UTF-8 字节拆成二进制，用两种零宽字符表示 0 与 1。
 * 0 → U+200B（零宽空格），1 → U+200C（零宽不连字）。
 * U+200D（零宽连字）与 U+FEFF 在解码时忽略，方便塞进已有文本里不被干扰。
 */
const BIT_ZERO = '\u200B'
const BIT_ONE = '\u200C'
const ZERO_WIDTH_SET = new Set([BIT_ZERO, BIT_ONE, '\u200D', '\uFEFF'])

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

/** 文本 → 零宽字符串 */
export function encodeZeroWidth(text: string): string {
  const bytes = encoder.encode(text)
  let bits = ''
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0')
  let result = ''
  for (const bit of bits) result += bit === '1' ? BIT_ONE : BIT_ZERO
  return result
}

/** 从任意文本里挑出零宽字符再还原；字节不完整或不是 UTF-8 会抛错 */
export function decodeZeroWidth(text: string): { plain: string; bits: number } {
  let bits = ''
  for (const char of text) {
    if (char === BIT_ZERO) bits += '0'
    else if (char === BIT_ONE) bits += '1'
  }
  if (!bits.length) throw new Error('没找到零宽字符，这段文本里没有藏东西')
  if (bits.length % 8 !== 0) throw new Error('密文不完整，可能被截断了一段')

  const bytes = new Uint8Array(bits.length / 8)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  }
  try {
    return { plain: decoder.decode(bytes), bits: bits.length }
  } catch {
    throw new Error('解出来不是有效文本，可能抄漏或抄错了一部分零宽字符')
  }
}

const countZeroWidth = (text: string): number => {
  let count = 0
  for (const char of text) if (ZERO_WIDTH_SET.has(char)) count += 1
  return count
}

export function execute(
  input: ZeroWidthInput,
  _context: ToolExecutionContext,
): ToolResult<ZeroWidthOutput> {
  if (input.mode === 'encode') {
    const payload = encodeZeroWidth(input.text)
    const carrier = input.carrier?.trim() ?? ''
    return toolOk({
      mode: 'encode',
      payload,
      output: carrier ? `${carrier.slice(0, Math.ceil(carrier.length / 2))}${payload}${carrier.slice(Math.ceil(carrier.length / 2))}` : payload,
      plain: input.text,
      bits: payload.length,
      visible: input.text.length,
      zeroWidthCount: payload.length,
    })
  }

  try {
    const { plain, bits } = decodeZeroWidth(input.text)
    return toolOk({
      mode: 'decode',
      payload: '',
      output: plain,
      plain,
      bits,
      visible: [...input.text].filter((char) => !ZERO_WIDTH_SET.has(char)).length,
      zeroWidthCount: countZeroWidth(input.text),
    })
  } catch (error) {
    return toolFail(
      'INVALID_INPUT',
      error instanceof Error ? error.message : '解码失败',
    )
  }
}
