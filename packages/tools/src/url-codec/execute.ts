import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { decodeUrl, encodeUrl } from '../shared/codecs'
import type { UrlCodecInput, UrlCodecOutput } from './schema'

export function execute(
  input: UrlCodecInput,
  _context: ToolExecutionContext,
): ToolResult<UrlCodecOutput> {
  try {
    const text = input.operation === 'encode' ? encodeUrl(input.text) : decodeUrl(input.text)
    return toolOk({
      text,
      operation: input.operation,
      inputLength: input.text.length,
      outputLength: text.length,
    })
  } catch (error) {
    return toolFail('INVALID_INPUT', error instanceof Error ? error.message : '转换失败')
  }
}
