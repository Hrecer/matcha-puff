import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { cnchar } from '../shared/cnchar'
import type { SimplifiedTraditionalInput, SimplifiedTraditionalOutput } from './schema'

const convert = (text: string, direction: SimplifiedTraditionalInput['direction']): string => {
  if (direction === 's2t') return cnchar.convert.simpleToTrad(text) as string
  if (direction === 't2s') return cnchar.convert.tradToSimple(text) as string
  return cnchar.convert.simpleToSpark(text) as string
}

export function execute(
  input: SimplifiedTraditionalInput,
  _context: ToolExecutionContext,
): ToolResult<SimplifiedTraditionalOutput> {
  const result = convert(input.text, input.direction)
  const source = [...input.text]

  const diffs: SimplifiedTraditionalOutput['diffs'] = []
  ;[...result].forEach((char, index) => {
    const origin = source[index]
    if (origin !== undefined && origin !== char) diffs.push({ from: origin, to: char })
  })

  return toolOk({
    result,
    direction: input.direction,
    changed: diffs.length,
    diffs,
  })
}
