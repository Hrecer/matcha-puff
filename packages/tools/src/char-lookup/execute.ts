import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { cnchar, isHan, parsePoly } from '../shared/cnchar'
import type { CharLookupInput, CharLookupOutput } from './schema'

export function execute(
  input: CharLookupInput,
  _context: ToolExecutionContext,
): ToolResult<CharLookupOutput> {
  // strokeToWord 返回的是连续字符串（如「一乙」），按字拆开
  const raw = cnchar.strokeToWord(input.strokes) as string[] | string | undefined
  const list = Array.isArray(raw) ? raw : [...String(raw ?? '')]

  let detail: CharLookupOutput['detail'] = null
  const target = input.char?.trim()
  if (target) {
    if (!isHan(target)) return toolFail('INVALID_INPUT', `「${target}」不是汉字`)
    detail = {
      char: target,
      pinyin: (cnchar.spell(target, 'tone') as string) ?? '',
      poly: parsePoly(cnchar.spell(target, 'poly') as string),
      strokes: Number(cnchar.stroke(target)) || 0,
    }
  }

  return toolOk({ strokes: input.strokes, count: list.length, chars: list, detail })
}
