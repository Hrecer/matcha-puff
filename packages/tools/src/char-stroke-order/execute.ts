import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { isHan, strokeOrderOf } from '../shared/cnchar'
import type { StrokeOrderInput, StrokeOrderOutput } from './schema'

export function execute(
  input: StrokeOrderInput,
  _context: ToolExecutionContext,
): ToolResult<StrokeOrderOutput> {
  const chars: StrokeOrderOutput['chars'] = []
  let skipped = ''

  for (const char of input.text) {
    if (!isHan(char)) {
      if (char.trim()) skipped += char
      continue
    }
    const order = strokeOrderOf(char)
    if (!order || !order.strokes) {
      skipped += char
      continue
    }
    chars.push({
      char,
      strokes: order.strokes,
      names: order.names,
      shapes: order.shapes,
      text: order.names.join('、'),
    })
  }

  if (!chars.length) {
    return toolFail('INVALID_INPUT', '没有查到笔顺，请输入常用汉字')
  }

  return toolOk({
    total: chars.length,
    totalStrokes: chars.reduce((sum, item) => sum + item.strokes, 0),
    skipped,
    chars,
  })
}
