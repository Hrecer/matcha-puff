import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import {
  lunarLeapDays,
  lunarLeapMonth,
  lunarMonthDays,
  lunarToSolar,
  solarToLunar,
} from './lunar'
import type { LunarDate } from './lunar'
import type { LunarConvertInput, LunarConvertOutput } from './lunarConvert.schema'

const toOutput = (
  direction: LunarConvertOutput['direction'],
  solar: { year: number; month: number; day: number; weekday: string },
  lunar: LunarDate,
): LunarConvertOutput => ({
  direction,
  solar: {
    ...solar,
    text: `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}`,
  },
  lunar: {
    year: lunar.year,
    month: lunar.month,
    day: lunar.day,
    isLeap: lunar.isLeap,
    text: lunar.text,
    fullText: lunar.fullText,
    monthDays: lunar.monthDays,
    yearDays: lunar.yearDays,
    animal: lunar.animal,
    ganZhiYear: lunar.ganZhiYear,
    ganZhiMonth: lunar.ganZhiMonth,
    ganZhiDay: lunar.ganZhiDay,
    term: lunar.term,
  },
})

export function execute(
  input: LunarConvertInput,
  _context: ToolExecutionContext,
): ToolResult<LunarConvertOutput> {
  if (input.direction === 'solar2lunar') {
    const lunar = solarToLunar(input.year, input.month, input.day)
    if (!lunar) {
      return toolFail(
        'INVALID_INPUT',
        `${input.year}-${input.month}-${input.day} 不是有效公历日期（支持 1900-01-31 至 2100-12-31）`,
      )
    }
    return toolOk(
      toOutput(
        'solar2lunar',
        {
          year: input.year,
          month: input.month,
          day: input.day,
          weekday: lunar.weekday,
        },
        lunar,
      ),
    )
  }

  const leap = lunarLeapMonth(input.year)
  if (input.isLeap && leap !== input.month) {
    return toolFail(
      'INVALID_INPUT',
      leap
        ? `${input.year} 年闰的是 ${leap} 月，没有闰 ${input.month} 月`
        : `${input.year} 年没有闰月`,
    )
  }
  const monthLength = input.isLeap
    ? lunarLeapDays(input.year)
    : lunarMonthDays(input.year, input.month)
  if (input.day > monthLength) {
    return toolFail('INVALID_INPUT', `农历 ${input.month} 月只有 ${monthLength} 天`)
  }

  const solar = lunarToSolar(input.year, input.month, input.day, input.isLeap)
  if (!solar) {
    return toolFail('INVALID_INPUT', '这个农历日期不在 1900–2100 的支持范围内')
  }
  const lunar = solarToLunar(solar.year, solar.month, solar.day)
  if (!lunar) return toolFail('INVALID_INPUT', '换算结果超出支持范围')
  return toolOk(
    toOutput(
      'lunar2solar',
      { year: solar.year, month: solar.month, day: solar.day, weekday: lunar.weekday },
      lunar,
    ),
  )
}
