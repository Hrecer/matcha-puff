import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { CONTENT_TYPES } from '../shared/contentTypes'
import type { ContentTypeInput, ContentTypeOutput } from './schema'

export function execute(
  input: ContentTypeInput,
  _context: ToolExecutionContext,
): ToolResult<ContentTypeOutput> {
  const keyword = input.keyword?.trim().toLowerCase() ?? ''
  const items = CONTENT_TYPES.filter((item) => {
    if (!keyword) return true
    return (
      item.extension.includes(keyword) ||
      item.mime.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword)
    )
  })
  return toolOk({ total: items.length, items })
}
