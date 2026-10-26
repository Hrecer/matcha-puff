import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { IdiomInput, IdiomOutput } from './schema'

interface PinyinEntry {
  word: string
  length: number
  pinyin: string
  initials: string
}

let pinyinIndex: PinyinEntry[] | null = null

/**
 * 逐字查拼音再拼起来：4816 个不重复汉字只查一次，比整词送进 cnchar 快一个数量级。
 * 成语表只在第一次用拼音检索时加载，打开工具本身不会被 400KB 的数据拖慢。
 */
async function getPinyinIndex(): Promise<PinyinEntry[]> {
  if (pinyinIndex) return pinyinIndex
  const [{ IDIOMS }, { cnchar }] = await Promise.all([
    import('../shared/idioms'),
    import('../shared/cnchar'),
  ])
  const cache = new Map<string, string>()
  const pinyinOf = (char: string): string => {
    const cached = cache.get(char)
    if (cached !== undefined) return cached
    const spelled = cnchar.spell(char, 'low')
    const value = typeof spelled === 'string' ? spelled.toLowerCase() : char
    cache.set(char, value)
    return value
  }
  pinyinIndex = IDIOMS.map((word) => {
    const syllables = [...word].map(pinyinOf)
    return {
      word,
      length: [...word].length,
      pinyin: syllables.join(''),
      initials: syllables.map((syllable) => syllable[0] ?? '').join(''),
    }
  })
  return pinyinIndex
}

/** 输入可能带空格、声调或大写，统一成纯字母 */
const normalizePinyin = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, '')

/**
 * 成语表有 400KB，做成动态导入：只有真正打开这个工具时才加载，
 * 不然会拖慢每个工具窗口的首屏。
 */
export async function execute(
  input: IdiomInput,
  _context: ToolExecutionContext,
): Promise<ToolResult<IdiomOutput>> {
  const { IDIOMS } = await import('../shared/idioms')

  if (input.random) {
    const word = IDIOMS[Math.floor(Math.random() * IDIOMS.length)] ?? ''
    return toolOk({
      total: 1,
      truncated: false,
      hasMore: false,
      offset: 0,
      items: word ? [{ word, length: [...word].length }] : [],
      lengthStats: [],
    })
  }

  const keyword = input.keyword?.trim() ?? ''
  let matched: string[]

  if (input.mode === 'pinyin') {
    const query = normalizePinyin(keyword)
    const index = await getPinyinIndex()
    matched = index
      .filter((entry) => {
        if (input.length > 0 && entry.length !== input.length) return false
        if (!query) return true
        return entry.pinyin.includes(query) || entry.initials.includes(query)
      })
      .map((entry) => entry.word)
  } else {
    matched = IDIOMS.filter((word) => {
      if (input.length > 0 && [...word].length !== input.length) return false
      if (!keyword) return true
      if (input.mode === 'startsWith') return word.startsWith(keyword)
      if (input.mode === 'endsWith') return word.endsWith(keyword)
      return word.includes(keyword)
    })
  }

  if (!matched.length) {
    const label = input.mode === 'pinyin' ? `拼音「${keyword}」` : `包含「${keyword}」`
    return toolFail('INVALID_INPUT', keyword ? `没有找到${label}的成语` : '没有符合条件的成语')
  }

  const stats = new Map<number, number>()
  for (const word of matched) {
    const size = [...word].length
    stats.set(size, (stats.get(size) ?? 0) + 1)
  }

  const items = matched.slice(input.offset, input.offset + input.limit)
  const hasMore = input.offset + items.length < matched.length

  return toolOk({
    total: matched.length,
    truncated: hasMore,
    hasMore,
    offset: input.offset,
    items: items.map((word) => ({ word, length: [...word].length })),
    lengthStats: [...stats.entries()]
      .map(([length, count]) => ({ length, count }))
      .sort((a, b) => a.length - b.length),
  })
}
