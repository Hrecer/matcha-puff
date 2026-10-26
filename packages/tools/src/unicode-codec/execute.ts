import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { decodeUnicode, encodeUnicode } from '../shared/codecs'
import type { UnicodeCodecInput, UnicodeCodecOutput } from './schema'

export function execute(
  input: UnicodeCodecInput,
  _context: ToolExecutionContext,
): ToolResult<UnicodeCodecOutput> {
  try {
    const text = input.operation === 'encode' ? encodeUnicode(input.text) : decodeUnicode(input.text)
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
