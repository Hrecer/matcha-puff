import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { decodeTextHex, encodeTextHex } from '../shared/codecs'
import type { TextHexInput, TextHexOutput } from './schema'

export function execute(
  input: TextHexInput,
  _context: ToolExecutionContext,
): ToolResult<TextHexOutput> {
  try {
    const text = input.operation === 'encode' ? encodeTextHex(input.text) : decodeTextHex(input.text)
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
