import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { KAOMOJI } from '../shared/kaomoji'
import type { KaomojiInput, KaomojiOutput } from './schema'

export function execute(
  input: KaomojiInput,
  _context: ToolExecutionContext,
): ToolResult<KaomojiOutput> {
  const keyword = input.keyword?.trim() ?? ''
  const matched = keyword
    ? KAOMOJI.filter((item) => item.name.includes(keyword) || item.value.includes(keyword))
    : KAOMOJI
  const limit = input.limit ?? KAOMOJI.length
  return toolOk({ total: matched.length, items: matched.slice(0, limit) })
}
