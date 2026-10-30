import { describe, expect, it } from 'vitest'
import { habitDayState, habitSuccessCountOn } from './habit'
import type { HabitLog } from './types'

const DAY = 24 * 60 * 60 * 1000
const dayStart = new Date(2026, 9, 31).getTime()

const log = (time: number, success: boolean, habit = 'h1'): HabitLog => ({
  id: `log-${time}`,
  habit,
  time,
  success,
})

describe('habitSuccessCountOn', () => {
  it('只算当天区间内的成功记录', () => {
    const logs = [
      log(dayStart + 1000, true),
      log(dayStart + 2000, true),
      log(dayStart - 1000, true),
      log(dayStart + DAY, true),
    ]
    expect(habitSuccessCountOn(logs, 'h1', dayStart)).toBe(2)
  })

  it('中断的占位记录不算完成', () => {
    expect(habitSuccessCountOn([log(dayStart + 1000, false)], 'h1', dayStart)).toBe(0)
  })

  it('别的习惯的记录不串进来', () => {
    expect(habitSuccessCountOn([log(dayStart + 1000, true, 'h2')], 'h1', dayStart)).toBe(0)
  })
})

describe('habitDayState', () => {
  it('今天该做且做过是已完成', () => {
    expect(habitDayState(true, 1)).toBe('done')
    expect(habitDayState(true, 3)).toBe('done')
  })

  it('今天该做但没做是未完成', () => {
    expect(habitDayState(true, 0)).toBe('pending')
  })

  it('今天不用做的一律是休息，当天额外做过也不算已完成', () => {
    expect(habitDayState(false, 0)).toBe('off')
    expect(habitDayState(false, 2)).toBe('off')
  })
})
