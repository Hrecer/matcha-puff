import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { SYMBOL_GROUPS } from '../shared/symbols'
import type { SpecialSymbolsInput, SpecialSymbolsOutput } from './schema'

export function execute(
  input: SpecialSymbolsInput,
  _context: ToolExecutionContext,
): ToolResult<SpecialSymbolsOutput> {
  const keyword = input.keyword?.trim() ?? ''
  const groupId = input.group?.trim() ?? ''

  const groups = SYMBOL_GROUPS.filter((group) => !groupId || group.id === groupId)
  if (groupId && !groups.length) {
    return toolFail('INVALID_INPUT', `没有这个分组：${groupId}`)
  }

  const result = groups
    .map((group) => ({
      id: group.id,
      title: group.title,
      symbols: keyword
        ? group.symbols.filter((symbol) => symbol.includes(keyword) || group.title.includes(keyword))
        : group.symbols,
    }))
    .filter((group) => group.symbols.length > 0)

  return toolOk({
    total: result.reduce((sum, group) => sum + group.symbols.length, 0),
    groups: result,
  })
}
