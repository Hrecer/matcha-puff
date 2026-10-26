import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import {
  addDays,
  addMonths,
  addYears,
  formatDate,
  formatDateTime,
  fromDate,
  parseDateTime,
  toDate,
} from '@matcha-puff/tools'
import type { DateTimeParts } from '@matcha-puff/tools'
import { solarToLunar } from './lunar'
import type { TimeCalcInput, TimeCalcOutput } from './timeCalc.schema'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const UNIT_LABELS: Record<TimeCalcInput['unit'], string> = {
  year: '年',
  month: '个月',
  day: '天',
  hour: '小时',
  minute: '分钟',
}

/** 时、分用毫秒推进，避免 Date 的月份溢出行为混进来 */
function shiftByTime(parts: DateTimeParts, minutes: number): DateTimeParts {
  const date = toDate(parts)
  date.setTime(date.getTime() + minutes * 60_000)
  return fromDate(date)
}

/** 页面里的间隔输入还允许「秒」；工具入口维持原有五种单位 */
export type ShiftUnit = TimeCalcInput['unit'] | 'second'

/** 按单位推进指定时间；页面里的正反向推算与工具入口共用同一套规则 */
export function shiftDateTime(
  base: DateTimeParts,
  amount: number,
  unit: ShiftUnit,
): DateTimeParts {
  switch (unit) {
    case 'year':
      return addYears(base, amount)
    case 'month':
      return addMonths(base, amount)
    case 'day':
      return addDays(base, amount)
    case 'hour':
      return shiftByTime(base, amount * 60)
    case 'minute':
      return shiftByTime(base, amount)
    case 'second': {
      const date = toDate(base)
      date.setSeconds(date.getSeconds() + amount)
      return fromDate(date)
    }
  }
}

export function execute(
  input: TimeCalcInput,
  _context: ToolExecutionContext,
): ToolResult<TimeCalcOutput> {
  const base = parseDateTime(input.base)
  if (!base) return toolFail('INVALID_INPUT', `时间格式不正确：${input.base}`)

  const target = shiftDateTime(base, input.amount, input.unit)

  const weekday = WEEKDAYS[toDate(target).getDay()] ?? ''
  const direction = input.amount === 0 ? '不推算' : input.amount > 0 ? '之后' : '之前'
  const summary =
    input.amount === 0
      ? `${formatDateTime(base)}（未改动）`
      : `${formatDateTime(base)} 的 ${Math.abs(input.amount)} ${UNIT_LABELS[input.unit]}${direction}`

  const lunar = solarToLunar(target.year, target.month, target.day)

  return toolOk({
    result: formatDateTime(target),
    date: formatDate(target),
    time: `${String(target.hour).padStart(2, '0')}:${String(target.minute).padStart(2, '0')}:${String(
      target.second,
    ).padStart(2, '0')}`,
    weekday,
    summary,
    lunar: lunar
      ? {
          text: lunar.text,
          fullText: lunar.fullText,
          animal: lunar.animal,
          ganZhiYear: lunar.ganZhiYear,
          ganZhiMonth: lunar.ganZhiMonth,
          ganZhiDay: lunar.ganZhiDay,
          isLeap: lunar.isLeap,
          monthDays: lunar.monthDays,
          term: lunar.term,
        }
      : null,
  })
}
