import {
  animalOf,
  lunarLeapMonth,
  lunarMonthDays,
  lunarMonthText,
  lunarToSolar,
  lunarYearDays,
  solarToLunar,
  toLunarDayText,
  type LunarDate,
} from './time-tools/lunar'

export type CalendarView = 'day' | 'week' | 'month' | 'year'

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const
export const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const

export const CALENDAR_MIN_MS = new Date(1900, 0, 31).getTime()
export const CALENDAR_MAX_MS = new Date(2100, 11, 31).getTime()

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

const pad = (value: number): string => String(value).padStart(2, '0')

export const startOfDay = (input: Date | number): Date => {
  const date = new Date(input)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export const addDays = (date: Date, delta: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta)

export const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex + 1, 0).getDate()

export const addMonths = (date: Date, delta: number): Date => {
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1)
  const day = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()))
  return new Date(target.getFullYear(), target.getMonth(), day)
}

export const addYears = (date: Date, delta: number): Date => addMonths(date, delta * 12)

/** 周一为一周第一天 */
export const startOfWeek = (date: Date): Date =>
  addDays(startOfDay(date), -((date.getDay() + 6) % 7))

export const weekOf = (date: Date): Date[] => {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/** 月视图固定 6 行 42 格，跨月那几天也保留，方便整块翻页 */
export const monthGrid = (year: number, monthIndex: number): Date[] => {
  const start = startOfWeek(new Date(year, monthIndex, 1))
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const formatSolarDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const weekdayShort = (date: Date): string =>
  `周${WEEKDAY_LABELS[(date.getDay() + 6) % 7] ?? ''}`

export const weekdayLong = (date: Date): string => WEEKDAY_NAMES[date.getDay()] ?? ''

export const isInCalendarRange = (date: Date): boolean => {
  const ms = startOfDay(date).getTime()
  return ms >= CALENDAR_MIN_MS && ms <= CALENDAR_MAX_MS
}

export const clampToCalendar = (date: Date): Date => {
  const day = startOfDay(date)
  if (day.getTime() < CALENDAR_MIN_MS) return startOfDay(CALENDAR_MIN_MS)
  if (day.getTime() > CALENDAR_MAX_MS) return startOfDay(CALENDAR_MAX_MS)
  return day
}

/** ISO 周序号（周一为首日，跨年周按 ISO 口径归年） */
export const isoWeek = (date: Date): number => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

const lunarCache = new Map<string, LunarDate | null>()

export const lunarOf = (date: Date): LunarDate | null => {
  const key = dateKey(date)
  if (!lunarCache.has(key)) {
    lunarCache.set(key, solarToLunar(date.getFullYear(), date.getMonth() + 1, date.getDate()))
  }
  return lunarCache.get(key) ?? null
}

/** 月历格子里的一句话：节气优先，其次初一显示月名，其余显示农历日 */
export const lunarCellLabel = (lunar: LunarDate): string => {
  if (lunar.term) return lunar.term
  if (lunar.day === 1) return lunarMonthText(lunar.month, lunar.isLeap)
  return toLunarDayText(lunar.day)
}

export const ganZhiOfYear = (year: number): string =>
  `${GAN[(((year - 4) % 10) + 10) % 10]}${ZHI[(((year - 4) % 12) + 12) % 12]}`

export interface LunarYearInfo {
  year: number
  animal: string
  ganZhi: string
  branch: string
  start: Date | null
  end: Date | null
  startText: string
  endText: string
  yearDays: number
  leapMonth: number
}

/** 农历年整年信息：正月初一到除夕，用于年视图 */
export const lunarYearInfo = (year: number): LunarYearInfo => {
  const start = lunarToSolar(year, 1, 1, false)
  const end = lunarToSolar(year, 12, lunarMonthDays(year, 12), false)
  const startDate = start ? new Date(start.year, start.month - 1, start.day) : null
  const endDate = end ? new Date(end.year, end.month - 1, end.day) : null
  return {
    year,
    animal: animalOf(year),
    ganZhi: ganZhiOfYear(year),
    branch: ZHI[(((year - 4) % 12) + 12) % 12] ?? '',
    start: startDate,
    end: endDate,
    startText: startDate ? formatSolarDate(startDate) : '—',
    endText: endDate ? formatSolarDate(endDate) : '—',
    yearDays: lunarYearDays(year),
    leapMonth: lunarLeapMonth(year),
  }
}

/**
 * 翻页步长：月视图单箭头翻月、双箭头翻年；周视图单箭头翻周、双箭头翻月；
 * 日视图单箭头翻天、双箭头翻月；年视图单箭头翻年、双箭头翻十年。
 */
export const stepCursor = (
  cursor: Date,
  view: CalendarView,
  direction: -1 | 1,
  big: boolean,
): Date => {
  let next: Date
  if (view === 'month') next = big ? addYears(cursor, direction) : addMonths(cursor, direction)
  else if (view === 'week') next = big ? addMonths(cursor, direction) : addDays(cursor, 7 * direction)
  else if (view === 'day') next = big ? addMonths(cursor, direction) : addDays(cursor, direction)
  else next = addYears(cursor, big ? direction * 10 : direction)
  return clampToCalendar(next)
}
