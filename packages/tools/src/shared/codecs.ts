/** 纯文本编解码内核：所有函数无副作用，可被 UI、AI 共用 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += BASE64_ALPHABET[b0 >> 2]
    out += BASE64_ALPHABET[((b0 & 0b11) << 4) | ((b1 ?? 0) >> 4)]
    out += b1 === undefined ? '=' : BASE64_ALPHABET[((b1 & 0b1111) << 2) | ((b2 ?? 0) >> 6)]
    out += b2 === undefined ? '=' : BASE64_ALPHABET[b2 & 0b111111]
  }
  return out
}

export function encodeTextHex(text: string): string {
  return Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function decodeTextHex(text: string): string {
  const clean = text.replace(/\s+/g, '')
  if (clean === '') return ''
  if (!/^[0-9a-fA-F]+$/.test(clean)) throw new Error('十六进制字符串包含非法字符')
  if (clean.length % 2 !== 0) throw new Error('十六进制字符串长度必须是偶数')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('十六进制内容不是有效的 UTF-8 文本')
  }
}

export function encodeUnicode(text: string): string {
  return encodeURIComponent(text)
}

export function decodeUnicode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    throw new Error('Unicode 转义序列不完整或格式不正确')
  }
}

export function encodeUrl(text: string): string {
  return encodeURI(text)
}

export function decodeUrl(text: string): string {
  try {
    return decodeURI(text)
  } catch {
    throw new Error('URL 转义序列不完整或格式不正确')
  }
}

export function convertFullHalf(text: string, operation: 'toFull' | 'toHalf'): string {
  let out = ''
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i)
    if (operation === 'toFull') {
      code = code >= 33 && code <= 126 ? code + 65248 : code
      code = code === 32 ? 12288 : code
    } else {
      code = code >= 65281 && code <= 65374 ? code - 65248 : code
      code = code === 12288 ? 32 : code
    }
    out += String.fromCharCode(code)
  }
  return out
}

const REMOVE_PATTERNS = {
  chinese: /[\u4e00-\u9fa5]/g,
  number: /\d+/g,
  english: /[a-zA-Z]+/g,
  symbol: /[&/\\#,+()$~%.'":*?<>{}～·！@¥……（）——「」：“《》？｜。，‘；、【】`!^_=;\-–”[\]|’]/g,
} as const

export type RemoveKind = keyof typeof REMOVE_PATTERNS

export function removeCharacters(text: string, kind: RemoveKind): string {
  return text.replace(REMOVE_PATTERNS[kind], '')
}

export function countText(text: string) {
  const chars = text.length
  const codePoints = Array.from(text).length
  const bytes = new TextEncoder().encode(text).length
  const lines = text === '' ? 0 : text.split('\n').length
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length
  return { chars, codePoints, bytes, lines, words, chineseChars }
}
