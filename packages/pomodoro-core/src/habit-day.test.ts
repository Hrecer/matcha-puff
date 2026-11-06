import { describe, expect, it } from 'vitest'
import {
  addDayKey,
  buildHabitDayRows,
  dayKeyToDate,
  deriveHabitDay,
  habitDayView,
  habitDayRowId,
  habitRecentDays,
  habitStats,
  localDayKey,
  normalizeHabitData,
  recomputeHabitDayRows,
  setHabitDayExcused,
  settleHabitDays,
} from './index'
import type { DayContext } from './habit'
import type { Habit, HabitDayRecord, HabitLog } from './types'

const weekdayCtx = (date: Date): DayContext => {
  const day = date.getDay()
  return { workday: day > 0 && day < 6, statutoryHoliday: false }
}

const habitOf = (patch: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: '读书',
  desc: '',
  cycle: 'daily',
  time: 25,
  lastTime: new Date(2026, 9, 1, 12).getTime(),
  createdAt: new Date(2026, 9, 1, 12).getTime(),
  ...patch,
})

const logOf = (patch: Partial<HabitLog> = {}): HabitLog => ({
  id: 'l1',
  habit: 'h1',
  day: '2026-10-30',
  time: dayKeyToDate('2026-10-30').getTime() + 9 * 3600_000,
  success: true,
  source: 'focus',
  ...patch,
})

const rowOf = (patch: Partial<HabitDayRecord> = {}): HabitDayRecord => ({
  id: habitDayRowId('h1', '2026-10-30'),
  habit: 'h1',
  day: '2026-10-30',
  due: true,
  state: 'missed',
  focusCount: 0,
  manualCount: 0,
  seconds: 0,
  source: 'auto',
  settledAt: new Date(2026, 10, 1, 12).getTime(),
  updatedAt: new Date(2026, 10, 1, 12).getTime(),
  ...patch,
})

