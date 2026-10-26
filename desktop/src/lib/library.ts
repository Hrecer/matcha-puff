import { useSyncExternalStore } from 'react'
import { builtinPluginIds } from '@matcha-puff/tools'

export type ToolKey = `plugin:${string}`

const pluginKeys = new Set(builtinPluginIds.map((id) => `plugin:${id}`))

/** 已下线的工具不再占着收藏与最近使用的格子 */
function stillAvailable(key: string): boolean {
  return pluginKeys.has(key)
}

export interface Library {
  /** 收藏的工具 key，最近收藏的在后 */
  favorites: string[]
  /** 最近使用，最近的在前 */
  recent: string[]
}

const KEY = 'matcha-puff/library'
export const RECENT_LIMIT = 9

let state: Library | null = null
const listeners = new Set<() => void>()

function normalize(raw: unknown): Library {
  const obj = (raw ?? {}) as Partial<Library>
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && stillAvailable(x)) : []
  return { favorites: arr(obj.favorites), recent: arr(obj.recent) }
}


export function getLibrary(): Library {
  if (state) return state
  try {
    const raw = localStorage.getItem(KEY)
    state = raw ? normalize(JSON.parse(raw)) : { favorites: [], recent: [] }
  } catch {
    state = { favorites: [], recent: [] }
  }
  return state
}

function commit(next: Library) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* 存储失败不影响当前会话 */
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function isFavorite(key: string): boolean {
  return getLibrary().favorites.includes(key)
}

export function toggleFavorite(key: string) {
  const cur = getLibrary()
  const has = cur.favorites.includes(key)
  commit({
    favorites: has ? cur.favorites.filter((x) => x !== key) : [...cur.favorites, key],
    recent: cur.recent,
  })
}

/** 记一次「最近使用」：去重、置顶、封顶 */
export function recordRecent(key: string) {
  const cur = getLibrary()
  const recent = [key, ...cur.recent.filter((x) => x !== key)].slice(0, RECENT_LIMIT)
  commit({ favorites: cur.favorites, recent })
}

export function useLibrary() {
  const lib = useSyncExternalStore(subscribe, getLibrary, getLibrary)
  return {
    favorites: lib.favorites,
    recent: lib.recent,
    toggleFavorite,
    recordRecent,
  }
}
