import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { diffBetween, formatDateTime, humanizeDuration, parseDateTime } from '@matcha-puff/tools'
import { solarToLunar } from './lunar'
import type { TimeDiffInput, TimeDiffOutput } from './timeDiff.schema'

export function execute(
  input: TimeDiffInput,
  _context: ToolExecutionContext,
): ToolResult<TimeDiffOutput> {
  const start = parseDateTime(input.start)
  const end = parseDateTime(input.end)
  if (!start) return toolFail('INVALID_INPUT', `起始时间格式不正确：${input.start}`)
  if (!end) return toolFail('INVALID_INPUT', `结束时间格式不正确：${input.end}`)

  const diff = diffBetween(start, end)
  const rows: TimeDiffOutput['rows'] = [
    { unit: 'second', label: '秒', value: diff.seconds, text: `${diff.seconds} 秒` },
    { unit: 'minute', label: '分', value: diff.minutes, text: `${diff.minutes} 分` },
    { unit: 'hour', label: '小时', value: diff.hours, text: `${diff.hours} 小时` },
    { unit: 'day', label: '天', value: diff.days, text: `${diff.days} 天` },
    { unit: 'week', label: '周', value: diff.weeks, text: `${diff.weeks} 周` },
    { unit: 'month', label: '月', value: diff.months, text: `${diff.months} 月` },
    { unit: 'year', label: '年', value: diff.years, text: `${diff.years} 年` },
  ]

  const startLunar = solarToLunar(start.year, start.month, start.day)
  const endLunar = solarToLunar(end.year, end.month, end.day)

  return toolOk({
    rows,
    humanized: humanizeDuration(diff.seconds),
    direction: diff.seconds === 0 ? 'same' : diff.seconds > 0 ? 'future' : 'past',
    startText: formatDateTime(start),
    endText: formatDateTime(end),
    startLunar: startLunar
      ? {
          text: startLunar.text,
          fullText: startLunar.fullText,
          animal: startLunar.animal,
          ganZhiYear: startLunar.ganZhiYear,
          ganZhiMonth: startLunar.ganZhiMonth,
          ganZhiDay: startLunar.ganZhiDay,
          isLeap: startLunar.isLeap,
          monthDays: startLunar.monthDays,
          term: startLunar.term,
        }
      : null,
    endLunar: endLunar
      ? {
          text: endLunar.text,
          fullText: endLunar.fullText,
          animal: endLunar.animal,
          ganZhiYear: endLunar.ganZhiYear,
          ganZhiMonth: endLunar.ganZhiMonth,
          ganZhiDay: endLunar.ganZhiDay,
          isLeap: endLunar.isLeap,
          monthDays: endLunar.monthDays,
          term: endLunar.term,
        }
      : null,
  })
}
