import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { convertUnits, STORAGE_GROUPS } from '../shared/units'
import type { StorageSizeInput, StorageSizeOutput } from './schema'

export function execute(
  input: StorageSizeInput,
  _context: ToolExecutionContext,
): ToolResult<StorageSizeOutput> {
  const { results } = convertUnits({ value: input.value, unit: input.unit }, STORAGE_GROUPS, 12)
  return toolOk({ results })
}
