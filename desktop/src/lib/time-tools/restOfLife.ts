import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { RestOfLifeInput, RestOfLifeOutput } from './restOfLife.schema'

const DAY_MS = 86_400_000
const pad = (value: number): string => String(value).padStart(2, '0')
const utc = (year: number, month: number, day: number): number => Date.UTC(year, month - 1, day)

const parseDate = (text: string): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const probe = new Date(utc(year, month, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null
  }
  return { year, month, day }
}

export function execute(
  input: RestOfLifeInput,
  _context: ToolExecutionContext,
): ToolResult<RestOfLifeOutput> {
  const birthday = parseDate(input.birthday)
  if (!birthday) return toolFail('INVALID_INPUT', `生日格式或日期不合法：${input.birthday}`)

  const now = new Date()
  const from = input.from?.trim() ? parseDate(input.from) : null
  if (input.from?.trim() && !from) {
    return toolFail('INVALID_INPUT', `参照日期不合法：${input.from}`)
  }
  const today = from ?? { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }

  const birthTime = utc(birthday.year, birthday.month, birthday.day)
  const todayTime = utc(today.year, today.month, today.day)
  if (todayTime < birthTime) {
    return toolFail('INVALID_INPUT', '生日还在参照日期之后，检查一下是不是填错了')
  }

  const endTime = utc(birthday.year + Math.round(input.lifeExpectancy), birthday.month, birthday.day)
  const daysLived = Math.round((todayTime - birthTime) / DAY_MS)
  const totalDays = Math.round((endTime - birthTime) / DAY_MS)
  const daysLeft = Math.max(0, totalDays - daysLived)
  const percentLived = Math.min(100, Math.round((daysLived / totalDays) * 1000) / 10)

  // 周岁：今年生日还没到就减一
  let age = today.year - birthday.year
  if (today.month < birthday.month || (today.month === birthday.month && today.day < birthday.day)) {
    age -= 1
  }

  // 下一个生日：今年还没过就今年，否则明年；2 月 29 日在平年退到 2 月 28
  let nextYear = today.year
  if (today.month > birthday.month || (today.month === birthday.month && today.day > birthday.day)) {
    nextYear += 1
  }
  let nextDate = utc(nextYear, birthday.month, birthday.day)
  if (new Date(nextDate).getUTCMonth() !== birthday.month - 1) {
    nextDate = utc(nextYear, birthday.month, Math.max(1, birthday.day - 1))
  }
  const nextDays = Math.round((nextDate - todayTime) / DAY_MS)
  const next = new Date(nextDate)

  return toolOk({
    birthday: `${birthday.year}-${pad(birthday.month)}-${pad(birthday.day)}`,
    today: `${today.year}-${pad(today.month)}-${pad(today.day)}`,
    age: Math.max(0, age),
    lifeExpectancy: Math.round(input.lifeExpectancy),

    yearsLived: Math.round(daysLived / 365),
    monthsLived: Math.round(daysLived / 30.5),
    weeksLived: Math.round(daysLived / 7),
    daysLived,
    hoursLived: daysLived * 24,
    minutesLived: daysLived * 24 * 60,
    daysLeft,
    weeksLeft: Math.floor(daysLeft / 7),
    percentLived,
    percentLeft: Math.round((100 - percentLived) * 10) / 10,
    nextBirthday: {
      date: `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`,
      days: nextDays,
    },
    weekendsLived: Math.floor(daysLived / 7) * 2,
  })
}
