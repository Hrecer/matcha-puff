








import { LUNAR_INFO, TERM_INFO } from './lunarData'

export const MIN_YEAR = 1900
export const MAX_YEAR = 2100

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const DAY_PREFIX = ['初', '十', '廿', '卅']
const DAY_DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const YEAR_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

export const TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
]

export interface LunarDate {
  /** 农历年 */
  year: number
  /** 农历月，1–12 */
  month: number
  /** 农历日 */
  day: number
  /** 是否闰月 */
  isLeap: boolean
  /** 该月共几天 */
  monthDays: number
  /** 该农历年共几天 */
  yearDays: number
  /** 文字形式，如「正月初三」「闰四月十五」 */
  text: string
  /** 中文年月日，如「二〇二四年正月初三」 */
  fullText: string
  /** 生肖 */
  animal: string
  /** 干支纪年，如「甲辰」 */
  ganZhiYear: string
  /** 干支纪月 */
  ganZhiMonth: string
  /** 干支纪日 */
  ganZhiDay: string
  /** 中文星期，如「星期六」 */
  weekday: string
  /** 当天是否交节气 */
  term: string | null
}

const DAY_MS = 86_400_000

const inRange = (year: number): boolean => year >= MIN_YEAR && year <= MAX_YEAR

/** 农历某年总天数（含闰月） */
export function lunarYearDays(year: number): number {
  let sum = 348
  const info = LUNAR_INFO[year - MIN_YEAR] ?? 0
  for (let bit = 0x8000; bit > 0x8; bit >>= 1) {
    if (info & bit) sum += 1
  }
  return sum + lunarLeapDays(year)
}

/** 闰月月份，0 表示当年无闰月 */
export function lunarLeapMonth(year: number): number {
  return (LUNAR_INFO[year - MIN_YEAR] ?? 0) & 0xf
}

/** 闰月天数，无闰月返回 0 */
export function lunarLeapDays(year: number): number {
  if (!lunarLeapMonth(year)) return 0
  return (LUNAR_INFO[year - MIN_YEAR] ?? 0) & 0x10000 ? 30 : 29
}

/** 农历某年某月（不含闰月）的天数 */
export function lunarMonthDays(year: number, month: number): number {
  if (month < 1 || month > 12) return -1
  return (LUNAR_INFO[year - MIN_YEAR] ?? 0) & (0x10000 >> month) ? 30 : 29
}

const ganZhi = (index: number): string =>
  `${GAN[((index % 10) + 10) % 10]}${ZHI[((index % 12) + 12) % 12]}`

export function animalOf(year: number): string {
  return ANIMALS[(((year - 4) % 12) + 12) % 12] ?? ''
}

/** 公历某年第 index 个节气（1 = 小寒）落在几号 */
export function termDay(year: number, index: number): number {
  if (!inRange(year) || index < 1 || index > 24) return -1
  const code = TERM_INFO[year - MIN_YEAR] ?? ''
  const groups: string[] = []
  for (let i = 0; i < 6; i += 1) {
    groups.push(Number.parseInt(code.slice(i * 5, i * 5 + 5), 16).toString())
  }
  const days: string[] = []
  for (const group of groups) {
    days.push(group.slice(0, 1), group.slice(1, 3), group.slice(3, 4), group.slice(4, 6))
  }
  return Number.parseInt(days[index - 1] ?? '0', 10)
}

export interface SolarTermItem {
  index: number
  name: string
  month: number
  day: number
}

/** 某年 24 个节气及对应公历日期 */
export function solarTerms(year: number): SolarTermItem[] {
  if (!inRange(year)) return []
  return TERM_NAMES.map((name, position) => ({
    index: position + 1,
    name,
    month: Math.floor(position / 2) + 1,
    day: termDay(year, position + 1),
  }))
}

const termNameAt = (year: number, month: number, day: number): string | null => {
  const first = termDay(year, month * 2 - 1)
  const second = termDay(year, month * 2)
  if (first === day) return TERM_NAMES[month * 2 - 2] ?? null
  if (second === day) return TERM_NAMES[month * 2 - 1] ?? null
  return null
}

export const toLunarDayText = (day: number): string => {
  if (day === 10) return '初十'
  if (day === 20) return '二十'
  if (day === 30) return '三十'
  return `${DAY_PREFIX[Math.floor(day / 10)] ?? ''}${DAY_DIGITS[(day % 10) - 1] ?? ''}`
}

export const lunarMonthText = (month: number, isLeap: boolean): string =>
  `${isLeap ? '闰' : ''}${MONTH_NAMES[month - 1] ?? ''}月`

const toChineseYear = (year: number): string =>
  String(year)
    .split('')
    .map((digit) => YEAR_DIGITS[Number(digit)] ?? '')
    .join('')

