import { useEffect, useSyncExternalStore } from 'react'
import { readDoc, writeDoc } from '@/lib/focus-repo'

/** 全局人生档案：生日 + 预期寿命落库；参照日期只是本次会话的临时口径 */
export interface LifeProfile {
  birthday: string
  lifeExpectancy: number
}

export interface BirthdayParts {
  year: number
  month: number
  day: number
}

const DOC_KEY = 'profile'
const LEGACY_KEY = 'restOfLife'
const DEFAULT_LIFE_EXPECTANCY = 80

let snapshot: LifeProfile | null = null
let loading: Promise<LifeProfile> | null = null
const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) listener()
}

export function parseBirthday(text: string): BirthdayParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const probe = new Date(year, month - 1, day)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

const clampLife = (value: number): number =>
  Number.isFinite(value) ? Math.min(150, Math.max(1, Math.round(value))) : DEFAULT_LIFE_EXPECTANCY

/** 旧人生面板把生日和寿命存在自己的 localStorage 里；首次读取时迁移 */
function legacyProfile(): Partial<LifeProfile> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { birthday?: unknown; life?: unknown }
    const birthday =
      typeof parsed.birthday === 'string'
        ? parsed.birthday
        : typeof parsed.birthday === 'number'
          ? toDateText(new Date(parsed.birthday))
          : ''
    const life =
      typeof parsed.life === 'number'
        ? parsed.life
        : typeof parsed.life === 'string'
          ? Number(parsed.life)
          : undefined
    return { birthday, lifeExpectancy: life }
  } catch {
    return {}
  }
}

const toDateText = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const profileFrom = (
  stored: Partial<LifeProfile> | null,
  legacy: Partial<LifeProfile>,
): LifeProfile => ({
  birthday:
    typeof stored?.birthday === 'string' ? stored.birthday : (legacy.birthday ?? ''),
  lifeExpectancy:
    typeof stored?.lifeExpectancy === 'number'
      ? clampLife(stored.lifeExpectancy)
      : clampLife(legacy.lifeExpectancy ?? DEFAULT_LIFE_EXPECTANCY),
})

async function loadProfile(): Promise<LifeProfile> {
  if (snapshot) return snapshot
  if (!loading) {
    loading = (async () => {
      try {
        const stored = await readDoc<Partial<LifeProfile> | null>(DOC_KEY, null)
        const profile = profileFrom(stored, legacyProfile())
        const needsWrite =
          stored === null ||
          typeof stored.birthday !== 'string' ||
          typeof stored.lifeExpectancy !== 'number'
        if (needsWrite) await writeDoc(DOC_KEY, profile)
        snapshot = profile
      } catch {
        snapshot = profileFrom(null, legacyProfile())
      }
      emit()
      return snapshot
    })()
  }
  return loading
}

export function subscribeLifeProfile(listener: () => void): () => void {
  listeners.add(listener)
  void loadProfile()
  return () => listeners.delete(listener)
}

export function getLifeProfile(): LifeProfile | null {
  return snapshot
}

export async function saveLifeProfile(next: LifeProfile): Promise<void> {
  const profile = profileFrom(next, {})
  await writeDoc(DOC_KEY, profile)
  snapshot = profile
  emit()
}

export function useLifeProfile(): LifeProfile | null {
  const profile = useSyncExternalStore(
    subscribeLifeProfile,
    getLifeProfile,
    getLifeProfile,
  )
  useEffect(() => {
    void loadProfile()
  }, [])
  return profile
}