describe('日键', () => {
  it('本地日期键与加减天', () => {
    const date = new Date(2026, 10, 3, 12)
    expect(localDayKey(date)).toBe('2026-11-03')
    expect(addDayKey('2026-11-03', -1)).toBe('2026-11-02')
    expect(addDayKey('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('单日推导', () => {
  const now = new Date(2026, 10, 3, 12)
  const habit = habitOf()

  it('有成功日志 → done，且多来源分别计数', () => {
    const logs = [
      logOf({ id: 'a', day: '2026-10-30' }),
      logOf({ id: 'b', day: '2026-10-30', source: 'manual', seconds: undefined }),
    ]
    const record = deriveHabitDay({
      habit,
      day: '2026-10-30',
      logs,
      now,
      dayContextOf: weekdayCtx,
    })
    expect(record?.state).toBe('done')
    expect(record?.focusCount).toBe(1)
    expect(record?.manualCount).toBe(1)
    expect(record?.due).toBe(true)
  })

  it('过去该做没做 → missed；休息日 → null', () => {
    const missed = deriveHabitDay({
      habit,
      day: '2026-10-30',
      logs: [],
      now,
      dayContextOf: weekdayCtx,
    })
    expect(missed?.state).toBe('missed')

    const workdayHabit = habitOf({ cycle: 'workday' })
    const saturday = deriveHabitDay({
      habit: workdayHabit,
      day: '2026-10-31',
      logs: [],
      now,
      dayContextOf: weekdayCtx,
    })
    expect(saturday).toBeNull()
  })

  it('今天没做 → null（pending 不落库）', () => {
    const record = deriveHabitDay({
      habit,
      day: '2026-11-03',
      logs: [],
      now,
      dayContextOf: weekdayCtx,
    })
    expect(record).toBeNull()
  })

  it('有成功日志时 done 覆盖请假', () => {
    const record = deriveHabitDay({
      habit,
      day: '2026-10-30',
      logs: [logOf({ day: '2026-10-30' })],
      existing: rowOf({ state: 'excused', source: 'excused' }),
      now,
      dayContextOf: weekdayCtx,
    })
    expect(record?.state).toBe('done')
  })
})

describe('日结', () => {
  const now = new Date(2026, 10, 3, 12)
  const habit = habitOf()
  const logs = [logOf({ day: '2026-10-30' })]

  it('按天写 done / missed，且重复结算幂等', () => {
    const first = settleHabitDays({
      habits: [habit],
      logs,
      rows: [],
      settle: { lastSettledDay: '2026-10-28', version: 1 },
      now,
      dayContextOf: weekdayCtx,
    })
    const states = Object.fromEntries(first.rows.map((row) => [row.day, row.state]))
    expect(states['2026-10-29']).toBe('missed')
    expect(states['2026-10-30']).toBe('done')
    expect(states['2026-11-01']).toBe('missed')
    expect(first.settle.lastSettledDay).toBe('2026-11-02')

    const second = settleHabitDays({
      habits: [habit],
      logs,
      rows: first.rows,
      settle: first.settle,
      now,
      dayContextOf: weekdayCtx,
    })
    expect(second.rows).toHaveLength(first.rows.length)
    expect(second.changed).toBe(false)
  })

  it('工作日习惯的周末不建行', () => {
    const result = settleHabitDays({
      habits: [habitOf({ cycle: 'workday' })],
      logs: [],
      rows: [],
      settle: { lastSettledDay: '2026-10-30', version: 1 },
      now,
      dayContextOf: weekdayCtx,
    })
    expect(result.rows.some((row) => row.day === '2026-10-31')).toBe(false)
    expect(result.rows.some((row) => row.day === '2026-11-01')).toBe(false)
    expect(result.rows.some((row) => row.day === '2026-11-02')).toBe(true)
  })
})

describe('单日重算与请假', () => {
  const now = new Date(2026, 10, 3, 12)
  const habit = habitOf()

  it('补记后 missed → done；撤销后回到 missed', () => {
    const missed = rowOf({ state: 'missed' })
    const logs = [logOf({ source: 'manual', backfilled: true })]
    const done = recomputeHabitDayRows({
      habit,
      day: '2026-10-30',
      logs,
      rows: [missed],
      now,
      dayContextOf: weekdayCtx,
    })
    expect(done[0]?.state).toBe('done')
    expect(done[0]?.manualCount).toBe(1)

    const back = recomputeHabitDayRows({
      habit,
      day: '2026-10-30',
      logs: [],
      rows: done,
      now,
      dayContextOf: weekdayCtx,
    })
    expect(back[0]?.state).toBe('missed')
  })

  it('取消请假后按日志重新结算', () => {
    const rows = setHabitDayExcused({
      rows: [rowOf({ state: 'excused' })],
      habit,
      day: '2026-10-30',
      excused: false,
      now,
      dayContextOf: weekdayCtx,
    })
    expect(rows[0]?.state).toBe('missed')
  })
})

describe('统计', () => {
  const now = new Date(2026, 10, 3, 12)
  const habit = habitOf()
  const rows: HabitDayRecord[] = [
    rowOf({ day: '2026-10-28', state: 'done' }),
    rowOf({ day: '2026-10-29', state: 'missed' }),
    rowOf({ day: '2026-10-30', state: 'excused', source: 'excused' }),
    rowOf({ day: '2026-10-31', state: 'done' }),
    rowOf({ day: '2026-11-01', state: 'done' }),
    rowOf({ day: '2026-11-02', state: 'done' }),
  ].map((row) => ({ ...row, id: habitDayRowId('h1', row.day) }))
  const logs: HabitLog[] = [
    logOf({ id: 'a', day: '2026-10-28' }),
    logOf({ id: 'b', day: '2026-10-31' }),
    logOf({ id: 'c', day: '2026-11-01' }),
    logOf({ id: 'd', day: '2026-11-02', source: 'manual' }),
  ]

  it('完成天数按天去重，专注次数按次', () => {
    const stats = habitStats({ habit, rows, logs, now, dayContextOf: weekdayCtx })
    expect(stats.doneDays).toBe(4)
    expect(stats.focusCount).toBe(3)
    expect(stats.manualCount).toBe(1)
    expect(stats.missedDays).toBe(1)
    expect(stats.excusedDays).toBe(1)
    expect(stats.weekDone).toBe(4)
    expect(stats.weekDue).toBe(6)
    expect(stats.monthRate).toBe(67)
  })

  it('连续天数：请假/休息跳过，缺失断开，今天未做不清零', () => {
    const stats = habitStats({ habit, rows, logs, now, dayContextOf: weekdayCtx })
    expect(stats.streak).toBe(3)
    expect(stats.bestStreak).toBe(3)
  })
})

describe('临时改周期 / 改某一天', () => {
  it('今天改成休息：请假行删除', () => {
    const saturdayNoon = new Date(2026, 10, 7, 12)
    const habit = habitOf({ cycle: 'workday' })
    const record = deriveHabitDay({
      habit,
      day: '2026-11-07',
      logs: [],
      existing: rowOf({ day: '2026-11-07', state: 'excused', source: 'excused' }),
      now: saturdayNoon,
      dayContextOf: weekdayCtx,
      forceDue: true,
    })
    expect(record).toBeNull()
  })

  it('今天改成休息：已完成保留为 due=false 的额外完成', () => {
    const saturdayNoon = new Date(2026, 10, 7, 12)
    const habit = habitOf({ cycle: 'workday' })
    const record = deriveHabitDay({
      habit,
      day: '2026-11-07',
      logs: [logOf({ id: 's', day: '2026-11-07' })],
      existing: rowOf({ day: '2026-11-07', state: 'done', due: true }),
      now: saturdayNoon,
      dayContextOf: weekdayCtx,
      forceDue: true,
    })
    expect(record?.state).toBe('done')
    expect(record?.due).toBe(false)
  })

  it('历史日删掉日志后，按当时的 due 快照恢复缺失', () => {
    const now = new Date(2026, 10, 4, 12)
    // 10/31 是周六；周期现在是工作日，但当时是每天，快照 due=true
    const habit = habitOf({ cycle: 'workday' })
    const record = deriveHabitDay({
      habit,
      day: '2026-10-31',
      logs: [],
      existing: rowOf({ day: '2026-10-31', state: 'done', due: true }),
      now,
      dayContextOf: weekdayCtx,
    })
    expect(record?.state).toBe('missed')
    expect(record?.due).toBe(true)
  })

  it('取消历史请假恢复缺失，而不是直接消失', () => {
    const now = new Date(2026, 10, 4, 12)
    const habit = habitOf({ cycle: 'workday' })
    const rows = setHabitDayExcused({
      rows: [
        {
          ...rowOf({ day: '2026-10-31', state: 'excused', due: true, source: 'excused' }),
          id: habitDayRowId('h1', '2026-10-31'),
        },
      ],
      habit,
      day: '2026-10-31',
      excused: false,
      now,
      dayContextOf: weekdayCtx,
    })
    expect(rows[0]?.state).toBe('missed')
    expect(rows[0]?.due).toBe(true)
  })

  it('过去没有账的日子不会因为改周期而打断连续', () => {
    const now = new Date(2026, 10, 4, 12)
    const habit = habitOf({ cycle: 'daily' })
    const rows: HabitDayRecord[] = [
      rowOf({ day: '2026-10-30', state: 'done', due: true }),
      rowOf({ day: '2026-11-02', state: 'done', due: true }),
    ].map((row) => ({ ...row, id: habitDayRowId('h1', row.day) }))
    const stats = habitStats({ habit, rows, logs: [], now, dayContextOf: weekdayCtx })
    // 今天 11/4 pending 跳过；11/3、11/1、10/31 没有账 → 跳过，不打断
    expect(stats.streak).toBe(2)
  })
})

describe('单日临时加做', () => {
  it('今天休息日临时加做 → pending，且优先级高于周期', () => {
    const saturdayNoon = new Date(2026, 10, 7, 12)
    const habit = habitOf({ cycle: 'workday' })
    const record = deriveHabitDay({
      habit,
      day: '2026-11-07',
      logs: [],
      now: saturdayNoon,
      dayContextOf: weekdayCtx,
      overrideDue: true,
      manualDue: true,
    })
    expect(record?.state).toBe('pending')
    expect(record?.due).toBe(true)
    expect(record?.manualDue).toBe(true)

    // 周期再改成休息，也不会撤销手动加做
    const kept = deriveHabitDay({
      habit,
      day: '2026-11-07',
      logs: [],
      existing: record ?? undefined,
      now: saturdayNoon,
      dayContextOf: weekdayCtx,
      forceDue: true,
    })
    expect(kept?.state).toBe('pending')
    expect(kept?.due).toBe(true)
  })

  it('过去的临时加做没完成，日结会变成 missed 但保留覆盖标记', () => {
    const now = new Date(2026, 10, 4, 12)
    const habit = habitOf({ cycle: 'workday' })
    const pending = {
      ...rowOf({ day: '2026-11-01', state: 'pending', due: true, manualDue: true }),
      id: habitDayRowId('h1', '2026-11-01'),
    }
    const result = settleHabitDays({
      habits: [habit],
      logs: [],
      rows: [pending],
      settle: { lastSettledDay: '2026-10-31', version: 1 },
      now,
      dayContextOf: weekdayCtx,
    })
    const row = result.rows.find((item) => item.day === '2026-11-01')
    expect(row?.state).toBe('missed')
    expect(row?.due).toBe(true)
    expect(row?.manualDue).toBe(true)
  })

  it('撤销今天最后一次完成：删掉 done 行，回到待完成', () => {
    const now = new Date(2026, 10, 6, 12)
    const habit = habitOf({ cycle: 'daily', createdAt: now.getTime() })
    const rows = [
      {
        ...rowOf({ day: '2026-11-06', state: 'done', due: true, source: 'manual', manualCount: 1 }),
        id: habitDayRowId('h1', '2026-11-06'),
      },
    ]
    const next = recomputeHabitDayRows({
      habit,
      day: '2026-11-06',
      logs: [],
      rows,
      now,
      dayContextOf: weekdayCtx,
      forceDue: true,
    })
    expect(next).toHaveLength(0)
  })

  it('取消今天的普通请假：移除行，今天回到待完成', () => {
    const now = new Date(2026, 10, 6, 12)
    const habit = habitOf({ cycle: 'daily', createdAt: now.getTime() })
    const rows = setHabitDayExcused({
      rows: [
        {
          ...rowOf({ day: '2026-11-06', state: 'excused', due: true, source: 'excused' }),
          id: habitDayRowId('h1', '2026-11-06'),
        },
      ],
      habit,
      day: '2026-11-06',
      excused: false,
      now,
      dayContextOf: weekdayCtx,
    })
    expect(rows).toHaveLength(0)
  })

  it('取消今天的请假后，临时加做回到 pending', () => {
    const saturdayNoon = new Date(2026, 10, 7, 12)
    const habit = habitOf({ cycle: 'workday' })
    const rows = setHabitDayExcused({
      rows: [
        {
          ...rowOf({ day: '2026-11-07', state: 'excused', due: true, manualDue: true }),
          id: habitDayRowId('h1', '2026-11-07'),
        },
      ],
      habit,
      day: '2026-11-07',
      excused: false,
      now: saturdayNoon,
      dayContextOf: weekdayCtx,
    })
    expect(rows[0]?.state).toBe('pending')
    expect(rows[0]?.due).toBe(true)
    expect(rows[0]?.manualDue).toBe(true)
  })
})

describe('视图与迁移', () => {
  const now = new Date(2026, 10, 3, 12)
  const habit = habitOf()

  it('今天 pending、过去无记录为 missed、未来 future', () => {
    const rows: HabitDayRecord[] = []
    const today = habitDayView({ habit, day: '2026-11-03', rows, logs: [], now, dayContextOf: weekdayCtx })
    const past = habitDayView({ habit, day: '2026-10-20', rows, logs: [], now, dayContextOf: weekdayCtx })
    const future = habitDayView({ habit, day: '2026-11-10', rows, logs: [], now, dayContextOf: weekdayCtx })
    expect(today.state).toBe('pending')
    // 过去的该做日没有记录就是未完成，不再留成 off
    expect(past.state).toBe('missed')
    expect(future.state).toBe('future')
  })

  it('最近 7 天固定 7 格，最后一格是今天', () => {
    const recent = habitRecentDays({ habit, rows: [], logs: [], now, dayContextOf: weekdayCtx, count: 7 })
    expect(recent).toHaveLength(7)
    expect(recent[0]?.day).toBe('2026-10-28')
    expect(recent[6]?.day).toBe('2026-11-03')
    expect(recent[6]?.isToday).toBe(true)
  })

  it('旧日志补齐 day/source，旧习惯补 createdAt', () => {
    const oldHabit = habitOf({ createdAt: undefined, lastTime: now.getTime() })
    const result = normalizeHabitData([oldHabit], [{ id: 'x', habit: 'h1', time: now.getTime(), success: true }], now)
    expect(result.habits[0]?.createdAt).toBeTruthy()
    expect(result.logs[0]?.day).toBe('2026-11-03')
    expect(result.logs[0]?.source).toBe('focus')
  })

  it('首次升级生成完成行并回填缺失', () => {
    const rows = buildHabitDayRows({
      habits: [habitOf({ createdAt: new Date(2026, 9, 1).getTime() })],
      logs: [logOf({ day: '2026-10-30' })],
      rows: [],
      now,
      dayContextOf: weekdayCtx,
      backfillDays: 30,
    })
    expect(rows.find((row) => row.day === '2026-10-30')?.state).toBe('done')
    expect(rows.some((row) => row.day === '2026-10-29' && row.state === 'missed')).toBe(true)
    expect(rows.some((row) => row.day === '2026-11-03')).toBe(false)
  })
})
