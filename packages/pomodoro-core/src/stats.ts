import type { DayStatistic, Summary } from './types'
import { dayKeyOf, isSameDay, statisticOfDay } from './statistics'
import { pad2 } from './time'

export interface TaskTotal {
  id: string
  name: string
  seconds: number
}

/**
 * 任务时长排行：把已归档记录与今天未归档的实时值，按任务 id 合并。
 *
 * 统计页要回答「时间花在哪」，只看今天不够；这里跨全部历史汇总。
 * 同名不同 id 不合并（两个任务可以重名）。
 */
export function taskTotals(
  statistics: readonly DayStatistic[],
  summary: Summary,
  now: number | Date = Date.now(),
): TaskTotal[] {
  const totals = new Map<string, TaskTotal>()

  const add = (id: string, name: string, seconds: number) => {
    if (seconds <= 0) return
    const current = totals.get(id)
    if (current) current.seconds += seconds
    else totals.set(id, { id, name, seconds })
  }

  for (const record of statistics) {
    for (const task of record.tasks || []) {
      add(task.id, task.name, task.value || 0)
    }
  }

  // 今天尚未归档，把实时值补上；否则「今日第一段专注」在排行里看不到。
  if (isSameDay(summary.update, now)) {
    for (const task of summary.todayTasks || []) {
      add(task.id, task.name, task.value || 0)
    }
  }

  return [...totals.values()].sort((a, b) => b.seconds - a.seconds)
}

export interface YearDay {
  /** 本地日期，用于定位格子在周几 */
  date: Date
  key: string
  seconds: number
  count: number
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** 某年逐日专注数据，缺失的日期补 0，长度固定为当年天数。 */
export function yearDays(
  statistics: readonly DayStatistic[],
  summary: Summary,
  year: number,
  now: number | Date = Date.now(),
): YearDay[] {
  const byKey = new Map<string, DayStatistic>()
  for (const record of statistics) {
    byKey.set(`${record.year}-${record.month}-${record.day}`, record)
  }

  const total = isLeapYear(year) ? 366 : 365
  const days: YearDay[] = []
  for (let index = 0; index < total; index += 1) {
    const date = new Date(year, 0, 1 + index)
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    // 今天优先取实时值，历史日期取归档记录。
    const stat = isSameDay(date, now) ? statisticOfDay(statistics, summary, date, now) : byKey.get(key)
    days.push({
      date,
      key,
      seconds: stat?.pomodoroTime ?? 0,
      count: stat?.pomodoroCount ?? 0,
    })
  }
  return days
}

/** 热力等级 0–4：0 表示当天没有记录 */
export function heatLevel(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0
  const minutes = seconds / 60
  if (minutes < 25) return 1
  if (minutes < 60) return 2
  if (minutes < 120) return 3
  return 4
}

/**
 * 某年各月活跃天数（有专注记录的天数）。
 * 和 monthlySeconds 分开：柱状看时长，这里看「坚持了多少天」。
 */
export function monthlyActiveDays(
  statistics: readonly DayStatistic[],
  summary: Summary,
  year: number,
  now: number | Date = Date.now(),
): number[] {
  const days = Array.from({ length: 12 }, () => 0)
  const recorded = new Set<string>()

  for (const record of statistics) {
    if (record.year !== String(year)) continue
    if ((record.pomodoroTime || 0) <= 0) continue
    const index = Number(record.month) - 1
    if (index < 0 || index >= 12) continue
    days[index] = (days[index] ?? 0) + 1
    recorded.add(`${record.year}-${record.month}-${record.day}`)
  }

  // 今天未归档时补一天；已归档则上面已经算过，不能重复。
  const today = dayKeyOf(now)
  if (
    today.year === String(year) &&
    isSameDay(summary.update, now) &&
    (summary.todayTime || 0) > 0 &&
    !recorded.has(`${today.year}-${today.month}-${today.day}`)
  ) {
    const index = Number(today.month) - 1
    if (index >= 0 && index < 12) days[index] = (days[index] ?? 0) + 1
  }

  return days
}
