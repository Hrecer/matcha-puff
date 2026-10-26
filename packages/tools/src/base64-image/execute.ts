import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { Base64ImageInput, Base64ImageOutput } from './schema'

const PREFIX = /^data:([^;,]+)?(;[^,]*)?,/

const base64Length = (base64: string): number => {
  const cleaned = base64.replace(/\s+/g, '')
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding)
}

export function execute(
  input: Base64ImageInput,
  _context: ToolExecutionContext,
): ToolResult<Base64ImageOutput> {
  const raw = input.text.trim()

  if (input.operation === 'encode') {
    const match = PREFIX.exec(raw)
    if (!match) {
      return toolFail('INVALID_INPUT', '没找到 data URL 头，先确认内容以 data:image/... 开头')
    }
    const mime = match[1] ?? 'image/png'
    const isBase64 = /;base64$/i.test(match[0].replace(/^data:/, '').replace(/,$/, ''))
    if (!isBase64) {
      return toolFail('INVALID_INPUT', '这一条不是 base64 编码的 data URL（缺少 ;base64）')
    }
    const base64 = raw.slice(match[0].length).replace(/\s+/g, '')
    return toolOk({
      operation: 'encode',
      mime,
      dataUrl: raw,
      base64,
      bytes: base64Length(base64),
      inputLength: input.text.length,
      outputLength: base64.length,
    })
  }

  const base64 = raw.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
    return toolFail('INVALID_INPUT', 'Base64 里出现了非法字符，请检查是否夹带换行之外的内容')
  }
  // 从头部字节猜类型：PNG 89 50 4E 47；JPEG FF D8；GIF 47 49 46；WEBP 52 49 46 46
  let mime = 'image/png'
  if (base64.startsWith('/9j/')) mime = 'image/jpeg'
  else if (base64.startsWith('R0lGOD')) mime = 'image/gif'
  else if (base64.startsWith('UklGR')) mime = 'image/webp'
  else if (base64.startsWith('PHN2Zy') || base64.startsWith('PD94bW')) mime = 'image/svg+xml'

  const dataUrl = `data:${mime};base64,${base64}`
  return toolOk({
    operation: 'decode',
    mime,
    dataUrl,
    base64,
    bytes: base64Length(base64),
    inputLength: input.text.length,
    outputLength: dataUrl.length,
  })
}
