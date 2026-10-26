import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { lunarToSolar, solarTerms } from './lunar'
import type { HolidayInput, HolidayOutput } from './holidayCountdown.schema'

const DAY_MS = 86_400_000
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const pad = (value: number): string => String(value).padStart(2, '0')

const toText = (date: { year: number; month: number; day: number }): string =>
  `${date.year}-${pad(date.month)}-${pad(date.day)}`

/** 只比较年月日，避免时分秒影响天数 */
const dateOnly = (year: number, month: number, day: number): number =>
  Date.UTC(year, month - 1, day)

const diffDays = (later: number, earlier: number): number => Math.round((later - earlier) / DAY_MS)

interface HolidayDef {
  name: string
  daysOff: number
  /** 返回公历月日，算不出来就给 null */
  resolve: (year: number) => { month: number; day: number; basis: string } | null
}

/** 农历节日统一走 lunarToSolar，ISO 日期由 lunar 模块算好 */
const lunarHoliday = (
  name: string,
  month: number,
  day: number,
  daysOff: number,
  basis: string,
): HolidayDef => ({
  name,
  daysOff,
  resolve: (year) => {
    const solar = lunarToSolar(year, month, day)
    return solar ? { month: solar.month, day: solar.day, basis: `${basis}（${solar.text}）` } : null
  },
})

const HOLIDAYS: HolidayDef[] = [
  {
    name: '元旦',
    daysOff: 1,
    resolve: () => ({ month: 1, day: 1, basis: '公历 1 月 1 日' }),
  },
  lunarHoliday('春节', 1, 1, 3, '农历正月初一'),
  {
    name: '清明节',
    daysOff: 1,
    resolve: (year) => {
      const term = solarTerms(year).find((item) => item.name === '清明')
      return term ? { month: term.month, day: term.day, basis: '清明节气当日' } : null
    },
  },
  {
    name: '劳动节',
    daysOff: 1,
    resolve: () => ({ month: 5, day: 1, basis: '公历 5 月 1 日' }),
  },
  lunarHoliday('端午节', 5, 5, 1, '农历五月初五'),
  lunarHoliday('中秋节', 8, 15, 1, '农历八月十五'),
  {
    name: '国庆节',
    daysOff: 3,
    resolve: () => ({ month: 10, day: 1, basis: '公历 10 月 1 日' }),
  },
]

interface OfficialRange {
  name: string
  start: [number, number, number]
  end: [number, number, number]
  daysOff: number
  makeup: string
  rangeText: string
}

export interface StatutoryHoliday {
  name: string
  month: number
  day: number
  daysOff: number
  basis: string
}

/** 七个法定节日的公历落点 + 法定天数；日历与假期清单共用这一份定义 */
export function statutoryHolidaysOfYear(year: number): StatutoryHoliday[] {
  const items: StatutoryHoliday[] = []
  for (const holiday of HOLIDAYS) {
    const resolved = holiday.resolve(year)
    if (!resolved) continue
    items.push({
      name: holiday.name,
      month: resolved.month,
      day: resolved.day,
      daysOff: holiday.daysOff,
      basis: resolved.basis,
    })
  }
  return items
}

const OFFICIAL_RANGES: Record<number, OfficialRange[]> = {
  2024: [
    { name: '元旦', start: [2023, 12, 30], end: [2024, 1, 1], daysOff: 3, makeup: '无调休', rangeText: '12月30日~1月1日' },
    { name: '春节', start: [2024, 2, 10], end: [2024, 2, 17], daysOff: 8, makeup: '2月4日(周日)、2月18日(周六)上班', rangeText: '2月10日~2月17日' },
    { name: '清明节', start: [2024, 4, 4], end: [2024, 4, 6], daysOff: 3, makeup: '4月7日(周日)上班', rangeText: '4月4日~4月6日' },
    { name: '劳动节', start: [2024, 5, 1], end: [2024, 5, 5], daysOff: 5, makeup: '4月28日(周日)、5月11日(周六)上班', rangeText: '5月1日~5月5日' },
    { name: '端午节', start: [2024, 6, 8], end: [2024, 6, 10], daysOff: 3, makeup: '无调休', rangeText: '6月8日~6月10日' },
    { name: '中秋节', start: [2024, 9, 15], end: [2024, 9, 17], daysOff: 3, makeup: '9月14日(周六)上班', rangeText: '9月15日~9月17日' },
    { name: '国庆节', start: [2024, 10, 1], end: [2024, 10, 7], daysOff: 7, makeup: '9月29日(周日)、10月12日(周六)上班', rangeText: '10月1日~10月7日' },
  ],
}

