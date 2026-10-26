/**
 * 法定工作日 / 法定节假日。
 *
 * 数据来自联网接口 `https://timor.tech/api/holiday/year/YYYY`：一年一张表，
 * `holiday: true` 是放假，`holiday: false` 是调休补班，表里没有的日期按周一至周五。
 * 拉下来存进 `focus.holiday` 文档，之后判断某一天只看本地表 —— 所以用着用着断网也没关系，
 * 网络只负责「把新一年的表取回来」。
 *
 * 没拿到表时（首次就离线、或离线跨年）按周一至周五近似，并在界面上标出来。
 */
import type { DayContext } from '@matcha-puff/pomodoro-core'
import { readDoc, writeDoc } from '@/lib/focus-repo'

const DOC_KEY = 'focus.holiday'
const API = 'https://timor.tech/api/holiday/year'
const TIMEOUT = 8000
/** 同一年最多一天请求一次：接口挂掉时不会被反复打，第二天自动再试 */
const RETRY_AFTER = 24 * 60 * 60 * 1000

/** holiday＝放假，workday＝调休补班 */
type DayFlag = 'holiday' | 'workday'

interface YearTable {
  /** MM-DD → 身份。空对象代表这一年国务院还没发通知（接口对未发布的年份返回空表） */
  days: Record<string, DayFlag>
  /** MM-DD → 官方条目标题（假期当天的名字，如「除夕」「初一」） */
  names?: Record<string, string>
  /** MM-DD → 补班归属的节日（接口的 target，如「中秋节」） */
  targets?: Record<string, string>
  fetchedAt: number
}

interface HolidayDoc {
  years: Record<string, YearTable>
}

let doc: HolidayDoc = { years: {} }
let loaded = false
let loadTask: Promise<void> | null = null
/** 同一年正在拉取时只发一次请求 */
const fetching = new Map<string, Promise<void>>()
/** 本次进程内尝试过的年份 → 时间，含失败；失败也要等一天再打 */
const attempted = new Map<string, number>()
const listeners = new Set<() => void>()

export function subscribeHolidays(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const yearOf = (date: Date): number => date.getFullYear()

function monthDayOf(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const isWeekday = (date: Date): boolean => {
  const day = date.getDay()
  return day >= 1 && day <= 5
}

export async function loadHolidays(): Promise<void> {
  if (loaded) return
  if (loadTask) return loadTask
  loadTask = (async () => {
    doc = (await readDoc<HolidayDoc | null>(DOC_KEY, null)) ?? { years: {} }
    loaded = true
  })().finally(() => {
    loadTask = null
  })
  return loadTask
}

/** 这一年有没有可用的表（空表＝还没发布） */
function tableOf(year: number): YearTable | null {
  const table = doc.years[String(year)]
  return table && Object.keys(table.days).length > 0 ? table : null
}

/** 某一天在法定日历里的身份；没有表就按周一至周五近似 */
export function dayContextOf(date: Date): DayContext {
  const flag = tableOf(yearOf(date))?.days[monthDayOf(date)]
  if (flag === 'holiday') return { workday: false, statutoryHoliday: true }
  if (flag === 'workday') return { workday: true, statutoryHoliday: false }
  return { workday: isWeekday(date), statutoryHoliday: false }
}

/** 这一年的节假日表是否缺失（界面上要标出来，否则会被当成 bug） */
export function holidayMissingAt(date: Date): boolean {
  return tableOf(yearOf(date)) === null
}

/** 补班日归属的节日；旧缓存没有这项时返回 null，由界面按邻近区间兜底 */
export function officialHolidayTarget(date: Date): string | null {
  const table = tableOf(yearOf(date))
  if (!table) return null
  const key = monthDayOf(date)
  return table.targets?.[key] ?? table.names?.[key] ?? null
}

async function fetchYear(year: number): Promise<YearTable | null> {
  attempted.set(String(year), Date.now())
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const response = await fetch(`${API}/${year}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const body = (await response.json()) as {
      code?: number
      holiday?: Record<
        string,
        { holiday?: boolean; name?: string; target?: string }
      >
    }
    // 结构不对就当没拿到，不覆盖已有的表
    if (body.code !== 0 || !body.holiday) return null
    const days: Record<string, DayFlag> = {}
    const names: Record<string, string> = {}
    const targets: Record<string, string> = {}
    for (const [key, item] of Object.entries(body.holiday)) {
      if (typeof item?.holiday !== 'boolean') continue
      days[key] = item.holiday ? 'holiday' : 'workday'
      if (typeof item.name === 'string' && item.name) names[key] = item.name
      if (typeof item.target === 'string' && item.target) targets[key] = item.target
    }
    return { days, names, targets, fetchedAt: Date.now() }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 缺「今年 / 明年」的表就补拉；已发布过的年份不再请求 */
function needsFetch(year: number): boolean {
  const table = tableOf(year)
  if (table) {
    // 旧缓存只有休息/补班标记，没有补班归属；补拉一次把调休归到正确节日
    if (!table.targets) {
      return Date.now() - (attempted.get(String(year)) ?? 0) >= RETRY_AFTER
    }
    return false
  }
  const lastTry = Math.max(
    attempted.get(String(year)) ?? 0,
    doc.years[String(year)]?.fetchedAt ?? 0,
  )
  return Date.now() - lastTry >= RETRY_AFTER
}

/**
 * 补齐某一年：日历翻到哪年就拉哪年，不限制只能看今年/明年。
 * 同一年并发只发一次；已发布的年份拉过一次就落库，之后离线也能看。
 */
export function ensureHolidayYear(year: number): Promise<void> {
  const key = String(year)
  const running = fetching.get(key)
  if (running) return running
  const task = (async () => {
    await loadHolidays()
    if (!needsFetch(year)) return
    const table = await fetchYear(year)
    if (!table) return
    doc = { years: { ...doc.years, [key]: table } }
    await writeDoc(DOC_KEY, doc)
    for (const listener of listeners) listener()
  })().finally(() => {
    fetching.delete(key)
  })
  fetching.set(key, task)
  return task
}

/**
 * 联网补齐今年和明年的表。永远不抛错、不阻塞界面：
 * 没网就静默失败，界面继续按近似规则算，第二天再试。
 */
export async function refreshHolidays(): Promise<void> {
  const year = yearOf(new Date())
  await Promise.all([ensureHolidayYear(year), ensureHolidayYear(year + 1)])
}
