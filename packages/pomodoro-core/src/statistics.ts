import type { DayKey, DayStatistic, Summary } from './types'
import { pad2 } from './time'

export function dayKeyOf(input: number | Date): DayKey {
  const date = input instanceof Date ? input : new Date(input)
  return {
    year: String(date.getFullYear()),
    month: pad2(date.getMonth() + 1),
    day: pad2(date.getDate()),
  }
}

export function isSameDay(a: number | Date, b: number | Date): boolean {
  const left = dayKeyOf(a)
  const right = dayKeyOf(b)
  return left.year === right.year && left.month === right.month && left.day === right.day
}

export function sameDayKey(a: DayKey, b: DayKey): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

/**
 * 把 summary 的当天数据归档成一条日记录。
 * 幂等：同一天先移除再插入，重复调用不会产生两条。
 */
export function archiveDay(
  statistics: readonly DayStatistic[],
  summary: Summary,
  day: number | Date,
): DayStatistic[] {
  const key = dayKeyOf(day)
  return [
    ...statistics.filter((record) => !sameDayKey(record, key)),
    {
      ...key,
      pomodoroTime: summary.todayTime || 0,
      pomodoroCount: summary.todayPomodoro || 0,
      tasks: summary.todayTasks || [],
    },
  ]
}

export function findDayStatistic(
  statistics: readonly DayStatistic[],
  day: number | Date,
): DayStatistic | undefined {
  const key = dayKeyOf(day)
  return statistics.find((record) => sameDayKey(record, key))
}

/**
 * 某天的统计：今天尚未归档，直接读 summary 的实时值；其余读已归档记录。
 * summary.update 必须也属于今天，避免把过期的实时值当成今天。
 */
export function statisticOfDay(
  statistics: readonly DayStatistic[],
  summary: Summary,
  day: number | Date,
  now: number | Date = Date.now(),
): DayStatistic | undefined {
  const key = dayKeyOf(day)
  const live = isSameDay(summary.update, now) && isSameDay(day, now)
  if (live) {
    return {
      ...key,
      pomodoroTime: summary.todayTime || 0,
      pomodoroCount: summary.todayPomodoro || 0,
      tasks: summary.todayTasks || [],
    }
  }
  return findDayStatistic(statistics, day)
}

/** 某年 12 个月的专注秒数合计（按年份过滤，跨年不混） */
export function monthlySeconds(statistics: readonly DayStatistic[], year: string): number[] {
  const months = Array.from({ length: 12 }, () => 0)
  for (const record of statistics) {
    if (record.year !== year) continue
    const index = Number(record.month) - 1
    if (index >= 0 && index < 12) {
      months[index] = (months[index] ?? 0) + (record.pomodoroTime || 0)
    }
  }
  return months
}

/** 月度图：把今天尚未归档的秒数补进当月，否则当月永远少算今天 */
export function monthlySecondsWithToday(
  statistics: readonly DayStatistic[],
  summary: Summary,
  year: string,
  now: number | Date = Date.now(),
): number[] {
  const months = monthlySeconds(statistics, year)
  if (dayKeyOf(now).year !== year || !isSameDay(summary.update, now)) return months
  const index = Number(dayKeyOf(now).month) - 1
  if (index >= 0 && index < 12) {
    months[index] = (months[index] ?? 0) + (summary.todayTime || 0)
  }
  return months
}

/** 今日清零：三项今日量必须一起清零（漏掉 todayTime 会让饼图出现负扇区） */
export function resetToday(summary: Summary, now = Date.now()): Summary {
  return {
    ...summary,
    todayPomodoro: 0,
    todayTasks: [],
    todayTime: 0,
    update: now,
  }
}
