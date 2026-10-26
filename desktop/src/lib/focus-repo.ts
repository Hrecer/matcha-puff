/**
 * 专注文档读写：一个 key 一份 JSON，落在宿主 pomodoro_docs 表。
 *
 * 缓存是进程内的一层薄封装：同一窗口重复读不会反复走 IPC。
 * 写入必须先落库再更新缓存，避免"界面显示已保存、实际没写进去"。
 */
import { invoke } from '@/ipc/bridge'
import {
  DEFAULT_CONFIG,
  DEFAULT_RING,
  DOC_KEYS,
  createSummary,
} from '@matcha-puff/pomodoro-core'
import type {
  DayStatistic,
  FocusSession,
  Habit,
  HabitLog,
  InboxRecord,
  PomodoroConfig,
  RingSettings,
  Summary,
  Task,
} from '@matcha-puff/pomodoro-core'

const cache = new Map<string, unknown>()

export async function readDoc<T>(key: string, fallback: T): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T
  const value = await invoke<T | null>('pomo_doc_get', { key })
  const result = value === null || value === undefined ? fallback : value
  cache.set(key, result)
  return result
}

export async function writeDoc<T>(key: string, value: T): Promise<void> {
  await invoke('pomo_doc_set', { key, value })
  cache.set(key, value)
}

export function invalidateDocs(): void {
  cache.clear()
}

export async function loadConfig(): Promise<PomodoroConfig> {
  const stored = await readDoc<Partial<PomodoroConfig> | null>(DOC_KEYS.config, null)
  return { ...DEFAULT_CONFIG, ...(stored ?? {}) }
}

export const saveConfig = (config: PomodoroConfig) => writeDoc(DOC_KEYS.config, config)

export async function loadRing(): Promise<RingSettings> {
  const stored = await readDoc<Partial<RingSettings> | null>(DOC_KEYS.ring, null)
  return { ...DEFAULT_RING, ...(stored ?? {}) }
}

export const saveRing = (ring: RingSettings) => writeDoc(DOC_KEYS.ring, ring)

export async function loadSummary(): Promise<Summary> {
  return readDoc<Summary>(DOC_KEYS.summary, createSummary())
}

export const saveSummary = (summary: Summary) => writeDoc(DOC_KEYS.summary, summary)

export const loadStatistics = () => readDoc<DayStatistic[]>(DOC_KEYS.statistics, [])
export const saveStatistics = (records: DayStatistic[]) => writeDoc(DOC_KEYS.statistics, records)

export const saveTasks = (tasks: Task[]) => writeDoc(DOC_KEYS.tasks, tasks)

export const loadTasks = () => readDoc<Task[]>(DOC_KEYS.tasks, [])

export const loadHabits = () => readDoc<Habit[]>(DOC_KEYS.habits, [])
export const saveHabits = (habits: Habit[]) => writeDoc(DOC_KEYS.habits, habits)

export const loadHabitLogs = () => readDoc<HabitLog[]>(DOC_KEYS.habitList, [])
export const saveHabitLogs = (logs: HabitLog[]) => writeDoc(DOC_KEYS.habitList, logs)

export const loadInbox = () => readDoc<InboxRecord[]>(DOC_KEYS.inbox, [])
export const saveInbox = (records: InboxRecord[]) => writeDoc(DOC_KEYS.inbox, records)

export const loadProcessed = () => readDoc<string[]>(DOC_KEYS.processed, [])
export const saveProcessed = (ids: string[]) => writeDoc(DOC_KEYS.processed, ids)

export const loadSessions = () => readDoc<FocusSession[]>(DOC_KEYS.sessions, [])
export const saveSessions = (sessions: FocusSession[]) => writeDoc(DOC_KEYS.sessions, sessions)
