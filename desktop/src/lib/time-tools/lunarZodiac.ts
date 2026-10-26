import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import {
  animalOf,
  lunarLeapMonth,
  lunarMonthDays,
  lunarToSolar,
  lunarYearDays,
  solarToLunar,
} from './lunar'
import type { LunarZodiacInput, LunarZodiacOutput } from './lunarZodiac.schema'

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

const pad = (value: number): string => String(value).padStart(2, '0')

function todayCalendar(timestamp: number): LunarZodiacOutput['today'] {
  const now = new Date(timestamp)
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const lunar = solarToLunar(year, month, day)
  if (!lunar) {
    return {
      solar: `${year}-${pad(month)}-${pad(day)}`,
      solarText: `${year}年${month}月${day}日`,
      weekday: '',
      lunar: '',
      lunarDate: '',
      animal: '',
      ganZhi: '',
    }
  }
  return {
    solar: `${year}-${pad(month)}-${pad(day)}`,
    solarText: `${year}年${month}月${day}日（${lunar.animal}）`,
    weekday: lunar.weekday,
    lunar: lunar.fullText,
    lunarDate: `${lunar.year}年${lunar.isLeap ? '闰' : ''}${lunar.month}月${lunar.day}日`,
    animal: lunar.animal,
    ganZhi: `${lunar.ganZhiYear}年${lunar.ganZhiMonth}月${lunar.ganZhiDay}日`,
  }
}

export function execute(
  input: LunarZodiacInput,
  context: ToolExecutionContext,
): ToolResult<LunarZodiacOutput> {
  const start = lunarToSolar(input.year, 1, 1)
  const lastMonth = 12
  const lastDay = lunarMonthDays(input.year, lastMonth)
  const end = lunarToSolar(input.year, lastMonth, lastDay)
  if (!start || !end) return toolFail('INVALID_INPUT', '这个年份不在 1900–2100 的支持范围内')

  let reference = new Date(context.services.now?.() ?? Date.now()).getTime()
  const from = input.from?.trim()
  if (from) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from)
    const parsed = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : null
    if (
      !parsed ||
      parsed.getFullYear() !== Number(match![1]) ||
      parsed.getMonth() !== Number(match![2]) - 1 ||
      parsed.getDate() !== Number(match![3])
    ) {
      return toolFail('INVALID_INPUT', `参照日期不合法：${from}`)
    }
    reference = parsed.getTime()
  }

  return toolOk({
    year: input.year,
    animal: animalOf(input.year),
    ganZhi: `${GAN[((input.year - 4) % 10 + 10) % 10]}${ZHI[((input.year - 4) % 12 + 12) % 12]}`,
    branch: ZHI[((input.year - 4) % 12 + 12) % 12] ?? '',
    start: `${start.year}-${pad(start.month)}-${pad(start.day)}`,
    end: `${end.year}-${pad(end.month)}-${pad(end.day)}`,
    yearDays: lunarYearDays(input.year),
    leapMonth: lunarLeapMonth(input.year),
    today: todayCalendar(reference),
  })
}
