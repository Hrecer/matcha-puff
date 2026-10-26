import cnchar from 'cnchar'
import order from 'cnchar-order'
import poly from 'cnchar-poly'
import trad from 'cnchar-trad'

// 只装这两个插件：多音字、简繁（笔顺插件按需加载，见 strokeOrderOf）
if (!cnchar.hasPlugin('poly')) cnchar.use(poly)
if (!cnchar.hasPlugin('trad')) cnchar.use(trad)

export { cnchar }

/** 单个字是否汉字（含扩展区） */
export const isHan = (char: string): boolean =>
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(char)

/** "(Xing|Hang|Hang|Heng)" → ['Xing','Hang','Hang','Heng']（去重保序） */
export function parsePoly(value: string): string[] {
  const inner = value.replace(/^\(/, '').replace(/\)$/, '')
  if (!inner.includes('|')) return []
  return [...new Set(inner.split('|').filter(Boolean))]
}

interface StrokeMeta {
  name: string
  shape: string
}

let strokeMap: Record<string, StrokeMeta> | null = null

/** 笔画字母（cnchar 内部编码）→ 名称与字形；点/点2 这类变体统一成基础名 */
function strokeMetaMap(): Record<string, StrokeMeta> {
  if (strokeMap) return strokeMap
  if (!cnchar.hasPlugin('order')) cnchar.use(order)
  const dict = cnchar.orderToWord.orders as Record<string, { letter: string; shape: string }>
  const map: Record<string, StrokeMeta> = {}
  for (const [rawName, info] of Object.entries(dict)) {
    const name = rawName.replace(/\d+$/, '')
    const current = map[info.letter]
    // 同名去重时保留名字更短的那个，避免出现「点2」
    if (!current || name.length < current.name.length) {
      map[info.letter] = { name, shape: info.shape }
    }
  }
  strokeMap = map
  return map
}

export interface StrokeOrder {
  char: string
  strokes: number
  /** 笔画名称，如 ['点','横','撇'] */
  names: string[]
  /** 笔画字形，如 ['丶','一','丿'] */
  shapes: string[]
}

/** 查单字的笔顺；非汉字返回 null */
export function strokeOrderOf(char: string): StrokeOrder | null {
  if (!isHan(char)) return null
  const meta = strokeMetaMap()
  const codes = cnchar.stroke(char, 'order') as string[] | string
  const value = Array.isArray(codes) ? (codes[0] ?? '') : codes
  if (!value) return null
  const items = [...value].map((letter) => meta[letter]).filter(Boolean) as StrokeMeta[]
  return {
    char,
    strokes: items.length,
    names: items.map((item) => item.name),
    shapes: items.map((item) => item.shape),
  }
}
