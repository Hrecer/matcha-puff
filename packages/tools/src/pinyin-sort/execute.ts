import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { cnchar } from '../shared/cnchar'
import type { PinyinSortInput, PinyinSortOutput } from './schema'

export function execute(
  input: PinyinSortInput,
  _context: ToolExecutionContext,
): ToolResult<PinyinSortOutput> {
  const text = input.text.replace(/\s+/g, '')
  if (!text) return toolFail('INVALID_INPUT', '请输入需要排序的汉字')

  // cnchar 的 d.ts 只声明了 'desc'，运行时其实接受 'asc' | 'desc'
  const sorter = (input.by === 'pinyin' ? cnchar.sortSpell : cnchar.sortStroke) as unknown as (
    value: string,
    order?: 'asc' | 'desc',
  ) => string
  const sorted = sorter(text, input.direction)

  return toolOk({ text: sorted, total: sorted.length })
}
