import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { COLOR_PALETTES } from '../shared/colorPalettes'
import type { ColorListInput, ColorListOutput } from './schema'

export function execute(
  input: ColorListInput,
  _context: ToolExecutionContext,
): ToolResult<ColorListOutput> {
  const keyword = input.keyword?.trim().toLowerCase() ?? ''
  const items = COLOR_PALETTES.filter((item) => {
    if (input.group !== '全部' && item.group !== input.group) return false
    if (!keyword) return true
    return item.name.toLowerCase().includes(keyword) || item.hex.toLowerCase().includes(keyword)
  })
  return toolOk({
    total: items.length,
    groups: [...new Set(COLOR_PALETTES.map((item) => item.group))],
    items,
  })
}
