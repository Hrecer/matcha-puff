import { describe, expect, it } from 'vitest'
import {
  UNASSIGNED_TASK,
  afterRest,
  applyFocusSeconds,
  archiveCompletedTasks,
  archiveDay,
  beginCycle,
  completedHabitCount,
  countCompletedPomodoro,
  createSummary,
  dayKeyOf,
  formatDuration,
  formatRemain,
  habitScheduleLabel,
  isHabitDue,
  monthlySeconds,
  monthlyActiveDays,
  monthlySecondsWithToday,
  heatLevel,
  isLeapYear,
  taskTotals,
  statisticOfDay,
  yearDays,
  nextRestKind,
  progressPercent,
  recordFinishedSession,
  resetToday,
} from './index'
import type { Task } from './tasks'
import type { DayContext } from './habit'
import type { DayStatistic, Summary } from './types'

const DAY = 24 * 60 * 60 * 1000

function summaryAt(now: number, patch: Partial<Summary> = {}): Summary {
  return { ...createSummary(now), ...patch }
}

describe('时间显示', () => {
  it('剩余时间按分/秒格式化', () => {
    expect(formatRemain(25 * 60_000)).toEqual({ minutes: '25', seconds: '00' })
    expect(formatRemain(5 * 60_000)).toEqual({ minutes: '05', seconds: '00' })
    expect(formatRemain(59_900)).toEqual({ minutes: '00', seconds: '59' })
    expect(formatRemain(0)).toEqual({ minutes: '00', seconds: '00' })
  })

  it('进度夹在 0-100', () => {
    expect(progressPercent(0, 1000)).toBe(0)
    expect(progressPercent(500, 1000)).toBe(50)
    expect(progressPercent(5000, 1000)).toBe(100)
    expect(progressPercent(1, 0)).toBe(100)
  })

  it('统计时长格式', () => {
    expect(formatDuration(59)).toBe('00:59')
    expect(formatDuration(61)).toBe('01:01')
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

describe('长休判定（会话制）', () => {
  it('0 个番茄不判长休', () => {
    expect(nextRestKind(0, 4)).toBe('short')
  })

  it('每 4 个一次长休', () => {
    expect(nextRestKind(3, 4)).toBe('short')
    expect(nextRestKind(4, 4)).toBe('long')
    expect(nextRestKind(8, 4)).toBe('long')
  })

  it('间隔非法时退回短休', () => {
    expect(nextRestKind(4, 0)).toBe('short')
    expect(nextRestKind(4, -1)).toBe('short')
  })

  it('完成数递增，长休后归零，短休保持', () => {
    const start = { completed: 0, lastCompletedAt: null as number | null }
    const done1 = { ...start, completed: 1, lastCompletedAt: 1000 }
    expect(afterRest(done1, 'short').completed).toBe(1)
    expect(afterRest(done1, 'long').completed).toBe(0)
  })

  it('距上次完成超过 4 小时视为新一段', () => {
    const cycle = { completed: 3, lastCompletedAt: 1000 }
    const fourHours = 4 * 60 * 60 * 1000
    expect(beginCycle(cycle, 1000 + fourHours - 1).completed).toBe(3)
    expect(beginCycle(cycle, 1000 + fourHours + 1).completed).toBe(0)
  })
})

describe('日统计', () => {
  const now = new Date(2026, 9, 19, 12).getTime()
  const yesterday = now - DAY

  it('归档保留番茄数、时长、任务明细', () => {
    const summary = summaryAt(yesterday, {
      todayPomodoro: 3,
      todayTime: 1500,
      todayTasks: [
        { id: 'a', name: '任务A', value: 900 },
        { id: 'b', name: '任务B', value: 600 },
      ],
    })
    const records = archiveDay([], summary, yesterday)
    expect(records).toHaveLength(1)
    expect(records[0]?.pomodoroCount).toBe(3)
    expect(records[0]?.pomodoroTime).toBe(1500)
    expect(records[0]?.tasks).toHaveLength(2)
  })

  it('重复归档同一天幂等', () => {
    const summary = summaryAt(yesterday, { todayPomodoro: 2, todayTime: 600 })
    const once = archiveDay([], summary, yesterday)
    const twice = archiveDay(once, summary, yesterday)
    expect(twice).toHaveLength(1)
    expect(twice[0]?.pomodoroCount).toBe(2)
  })

  it('今天读实时 summary，历史读归档', () => {
    const summary = summaryAt(now, { todayPomodoro: 1, todayTime: 600 })
    const archived = archiveDay([], summaryAt(yesterday, { todayPomodoro: 5, todayTime: 1500 }), yesterday)

    const today = statisticOfDay(archived, summary, now, now)
    expect(today?.pomodoroTime).toBe(600)
    expect(today?.pomodoroCount).toBe(1)

    const past = statisticOfDay(archived, summary, yesterday, now)
    expect(past?.pomodoroCount).toBe(5)
  })

  it('summary 过期时不再当作今天', () => {
    const stale = summaryAt(yesterday, { todayTime: 999 })
    expect(statisticOfDay([], stale, now, now)).toBeUndefined()
  })

  it('月度统计按年份过滤，并补上今天的实时值', () => {
    const records: DayStatistic[] = [
      { year: '2026', month: '10', day: '18', pomodoroTime: 1500, pomodoroCount: 3, tasks: [] },
      { year: '2025', month: '10', day: '18', pomodoroTime: 9999, pomodoroCount: 9, tasks: [] },
    ]
    const months = monthlySeconds(records, '2026')
    expect(months[9]).toBe(1500)
    expect(months.reduce((a, b) => a + b, 0)).toBe(1500)

    const summary = summaryAt(now, { todayTime: 600 })
    const withToday = monthlySecondsWithToday(records, summary, '2026', now)
    expect(withToday[9]).toBe(2100)
  })

  it('跨天清零三项今日量', () => {
    const summary = summaryAt(now, {
      todayPomodoro: 3,
      todayTime: 1500,
      todayTasks: [{ id: 'a', name: 'A', value: 1500 }],
    })
    const reset = resetToday(summary, now + DAY)
    expect(reset.todayPomodoro).toBe(0)
    expect(reset.todayTime).toBe(0)
    expect(reset.todayTasks).toEqual([])
    expect(reset.allPomodoroTime).toBe(summary.allPomodoroTime)
  })

})

describe('专注入账', () => {
  const now = Date.now()

  it('秒数累加到总量与任务明细', () => {
    const first = applyFocusSeconds(createSummary(now), UNASSIGNED_TASK, 10, now)
    expect(first.todayTime).toBe(10)
    expect(first.allPomodoroTime).toBe(10)
    expect(first.todayTasks[0]).toEqual({ id: UNASSIGNED_TASK.id, name: UNASSIGNED_TASK.name, value: 10 })

    const second = applyFocusSeconds(first, { ...UNASSIGNED_TASK, id: 'p1', name: '任务一', type: 2 }, 20, now)
    expect(second.todayTime).toBe(30)
    expect(second.todayTasks).toHaveLength(2)

    const third = applyFocusSeconds(second, { ...UNASSIGNED_TASK, id: 'p1', name: '任务一', type: 2 }, 5, now)
    expect(third.todayTasks.find((item) => item.id === 'p1')?.value).toBe(25)
  })

  it('完成番茄只加计数，不重复加时长', () => {
    const base = applyFocusSeconds(createSummary(now), UNASSIGNED_TASK, 1500, now)
    const done = countCompletedPomodoro(base)
    expect(done.todayPomodoro).toBe(1)
    expect(done.allPomodoroCount).toBe(1)
    expect(done.todayTime).toBe(1500)
  })

  it('会话结束一次入账秒数与计数', () => {
    const result = recordFinishedSession(createSummary(now), UNASSIGNED_TASK, 1500, now)
    expect(result.todayPomodoro).toBe(1)
    expect(result.allPomodoroTime).toBe(1500)
  })
})

describe('任务归档', () => {
  const leaf = (id: string, total: number, count: number, parentId: string | null = null): Task => ({
    id,
    parentId,
    title: id,
    desc: '',
    order: 0,
    startDate: 0,
    endDate: 0,
    pomodoroTotal: total,
    pomodoroCount: count,
    createdAt: 0,
  })

  it('一次遍历归档多个已完成的顶层任务', () => {
    const result = archiveCompletedTasks([leaf('p1', 2, 2), leaf('p2', 3, 3)], [], 1000)
    expect(result.archived).toHaveLength(2)
    expect(result.tasks).toHaveLength(0)
    expect(result.inbox.map((item) => item.id).sort()).toEqual(['p1', 'p2'])
  })

  it('重复调用幂等', () => {
    const once = archiveCompletedTasks([leaf('p1', 2, 2)], [], 1000)
    const twice = archiveCompletedTasks(once.tasks, once.inbox, 2000)
    expect(twice.inbox).toHaveLength(1)
    expect(twice.archived).toHaveLength(0)
  })

  it('子任务未全部完成时不归档', () => {
    const result = archiveCompletedTasks(
      [leaf('p1', 0, 0), leaf('s1', 2, 2, 'p1'), leaf('s2', 2, 1, 'p1')],
      [],
      1000,
    )
    expect(result.archived).toHaveLength(0)
    expect(result.tasks).toHaveLength(3)
  })

  it('父的番茄数按后代汇总，明细保留层级', () => {
    const result = archiveCompletedTasks(
      [
        leaf('p1', 99, 0),
        leaf('s1', 88, 0, 'p1'),
        leaf('l1', 2, 2, 's1'),
        leaf('l2', 1, 1, 's1'),
        leaf('s2', 3, 3, 'p1'),
      ],
      [],
      1000,
    )
    expect(result.archived).toHaveLength(1)
    expect(result.tasks).toHaveLength(0)
    const record = result.inbox[0]
    expect(record?.count).toBe(6)
    expect(record?.title).toBe('p1')
    expect(record?.subtask).toHaveLength(4)
    expect(record?.subtask.find((item) => item.id === 'l1')?.parentId).toBe('s1')
    expect(record?.subtask.find((item) => item.id === 's1')?.parentId).toBe('p1')
  })
})

describe('习惯周期', () => {
  const monday = new Date(2026, 9, 19, 12)
  const sunday = new Date(2026, 9, 18, 12)
  const saturday = new Date(2026, 9, 24, 12)
  const firstDay = new Date(2026, 9, 1, 12)
  const lastDay = new Date(2026, 9, 31, 12)

  const workday: DayContext = { workday: true, statutoryHoliday: false }
  const rest: DayContext = { workday: false, statutoryHoliday: false }
  const holidayOff: DayContext = { workday: false, statutoryHoliday: true }

  it('每日', () => {
    expect(isHabitDue('daily', monday, workday)).toBe(true)
    expect(isHabitDue('daily', sunday, rest)).toBe(true)
  })

  it('周几按 getDay 对齐', () => {
    expect(isHabitDue('mon', monday, workday)).toBe(true)
    expect(isHabitDue('tue', monday, workday)).toBe(false)
    expect(isHabitDue('sat', saturday, rest)).toBe(true)
    expect(isHabitDue('sun', sunday, rest)).toBe(true)
  })

  it('工作日看日历：调休周六算工作日，法定节假日不算', () => {
    expect(isHabitDue('workday', monday, workday)).toBe(true)
    expect(isHabitDue('workday', saturday, workday)).toBe(true) // 调休补班
    expect(isHabitDue('workday', monday, holidayOff)).toBe(false) // 国庆这类落在工作日的假期
    expect(isHabitDue('workday', sunday, rest)).toBe(false)
  })

  it('法定节假日只在放假日执行', () => {
    expect(isHabitDue('holiday', monday, holidayOff)).toBe(true)
    expect(isHabitDue('holiday', monday, workday)).toBe(false)
    expect(isHabitDue('holiday', sunday, rest)).toBe(false) // 普通周末不是法定节假日
  })

  it('月初月末', () => {
    expect(isHabitDue('monthStart', firstDay, workday)).toBe(true)
    expect(isHabitDue('monthStart', monday, workday)).toBe(false)
    expect(isHabitDue('monthEnd', lastDay, workday)).toBe(true)
    expect(isHabitDue('monthEnd', monday, workday)).toBe(false)
  })

  it('每年只在月日当天到期，2 月 29 日平年退到 28 日', () => {
    const yearly = { cycle: 'yearly' as const, anchorMonth: 10, anchorDay: 1 }
    expect(isHabitDue(yearly, new Date(2026, 9, 1, 12), workday)).toBe(true)
    expect(isHabitDue(yearly, new Date(2026, 9, 2, 12), workday)).toBe(false)
    const leapDay = { cycle: 'yearly' as const, anchorMonth: 2, anchorDay: 29 }
    expect(isHabitDue(leapDay, new Date(2025, 1, 28, 12), workday)).toBe(true)
    expect(isHabitDue(leapDay, new Date(2028, 1, 28, 12), workday)).toBe(false)
    expect(isHabitDue(leapDay, new Date(2028, 1, 29, 12), workday)).toBe(true)
    expect(habitScheduleLabel(yearly)).toBe('每年 10月1日')
  })

  it('执行次数只统计完成那一刻的记录', () => {
    const logs = [
      { id: '1', habit: 'h1', time: 1, success: true },
      { id: '2', habit: 'h1', time: 2, success: false },
      { id: '3', habit: 'h2', time: 3, success: true },
    ]
    expect(completedHabitCount(logs, 'h1')).toBe(1)
  })
})

describe('日期键', () => {
  it('本地日期补零', () => {
    expect(dayKeyOf(new Date(2026, 0, 5, 8))).toEqual({ year: '2026', month: '01', day: '05' })
  })
})

describe('统计扩展', () => {
  const day = (year: string, month: string, date: string, seconds: number, count: number, tasks: { id: string; name: string; value: number }[] = []) => ({
    year,
    month,
    day: date,
    pomodoroTime: seconds,
    pomodoroCount: count,
    tasks,
  })

  it('任务时长跨归档与今日合并，按秒降序', () => {
    const statistics = [
      day('2026', '10', '17', 3600, 2, [{ id: 'a', name: '写方案', value: 3600 }]),
      day('2026', '10', '18', 1800, 1, [{ id: 'b', name: '读书', value: 1800 }]),
    ]
    const now = new Date(2026, 9, 19, 12).getTime()
    const summary = {
      ...createSummary(now),
      todayTime: 600,
      todayTasks: [{ id: 'a', name: '写方案', value: 600 }],
    }
    const totals = taskTotals(statistics, summary, now)
    expect(totals[0]).toEqual({ id: 'a', name: '写方案', seconds: 4200 })
    expect(totals[1]).toEqual({ id: 'b', name: '读书', seconds: 1800 })
  })

  it('同名不同 id 不合并', () => {
    const statistics = [
      day('2026', '10', '17', 600, 1, [
        { id: 'a1', name: '复盘', value: 300 },
        { id: 'a2', name: '复盘', value: 300 },
      ]),
    ]
    const now = new Date(2026, 9, 19, 12).getTime()
    expect(taskTotals(statistics, createSummary(now), now)).toHaveLength(2)
  })

  it('年视图长度按闰年计算，今天取实时值', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)

    const now = new Date(2026, 9, 19, 12).getTime()
    const statistics = [day('2026', '10', '18', 1500, 1)]
    const summary = { ...createSummary(now), todayTime: 600, todayPomodoro: 1 }
    const days = yearDays(statistics, summary, 2026, now)
    expect(days).toHaveLength(365)
    expect(days[0]?.key).toBe('2026-01-01')
    expect(days.find((item) => item.key === '2026-10-18')?.seconds).toBe(1500)
    expect(days.find((item) => item.key === '2026-10-19')?.seconds).toBe(600)
  })

  it('热力等级按分钟分档', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(60)).toBe(1)
    expect(heatLevel(25 * 60)).toBe(2)
    expect(heatLevel(90 * 60)).toBe(3)
    expect(heatLevel(3 * 3600)).toBe(4)
  })

  it('活跃天数中今天只算一次', () => {
    const now = new Date(2026, 9, 19, 12).getTime()
    const statistics = [
      day('2026', '10', '17', 600, 1),
      day('2026', '10', '18', 600, 1),
      day('2026', '10', '19', 300, 1),
    ]
    const summary = { ...createSummary(now), todayTime: 1200, todayPomodoro: 2 }
    const active = monthlyActiveDays(statistics, summary, 2026, now)
    expect(active[9]).toBe(3)

    // 今天还没归档：除了已归档的两天，补上今天
    const onlyPast = monthlyActiveDays(statistics.slice(0, 2), summary, 2026, now)
    expect(onlyPast[9]).toBe(3)
  })

  it('statisticOfDay 对今天返回实时值', () => {
    const now = new Date(2026, 9, 19, 12).getTime()
    const summary = { ...createSummary(now), todayTime: 900, todayPomodoro: 2 }
    expect(statisticOfDay([], summary, new Date(2026, 9, 19), now)?.pomodoroCount).toBe(2)
  })
})
