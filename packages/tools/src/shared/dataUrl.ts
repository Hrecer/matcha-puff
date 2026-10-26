/** data URL 解析：把 base64 或百分号编码的 data URL 变回字节 */

import { encodeBase64 } from './codecs'

export interface DataUrlParts {
  mime: string
  /** 规范化后的 base64（去空白、补齐填充） */
  base64: string
  bytes: Uint8Array
}

const binaryToBytes = (binary: string): Uint8Array => {
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function decodeDataUrl(input: string): DataUrlParts {
  const text = input.trim()
  const comma = text.indexOf(',')
  if (!text.startsWith('data:') || comma < 0) {
    throw new Error('不是有效的 data URL（应以 data: 开头并包含逗号）')
  }

  const meta = text.slice(5, comma)
  const mime = meta.split(';')[0]?.trim() || 'application/octet-stream'
  const body = text.slice(comma + 1)

  if (!/;base64/i.test(meta)) {
    // 非 base64 的 data URL 是百分号编码的文本
    const decoded = decodeURIComponent(body)
    return { mime, base64: encodeBase64(decoded), bytes: new TextEncoder().encode(decoded) }
  }

  const clean = body.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new Error('data URL 里的 base64 含有非法字符')
  }
  const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, '=')
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new Error('data URL 里的 base64 无法解码')
  }
  return { mime, base64: padded, bytes: binaryToBytes(binary) }
}

/** 字节数按 1024 进制转成可读文本 */
export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`
}

/** 每 76 个字符折一行，和 MIME 的惯例一致 */
export function wrapBase64(base64: string, width = 76): string {
  const lines: string[] = []
  for (let i = 0; i < base64.length; i += width) lines.push(base64.slice(i, i + width))
  return lines.join('\n')
}
