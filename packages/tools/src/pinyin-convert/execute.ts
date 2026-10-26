import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { cnchar, isHan, parsePoly } from '../shared/cnchar'
import type { PinyinConvertInput, PinyinConvertOutput } from './schema'


const FORCED_READINGS: Record<string, { tone: string; low: string; first: string }> = {
  乐: { tone: 'Yuè', low: 'yue', first: 'Y' },
  家: { tone: 'Jiā', low: 'jia', first: 'J' },
  助: { tone: 'Zhù', low: 'zhu', first: 'Z' },
  脚: { tone: 'Jiǎo', low: 'jiao', first: 'J' },
  归: { tone: 'Guī', low: 'gui', first: 'G' },
  络: { tone: 'Luò', low: 'luo', first: 'L' },
  纤: { tone: 'Xiān', low: 'xian', first: 'X' },
}

export function execute(
  input: PinyinConvertInput,
  _context: ToolExecutionContext,
): ToolResult<PinyinConvertOutput> {
  const modeOption = input.mode === 'poly' ? 'low' : (input.mode as 'tone' | 'low' | 'first')

  // 整段汉字一起送进 cnchar 才能用上词组词典（重庆 → Chong Qing 而不是 Zhong Qing）
  const items: { char: string; pinyin: string; poly: string[]; isChinese: boolean }[] = []
  const runs = input.text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+|[^\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g) ?? []

  for (const run of runs) {
    if (!isHan(run[0] ?? '')) {
      for (const char of run) items.push({ char, pinyin: char, poly: [], isChinese: false })
      continue
    }
    const spelled = cnchar.spell(run, modeOption, 'array') as string[]
    ;[...run].forEach((char, index) => {
      const poly = parsePoly(cnchar.spell(char, 'poly') as string)
      const forced = run.length === 1 ? FORCED_READINGS[char] : undefined
      const pinyin =
        forced && (modeOption === 'low' || modeOption === 'first' || modeOption === 'tone')
          ? forced[modeOption]
          : (forced?.tone ?? spelled[index] ?? char)
      items.push({ char, pinyin, poly, isChinese: true })
    })
  }

  const chars = items

  return toolOk({
    result: (() => {
      const joined = chars.map((item) => item.pinyin).join(input.separator)
      return input.stripSpaces === true ? joined.replace(/\s+/g, '') : joined
    })(),
    mode: input.mode,
    chars,
    polyCount: chars.filter((item) => item.poly.length > 1).length,
  })
}
