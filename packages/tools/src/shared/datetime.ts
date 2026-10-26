








export interface DateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const pad = (value: number, size = 2): string => String(value).padStart(size, '0')

const DATE_RE =
  /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/

/** 解析 `YYYY-MM-DD[ HH:mm[:ss]]`（也接受 T 分隔与 / . 分隔），失败返回 null */
export function parseDateTime(text: string): DateTimeParts | null {
  const match = DATE_RE.exec(text.trim())
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match
  const parts: DateTimeParts = {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h ?? 0),
    minute: Number(mi ?? 0),
    second: Number(s ?? 0),
  }
  if (parts.month < 1 || parts.month > 12) return null
  if (parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) return null
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) return null
  return parts
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return table[month - 1] ?? 0
}

export function toDate(parts: DateTimeParts): Date {
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  )
}

export function fromDate(date: Date): DateTimeParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  }
}

export function formatDateTime(parts: DateTimeParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(
    parts.minute,
  )}:${pad(parts.second)}`
}

export function formatDate(parts: DateTimeParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

/** 加月：目标月没有该日时钳到当月最后一天 */
export function addMonths(parts: DateTimeParts, amount: number): DateTimeParts {
  const total = parts.year * 12 + (parts.month - 1) + amount
  const year = Math.floor(total / 12)
  const month = total - year * 12 + 1
  return {
    ...parts,
    year,
    month,
    day: Math.min(parts.day, daysInMonth(year, month)),
  }
}

export function addYears(parts: DateTimeParts, amount: number): DateTimeParts {
  return addMonths(parts, amount * 12)
}

export function addDays(parts: DateTimeParts, amount: number): DateTimeParts {
  const date = toDate(parts)
  date.setDate(date.getDate() + amount)
  return fromDate(date)
}

const trunc = (value: number): number => (value < 0 ? Math.ceil(value) : Math.floor(value))

export interface DiffParts {
  seconds: number
  minutes: number
  hours: number
  days: number
  weeks: number
  months: number
  years: number
}


export function diffBetween(start: DateTimeParts, end: DateTimeParts): DiffParts {
  const delta = toDate(end).getTime() - toDate(start).getTime()
  const seconds = trunc(delta / 1000)
  const months = fullMonths(start, end)
  return {
    seconds,
    minutes: trunc(delta / 60_000),
    hours: trunc(delta / 3_600_000),
    days: trunc(delta / 86_400_000),
    weeks: trunc(delta / (86_400_000 * 7)),
    months,
    years: trunc(months / 12),
  }
}

/** 满整月数：把起点加上 N 个月后仍不超过终点，N 就是答案 */
function fullMonths(start: DateTimeParts, end: DateTimeParts): number {
  let whole = (end.year - start.year) * 12 + (end.month - start.month)
  const anchor = toDate(addMonths(start, whole)).getTime()
  const endTime = toDate(end).getTime()
  if (endTime < anchor) whole -= 1
  return whole
}

/** 自然语言时长（用于「约 X 天 Y 小时」这类补充说明） */
export function humanizeDuration(seconds: number): string {
  const abs = Math.abs(seconds)
  const units: [number, string][] = [
    [31_536_000, '年'],
    [2_592_000, '个月'],
    [604_800, '周'],
    [86_400, '天'],
    [3600, '小时'],
    [60, '分钟'],
    [1, '秒'],
  ]
  const pieces: string[] = []
  let rest = abs
  for (const [size, label] of units) {
    if (rest >= size) {
      const count = Math.floor(rest / size)
      pieces.push(`${count} ${label}`)
      rest -= count * size
    }
    if (pieces.length === 3) break
  }
  if (!pieces.length) pieces.push('0 秒')
  return (seconds < 0 ? '早 ' : '') + pieces.join(' ')
}
