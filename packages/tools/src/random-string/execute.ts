import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { RandomStringInput, RandomStringOutput } from './schema'

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'

/** 取 [0, max) 的随机整数：优先用 crypto，拒绝采样避免取模偏置 */
function randomIndex(max: number): number {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const limit = Math.floor(0xffffffff / max) * max
    const buffer = new Uint32Array(1)
    for (let attempt = 0; attempt < 16; attempt += 1) {
      cryptoApi.getRandomValues(buffer)
      const value = buffer[0] ?? 0
      if (value < limit) return value % max
    }
  }
  return Math.floor(Math.random() * max)
}

export function buildCharset(input: RandomStringInput): string {
  let charset = ''
  if (input.uppercase) charset += UPPER
  if (input.lowercase) charset += LOWER
  if (input.digits) charset += DIGITS
  charset += input.symbols
  // 去重并保持顺序，避免同一个字符被重复抽到
  return Array.from(new Set(Array.from(charset))).join('')
}

export function execute(
  input: RandomStringInput,
  _context: ToolExecutionContext,
): ToolResult<RandomStringOutput> {
  const charset = buildCharset(input)
  if (!charset) return toolFail('INVALID_INPUT', '至少选择一种字符集')

  if (!input.allowDuplicates) {
    const space = Math.pow(charset.length, input.length)
    if (space < input.count) {
      return toolFail(
        'INVALID_INPUT',
        `字符集过小：${charset.length} 个字符生成长度 ${input.length} 只有 ${space} 种组合，不够 ${input.count} 条不重复结果`,
      )
    }
  }

  const items: string[] = []
  const seen = new Set<string>()
  let attempts = 0
  const maxAttempts = input.count * 200 + 1000
  while (items.length < input.count && attempts < maxAttempts) {
    attempts += 1
    let value = ''
    for (let index = 0; index < input.length; index += 1) {
      value += charset[randomIndex(charset.length)]
    }
    if (!input.allowDuplicates) {
      if (seen.has(value)) continue
      seen.add(value)
    }
    items.push(value)
  }

  return toolOk({ items, charsetSize: charset.length, charset })
}
