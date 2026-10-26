import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { parseDateTime, toDate } from '@matcha-puff/tools'
import { TIME_ZONES } from './timezones'
import type { ClockInput, ClockOutput } from './clock.schema'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const pad = (value: number): string => String(value).padStart(2, '0')

const dayNumber = (date: Date): number =>
  Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000)

export function execute(
  input: ClockInput,
  _context: ToolExecutionContext,
): ToolResult<ClockOutput> {
  const base = parseDateTime(input.base)
  if (!base) return toolFail('INVALID_INPUT', `时间格式不正确：${input.base}`)

  const stamp = toDate(base).getTime()
  // 基准日期取输入的本机墙上日期，而不是换算后的 UTC 日期，否则跨日徽标会算错
  const baseDay = Math.floor(Date.UTC(base.year, base.month - 1, base.day) / 86_400_000)

  const zones = TIME_ZONES.map((zone) => {
    // epoch 加上时区偏移后，用 UTC 字段读出来就是该时区的墙上时间
    const local = new Date(stamp + zone.offset * 3600_000)
    return {
      label: zone.label,
      offsetLabel: zone.offsetLabel,
      offset: zone.offset,
      places: zone.places,
      date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
      time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`,
      weekday: WEEKDAYS[local.getUTCDay()] ?? '',
      dayShift: dayNumber(local) - baseDay,
    }
  })

  const utc = new Date(stamp)
  return toolOk({
    baseUtc: `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())} ${pad(
      utc.getUTCHours(),
    )}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}`,
    zones,
  })
}
