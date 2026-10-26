import { describe, expect, it } from 'vitest'
import {
  habitCountdownText,
  nextAnnualDate,
  nextHabitDueDate,
  taskCountdown,
} from './countdown'

const at = (year: number, month: number, day: number, hour = 12): Date =>
  new Date(year, month - 1, day, hour)

const dateText = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

describe('taskCountdown', () => {
  it('未来按自然日算剩余天数', () => {
    expect(taskCountdown(at(2026, 10, 31).getTime(), at(2026, 10, 25).getTime())).toEqual({
      state: 'upcoming',
      days: 6,
      text: '剩 6 天',
    })
  })

  it('结束日当天显示今天截止，次日才逾期', () => {
    expect(taskCountdown(at(2026, 10, 25).getTime(), at(2026, 10, 25, 23).getTime())?.text).toBe(
      '今天截止',
    )
    expect(taskCountdown(at(2026, 10, 25).getTime(), at(2026, 10, 26, 1).getTime())).toEqual({
      state: 'overdue',
      days: 1,
      text: '逾期 1 天',
    })
  })

  it('没有结束日期不产生倒数', () => {
    expect(taskCountdown(0, at(2026, 10, 25).getTime())).toBeNull()
  })
})

describe('nextAnnualDate', () => {
  it('今年未到取今年，已过取明年', () => {
    expect(dateText(nextAnnualDate(3, 1, at(2026, 2, 10))!)).toBe('2026-03-01')
    expect(dateText(nextAnnualDate(2, 10, at(2026, 2, 10))!)).toBe('2026-02-10')
    expect(dateText(nextAnnualDate(2, 9, at(2026, 2, 10))!)).toBe('2027-02-09')
  })

  it('2 月 29 日平年退到 2 月 28 日', () => {
    expect(dateText(nextAnnualDate(2, 29, at(2025, 3, 1))!)).toBe('2026-02-28')
    expect(dateText(nextAnnualDate(2, 29, at(2027, 3, 1))!)).toBe('2028-02-29')
  })
})

describe('nextHabitDueDate / habitCountdownText', () => {
  it('每周几取含今天在内的最近一天', () => {
    const monday = at(2026, 10, 19)
    const wednesday = { cycle: 'wed' as const }
    const next = nextHabitDueDate(wednesday, monday)
    expect(dateText(next!)).toBe('2026-10-21')
    expect(habitCountdownText(wednesday, monday)).toBe('2天后')
  })

  it('每月首末与年度周期', () => {
    const from = at(2026, 10, 25)
    expect(dateText(nextHabitDueDate({ cycle: 'monthStart' }, from)!)).toBe('2026-11-01')
    expect(dateText(nextHabitDueDate({ cycle: 'monthEnd' }, from)!)).toBe('2026-10-31')
    expect(
      dateText(nextHabitDueDate({ cycle: 'yearly', anchorMonth: 12, anchorDay: 31 }, from)!),
    ).toBe('2026-12-31')
    expect(
      habitCountdownText({ cycle: 'yearly', anchorMonth: 12, anchorDay: 31 }, from),
    ).toBe('67天后')
  })

  it('工作日按真实日历算，节假日会跳过', () => {
    const sunday = at(2026, 10, 25)
    const holiday = (date: Date): boolean => dateText(date) === '2026-10-26'
    const context = (date: Date) => {
      const statutoryHoliday = holiday(date)
      return {
        workday: date.getDay() >= 1 && date.getDay() <= 5 && !statutoryHoliday,
        statutoryHoliday,
      }
    }
    expect(habitCountdownText({ cycle: 'workday' }, sunday)).toBeNull()
    expect(dateText(nextHabitDueDate({ cycle: 'workday' }, sunday, context)!)).toBe('2026-10-27')
    expect(habitCountdownText({ cycle: 'workday' }, sunday, context)).toBe('2天后')
    expect(habitCountdownText({ cycle: 'workday' }, at(2026, 10, 26), context)).toBe('明天')
  })

  it('法定节假日按真实节假日表找下一次', () => {
    const sunday = at(2026, 10, 25)
    const context = (date: Date) => ({
      workday: false,
      statutoryHoliday: dateText(date) === '2026-10-28',
    })
    expect(habitCountdownText({ cycle: 'holiday' }, sunday)).toBeNull()
    expect(habitCountdownText({ cycle: 'holiday' }, sunday, context)).toBe('3天后')
  })

  it('每天不显示倒计时后缀', () => {
    expect(habitCountdownText({ cycle: 'daily' }, at(2026, 10, 25))).toBeNull()
  })

  it('今天与明天使用短文案', () => {
    expect(habitCountdownText({ cycle: 'mon' }, at(2026, 10, 19))).toBe('今天')
    expect(habitCountdownText({ cycle: 'tue' }, at(2026, 10, 19))).toBe('明天')
  })
})
