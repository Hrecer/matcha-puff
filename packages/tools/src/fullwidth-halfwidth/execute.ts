import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { convertFullHalf } from '../shared/codecs'
import type { FullwidthHalfwidthInput, FullwidthHalfwidthOutput } from './schema'

export function execute(
  input: FullwidthHalfwidthInput,
  _context: ToolExecutionContext,
): ToolResult<FullwidthHalfwidthOutput> {
  try {
    const text = convertFullHalf(input.text, input.operation)
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
