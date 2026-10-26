import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { decodeDataUrl, humanBytes, wrapBase64 } from '../shared/dataUrl'
import type { FileBase64Input, FileBase64Output } from './schema'

export function execute(
  input: FileBase64Input,
  _context: ToolExecutionContext,
): ToolResult<FileBase64Output> {
  let parts
  try {
    parts = decodeDataUrl(input.dataUrl)
  } catch (error) {
    return toolFail('INVALID_INPUT', error instanceof Error ? error.message : 'data URL 解析失败')
  }

  const bytes = parts.bytes.length
  const base64 = input.wrap ? wrapBase64(parts.base64) : parts.base64
  return toolOk({
    mime: parts.mime,
    bytes,
    humanSize: humanBytes(bytes),
    base64,
    dataUrl: `data:${parts.mime};base64,${parts.base64}`,
    base64Length: parts.base64.length,
    overheadPercent: bytes ? Math.round(((parts.base64.length - bytes) / bytes) * 100) : 0,
  })
}
