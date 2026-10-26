import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { cnchar, isHan } from '../shared/cnchar'
import type { StrokeCountInput, StrokeCountOutput } from './schema'

export function execute(
  input: StrokeCountInput,
  _context: ToolExecutionContext,
): ToolResult<StrokeCountOutput> {
  const chars: StrokeCountOutput['chars'] = []
  let skipped = ''

  for (const char of input.text) {
    if (!isHan(char)) {
      skipped += char
      continue
    }
    const strokes = Number(cnchar.stroke(char)) || 0
    chars.push({ char, strokes })
  }

  return toolOk({
    total: chars.reduce((sum, item) => sum + item.strokes, 0),
    charCount: chars.length,
    chars,
    skipped,
  })
}