export function execute(
  input: HolidayInput,
  _context: ToolExecutionContext,
): ToolResult<HolidayOutput> {
  const now = new Date()
  const refMatch = input.from ? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input.from.trim()) : null
  if (input.from && input.from.trim() && !refMatch) {
    return toolFail('INVALID_INPUT', `日期格式不对：${input.from}，应为 YYYY-MM-DD`)
  }
  const refYear = refMatch ? Number(refMatch[1]) : now.getFullYear()
  const refMonth = refMatch ? Number(refMatch[2]) : now.getMonth() + 1
  const refDay = refMatch ? Number(refMatch[3]) : now.getDate()
  const refTime = dateOnly(refYear, refMonth, refDay)

  const year = input.year && input.year > 0 ? input.year : refYear
  if (year < 1900 || year > 2100) {
    return toolFail('INVALID_INPUT', '年份需要在 1900–2100 之间')
  }

  const official = OFFICIAL_RANGES[year]
  const items: HolidayOutput['items'] = []
  if (official) {
    for (const range of official) {
      const [startYear, startMonth, startDay] = range.start
      const [endYear, endMonth, endDay] = range.end
      const target = dateOnly(startYear, startMonth, startDay)
      const days = diffDays(target, refTime)
      const weekday = new Date(target).getUTCDay()
      items.push({
        name: range.name,
        date: toText({ year: startYear, month: startMonth, day: startDay }),
        weekday: `星期${WEEKDAYS[weekday] ?? ''}`,
        days,
        isPast: days < 0,
        daysOff: range.daysOff,
        basis: `${year} 年官方放假安排`,
        startDate: toText({ year: startYear, month: startMonth, day: startDay }),
        endDate: toText({ year: endYear, month: endMonth, day: endDay }),
        rangeText: range.rangeText,
        makeup: range.makeup,
      })
    }
  } else {
    for (const holiday of statutoryHolidaysOfYear(year)) {
      const target = dateOnly(year, holiday.month, holiday.day)
      const days = diffDays(target, refTime)
      const weekday = new Date(target).getUTCDay()
      items.push({
        name: holiday.name,
        date: toText({ year, month: holiday.month, day: holiday.day }),
        weekday: `星期${WEEKDAYS[weekday] ?? ''}`,
        days,
        isPast: days < 0,
        daysOff: holiday.daysOff,
        basis: holiday.basis,
      })
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = items.filter((item) => item.days >= 0)
  const next =
    upcoming.length > 0
      ? { name: upcoming[0]!.name, date: upcoming[0]!.date, days: upcoming[0]!.days }
      : null

  const yearStart = Date.UTC(refYear, 0, 1)
  const yearEnd = Date.UTC(refYear + 1, 0, 1)
  const yearProgress = Math.min(100, Math.max(0, Math.round(((refTime - yearStart) / (yearEnd - yearStart)) * 1000) / 10))
  const holidayStarts = items.map((item) => Date.parse(`${item.date}T00:00:00Z`))
  const passed = holidayStarts.filter((time) => Number.isFinite(time) && time <= refTime).length
  const vacationProgress = items.length ? Math.round((passed / items.length) * 1000) / 10 : 0

  return toolOk({
    year,
    today: toText({ year: refYear, month: refMonth, day: refDay }),
    next,
    items,
    note: official
      ? '采用内置的 2024 年官方放假安排；其他年份只算法定节假日当天，实际调休以国务院办公厅通知为准。'
      : '这里只算法定节假日当天，实际放假与调休以国务院办公厅当年通知为准。',
    yearProgress,
    vacationProgress,
    hasOfficialRanges: Boolean(official),
  })
}
