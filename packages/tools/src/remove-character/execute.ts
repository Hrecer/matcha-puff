import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { removeCharacters } from '../shared/codecs'
import type { RemoveCharacterInput, RemoveCharacterOutput } from './schema'

export function execute(
  input: RemoveCharacterInput,
  _context: ToolExecutionContext,
): ToolResult<RemoveCharacterOutput> {
  try {
    const text = removeCharacters(input.text, input.operation)
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
