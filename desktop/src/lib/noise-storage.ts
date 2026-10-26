/**
 * 白噪音的喜欢、音量、自定义声音与合集都落在本地存储。
 *
 * 音量改过就记住，重启后仍是上次的位置；想回到默认值走界面上的重置按钮。
 * 这些数据体积很小，读取同步完成，界面首帧就能显示上一次的状态；
 * 自定义音频本体不在这里，另行存放到 IndexedDB。
 */
import type { NoiseCategoryId } from '@/data/noise-library'

const PREFIX = 'matcha-puff/noise/'

export interface NoisePrefs {
  favorites: string[]
  /** 仅记录用户改过的音量，未记录的回到声音自身的默认值 */
  volumes: Record<string, number>
  master: number
}

export interface CustomNoiseRecord {
  id: string
  title: string
  category: NoiseCategoryId
  volume: number
  createdAt: number
}

export interface NoiseCollectionRecord {
  id: string
  name: string
  createdAt: number
  trackIds: string[]
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 存储配额满或环境禁用时静默降级：本次会话仍然可用
  }
}

export function loadNoisePrefs(): NoisePrefs {
  const stored = readJson<Partial<NoisePrefs>>('prefs', {})
  const rawVolumes =
    stored.volumes && typeof stored.volumes === 'object' && !Array.isArray(stored.volumes)
      ? stored.volumes
      : {}
  const volumes: Record<string, number> = {}
  for (const [id, value] of Object.entries(rawVolumes)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      volumes[id] = Math.min(100, Math.max(0, Math.round(value)))
    }
  }
  return {
    favorites: Array.isArray(stored.favorites) ? stored.favorites.filter((id) => typeof id === 'string') : [],
    volumes,
    master:
      typeof stored.master === 'number' && Number.isFinite(stored.master)
        ? Math.min(100, Math.max(0, Math.round(stored.master)))
        : 100,
  }
}

export function saveNoisePrefs(prefs: NoisePrefs): void {
  writeJson('prefs', prefs)
}

export function loadCustomNoise(): CustomNoiseRecord[] {
  const stored = readJson<CustomNoiseRecord[]>('custom', [])
  if (!Array.isArray(stored)) return []
  return stored.filter(
    (item) =>
      item &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.category === 'string',
  )
}

export function saveCustomNoise(records: CustomNoiseRecord[]): void {
  writeJson('custom', records)
}

export function loadNoiseCollections(): NoiseCollectionRecord[] {
  const stored = readJson<NoiseCollectionRecord[]>('collections', [])
  if (!Array.isArray(stored)) return []
  return stored.filter(
    (item) => item && typeof item.id === 'string' && Array.isArray(item.trackIds),
  )
}

export function saveNoiseCollections(records: NoiseCollectionRecord[]): void {
  writeJson('collections', records)
}
