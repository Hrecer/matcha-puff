import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { countText } from '../shared/codecs'
import type { TextLengthInput, TextLengthOutput } from './schema'

export function execute(
  input: TextLengthInput,
  _context: ToolExecutionContext,
): ToolResult<TextLengthOutput> {
  return toolOk(countText(input.text))
}
