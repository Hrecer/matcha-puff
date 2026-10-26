import type { HabitSchedule } from './types'

const DAY_MS = 86_400_000

const WEEKDAY_CYCLE: Partial<Record<HabitSchedule['cycle'], number>> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

const startOfDay = (input: number | Date): Date => {
  const date = input instanceof Date ? new Date(input) : new Date(input)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const dayDiff = (later: Date, earlier: Date): number =>
  Math.round(
    (Date.UTC(later.getFullYear(), later.getMonth(), later.getDate()) -
      Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())) /
      DAY_MS,
  )

export interface TaskCountdown {
  state: 'upcoming' | 'today' | 'overdue'
  /** 距离目标日还有几天；今天为 0，逾期为已过天数 */
  days: number
  text: string
}

/** 工作日 / 法定节假日倒数需要的单日上下文（结构上等价于 core 的 DayContext） */
export interface HabitDayContext {
  workday: boolean
  statutoryHoliday: boolean
}

export type DayContextResolver = (date: Date) => HabitDayContext

/** 任务结束日是「当天有效」：当天显示今天截止，次日才进入逾期 */
export function taskCountdown(endDate: number, now = Date.now()): TaskCountdown | null {
  if (!Number.isFinite(endDate) || endDate <= 0) return null
  const target = startOfDay(endDate)
  const today = startOfDay(now)
  const distance = dayDiff(target, today)
  if (distance < 0) {
    const days = -distance
    return { state: 'overdue', days, text: `逾期 ${days} 天` }
  }
  if (distance === 0) return { state: 'today', days: 0, text: '今天截止' }
  return { state: 'upcoming', days: distance, text: `剩 ${distance} 天` }
}

const annualDayOf = (year: number, month: number, day: number): number =>
  Math.min(day, new Date(year, month, 0).getDate())

const validAnnual = (schedule: HabitSchedule): boolean =>
  schedule.anchorMonth !== undefined &&
  schedule.anchorDay !== undefined &&
  schedule.anchorMonth >= 1 &&
  schedule.anchorMonth <= 12 &&
  schedule.anchorDay >= 1 &&
  schedule.anchorDay <= 31

/** 下一次同月同日；今年已过则取明年，2 月 29 日在平年按 2 月 28 日 */
export function nextAnnualDate(month: number, day: number, from = new Date()): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const today = startOfDay(from)
  const year = today.getFullYear()
  const thisYear = new Date(year, month - 1, annualDayOf(year, month, day))
  if (thisYear.getTime() >= today.getTime()) return thisYear
  return new Date(year + 1, month - 1, annualDayOf(year + 1, month, day))
}

/**
 * 下一次执行日（含今天）。
 * 工作日 / 法定节假日依赖节假日表：调用方传入 dayContextOf 时按真实日历向后扫描，
 * 没传才返回 null（纯函数本身不假设周一至周五）。
 */
export function nextHabitDueDate(
  schedule: HabitSchedule,
  from = new Date(),
  dayContextOf?: DayContextResolver,
): Date | null {
  const today = startOfDay(from)
  const cycle = schedule.cycle
  if (cycle === 'daily') return today
  if (cycle === 'workday' || cycle === 'holiday') {
    if (!dayContextOf) return null
    // 一年多一点足够跨过春节/国庆，也能覆盖下一年的法定节假日
    for (let offset = 0; offset <= 400; offset += 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
      const context = dayContextOf(date)
      if (cycle === 'workday' ? context.workday : context.statutoryHoliday) return date
    }
    return null
  }
  if (cycle === 'monthStart') {
    return today.getDate() === 1 ? today : new Date(today.getFullYear(), today.getMonth() + 1, 1)
  }
  if (cycle === 'monthEnd') {
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return today.getDate() === last.getDate() ? today : last
  }
  if (cycle === 'yearly') {
    if (!validAnnual(schedule)) return null
    return nextAnnualDate(schedule.anchorMonth!, schedule.anchorDay!, today)
  }
  const targetDay = WEEKDAY_CYCLE[cycle]
  if (targetDay === undefined) return null
  const offset = (targetDay - today.getDay() + 7) % 7
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
}

/** 习惯卡周期徽章上的倒计时；每天不显示（永远今天/明天），其余按日历计算 */
export function habitCountdownText(
  schedule: HabitSchedule,
  from = new Date(),
  dayContextOf?: DayContextResolver,
): string | null {
  if (schedule.cycle === 'daily') return null
  const next = nextHabitDueDate(schedule, from, dayContextOf)
  if (!next) return null
  const days = dayDiff(next, startOfDay(from))
  if (days <= 0) return '今天'
  if (days === 1) return '明天'
  return `${days}天后`
}
