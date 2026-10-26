import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { SIGNS, signOf } from '../shared/constellation'
import { formatDate, parseDateTime } from '../shared/datetime'
import type { ConstellationInput, ConstellationOutput } from './schema'

export function execute(
  input: ConstellationInput,
  _context: ToolExecutionContext,
): ToolResult<ConstellationOutput> {
  const date = parseDateTime(input.date)
  if (!date) return toolFail('INVALID_INPUT', `日期格式不正确：${input.date}`)

  const matched = signOf(date.month, date.day)
  return toolOk({
    sign: matched.sign,
    english: matched.english,
    emoji: matched.emoji,
    start: matched.start,
    end: matched.end,
    dateText: formatDate(date),
    signs: SIGNS.map(({ sign, english, emoji, start, end }) => ({ sign, english, emoji, start, end })),
  })
}
