import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { WeiboUserInput, WeiboUserOutput } from './schema'

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function base62ToNumber(code: string): number {
  let value = 0
  for (const char of code) {
    const digit = BASE62.indexOf(char)
    if (digit < 0) return Number.NaN
    value = value * 62 + digit
  }
  return value
}


export function parseWeiboUid(url: string): string | null {
  const last = url.split('/').pop()?.split('?')[0] ?? ''
  const code = last.slice(0, 8)
  if (code.length < 8) return null
  const value = code.startsWith('00') ? base62ToNumber(code) : Number.parseInt(code, 16)
  if (!Number.isFinite(value) || value <= 0) return null
  return String(value)
}

export function execute(
  input: WeiboUserInput,
  _context: ToolExecutionContext,
): ToolResult<WeiboUserOutput> {
  const url = input.url.trim()
  if (!url.includes('sinaimg.cn')) {
    return toolFail('INVALID_INPUT', '图片地址错误，请输入正确的微博图片链接。')
  }
  const code = (url.split('/').pop()?.split('?')[0] ?? '').slice(0, 8)
  const uid = parseWeiboUid(url)
  if (!uid) return toolFail('INVALID_INPUT', '无法从图片地址解析用户 ID，请检查文件名。')
  return toolOk({
    uid,
    homepage: `http://weibo.com/u/${uid}`,
    code,
    note: '仅从图片文件名解析，不访问微博。',
  })
}
