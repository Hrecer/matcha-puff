import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { solarTerms, solarToLunar } from './lunar'
import type { SolarCalendar, SolarTermDetail, SolarTermInput, SolarTermOutput } from './solarTerm.schema'

const pad = (value: number): string => String(value).padStart(2, '0')

/** 节气按农历季节划分：立春到谷雨为春，立夏到大暑为夏，立秋到霜降为秋，立冬到大寒为冬 */
const seasonOf = (index: number): string => {
  if (index === 1 || index === 2) return '冬'
  if (index >= 3 && index <= 8) return '春'
  if (index >= 9 && index <= 14) return '夏'
  if (index >= 15 && index <= 20) return '秋'
  return '冬'
}

/** 农历数字日期，闰月加「闰」 */
const lunarNumeric = (year: number, isLeap: boolean, month: number, day: number): string =>
  `${year}年${isLeap ? '闰' : ''}${month}月${day}日`

/** 公历某天的今日日历信息 */
function calendarOf(year: number, month: number, day: number): SolarCalendar | null {
  const lunar = solarToLunar(year, month, day)
  if (!lunar) return null
  return {
    solar: `${year}-${pad(month)}-${pad(day)}`,
    solarText: `${year}年${month}月${day}日（${lunar.animal}）`,
    weekday: lunar.weekday,
    lunar: lunar.fullText,
    lunarDate: lunarNumeric(lunar.year, lunar.isLeap, lunar.month, lunar.day),
    animal: lunar.animal,
    ganZhi: `${lunar.ganZhiYear}年${lunar.ganZhiMonth}月${lunar.ganZhiDay}日`,
  }
}

/** 选中节气的六项详情 */
function detailOf(year: number, month: number, day: number): SolarTermDetail | null {
  const lunar = solarToLunar(year, month, day)
  if (!lunar) return null
  return {
    solarDate: `${year}年${month}月${day}日`,
    lunarDate: lunarNumeric(lunar.year, lunar.isLeap, lunar.month, lunar.day),
    chineseLunar: lunar.fullText,
    animal: lunar.animal,
    ganZhi: `${lunar.ganZhiYear}年${lunar.ganZhiMonth}月${lunar.ganZhiDay}日`,
    weekday: lunar.weekday,
  }
}

const localDate = (timestamp: number): { year: number; month: number; day: number } => {
  const date = new Date(timestamp)
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

export function execute(
  input: SolarTermInput,
  context: ToolExecutionContext,
): ToolResult<SolarTermOutput> {
  const terms = solarTerms(input.year).map((item) => ({
    ...item,
    date: `${input.year}-${pad(item.month)}-${pad(item.day)}`,
    season: seasonOf(item.index),
  }))
  const selected = input.term ? (terms[input.term - 1] ?? null) : null
  const today = localDate(context.services.now?.() ?? Date.now())

  return toolOk({
    year: input.year,
    terms,
    selected,
    selectedDetail: selected ? detailOf(input.year, selected.month, selected.day) : null,
    today: calendarOf(today.year, today.month, today.day) ?? {
      solar: `${today.year}-${pad(today.month)}-${pad(today.day)}`,
      solarText: `${today.year}年${today.month}月${today.day}日`,
      weekday: '',
      lunar: '',
      lunarDate: '',
      animal: '',
      ganZhi: '',
    },
  })
}