const weekdayText = (date: Date): string => `星期${WEEKDAYS[date.getDay()] ?? ''}`

const daysSinceEpoch = (year: number, month: number, day: number): number =>
  (Date.UTC(year, month - 1, day) - Date.UTC(1900, 0, 31)) / DAY_MS

/** 公历 → 农历；超出 1900-01-31 至 2100-12-31 返回 null */
export function solarToLunar(year: number, month: number, day: number): LunarDate | null {
  if (!inRange(year)) return null
  if (year === MIN_YEAR && month === 1 && day < 31) return null
  const date = new Date(year, month - 1, day)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null

  let offset = daysSinceEpoch(year, month, day)
  let lunarYear = MIN_YEAR
  let yearLength = 0
  for (; lunarYear <= MAX_YEAR && offset > 0; lunarYear += 1) {
    yearLength = lunarYearDays(lunarYear)
    offset -= yearLength
  }
  if (offset < 0) {
    offset += yearLength
    lunarYear -= 1
  }

  const leap = lunarLeapMonth(lunarYear)
  let isLeap = false
  let lunarMonth = 1
  let monthLength = 0
  for (; lunarMonth < 13 && offset > 0; lunarMonth += 1) {
    if (leap > 0 && lunarMonth === leap + 1 && !isLeap) {
      lunarMonth -= 1
      isLeap = true
      monthLength = lunarLeapDays(lunarYear)
    } else {
      monthLength = lunarMonthDays(lunarYear, lunarMonth)
    }
    if (isLeap && lunarMonth === leap + 1) isLeap = false
    offset -= monthLength
  }

  if (offset === 0 && leap > 0 && lunarMonth === leap + 1) {
    if (isLeap) isLeap = false
    else {
      isLeap = true
      lunarMonth -= 1
    }
  }
  if (offset < 0) {
    offset += monthLength
    lunarMonth -= 1
  }

  const lunarDay = offset + 1
  const monthText = lunarMonthText(lunarMonth, isLeap)
  const dayText = toLunarDayText(lunarDay)

  // 干支年按立春切换
  const springDay = termDay(year, 3)
  let ganZhiYear = ganZhi(year - 4)
  if (new Date(year, month - 1, day).getTime() < new Date(year, 1, springDay).getTime()) {
    ganZhiYear = ganZhi(year - 5)
  }

  // 干支月按「节」切换
  const sectionDay = termDay(year, month * 2 - 1)
  let ganZhiMonth = ganZhi(12 * (year - MIN_YEAR) + month + 11)
  if (day >= sectionDay) ganZhiMonth = ganZhi(12 * (year - MIN_YEAR) + month + 12)

  // 干支日：以 1900-01-31 为甲辰日的固定偏移
  const dayIndex = daysSinceEpoch(year, month, day) + 40
  const ganZhiDay = ganZhi(dayIndex)

  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap,
    monthDays: isLeap ? lunarLeapDays(lunarYear) : lunarMonthDays(lunarYear, lunarMonth),
    yearDays: lunarYearDays(lunarYear),
    text: monthText + dayText,
    fullText: `${toChineseYear(lunarYear)}年${monthText}${dayText}`,
    animal: animalOf(lunarYear),
    ganZhiYear,
    ganZhiMonth,
    ganZhiDay,
    weekday: weekdayText(date),
    term: termNameAt(year, month, day),
  }
}

export interface SolarDate {
  year: number
  month: number
  day: number
  text: string
}

/** 农历 → 公历；闰月要显式指定 isLeap，非法日期返回 null */
export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  isLeap = false,
): SolarDate | null {
  if (!inRange(year) || month < 1 || month > 12) return null
  const leap = lunarLeapMonth(year)
  if (isLeap && leap !== month) return null
  const monthLength = isLeap ? lunarLeapDays(year) : lunarMonthDays(year, month)
  if (day < 1 || day > monthLength) return null
  if (year === MAX_YEAR && month === 12 && day > 1) return null

  let offset = 0
  for (let index = MIN_YEAR; index < year; index += 1) offset += lunarYearDays(index)

  // 逐月累加：每个正常月后面紧跟它的闰月
  for (let index = 1; index < month; index += 1) {
    offset += lunarMonthDays(year, index)
    if (leap > 0 && index === leap) offset += lunarLeapDays(year)
  }
  // 落在闰月里时，先补上同名的正常月
  if (isLeap) offset += lunarMonthDays(year, month)

  const date = new Date(Date.UTC(1900, 0, 31) + (offset + day - 1) * DAY_MS)
  const result = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
  if (!inRange(result.year)) return null
  return {
    ...result,
    text: `${result.year}-${String(result.month).padStart(2, '0')}-${String(result.day).padStart(2, '0')}`,
  }
}
