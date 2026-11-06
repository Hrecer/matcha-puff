/**
 * 每天账（HabitDayRecord）的纯函数：日键、日结、日视图与统计。
 *
 * 设计约束：
 * - 日志是事实源，日记录是可重建的物化索引；
 * - 只记录有事实的日期（done / missed / excused），休息日不建行；
 * - 过去已结算的行不重算，due 用写入时快照；
 * - 今天不写 missed，未完成只是 pending。
 */
import type { DayContextResolver } from './countdown'
import { isHabitDue } from './habit'
import { pad2 } from './time'
import type {
  Habit,
  HabitDayRecord,
  HabitDayView,
  HabitDayViewState,
  HabitLog,
  HabitLogSource,
  HabitRecordState,
  HabitSettle,
  HabitStats,
} from './types'

const MS_PER_DAY = 86_400_000
/** 连续天数回溯上限，避免 createdAt 异常时死循环 */
const MAX_STREAK_DAYS = 4_000

/** 本地时区日期键 yyyy-mm-dd；禁止用 UTC，否则跨时区会错一天 */
export function localDayKey(input: number | Date = Date.now()): string {
  const date = input instanceof Date ? input : new Date(input)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** yyyy-mm-dd → 本地零点 */
export function dayKeyToDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

export function addDayKey(key: string, delta: number): string {
  const date = dayKeyToDate(key)
  date.setDate(date.getDate() + delta)
  return localDayKey(date)
}

/** 两个日期键相差的天数（later - earlier） */
export function dayKeyDiff(later: string, earlier: string): number {
  const late = dayKeyToDate(later)
  const early = dayKeyToDate(earlier)
  return Math.round(
    (Date.UTC(late.getFullYear(), late.getMonth(), late.getDate()) -
      Date.UTC(early.getFullYear(), early.getMonth(), early.getDate())) /
      MS_PER_DAY,
  )
}

/** [from, to] 闭区间的日期键列表 */
export function dayKeysBetween(from: string, to: string): string[] {
  if (from > to) return []
  const keys: string[] = []
  let cursor = from
  for (let guard = 0; guard <= MAX_STREAK_DAYS; guard += 1) {
    keys.push(cursor)
    if (cursor === to) break
    cursor = addDayKey(cursor, 1)
  }
  return keys
}

/** 日志归属日；旧日志没有 day 时按 time 的本地日期推导 */
export function habitLogDay(log: HabitLog): string {
  return log.day || localDayKey(log.time)
}

/** 日志来源；旧日志一律视为番茄完成 */
export function habitLogSource(log: HabitLog): HabitLogSource {
  return log.source ?? 'focus'
}

/** 确定性 id，天然幂等 */
export function habitDayRowId(habitId: string, day: string): string {
  return `${habitId}:${day}`
}

/** 习惯创建日；旧数据没有 createdAt 时退回 lastTime，再退回今天 */
export function habitCreatedDay(habit: Habit, fallback = new Date()): string {
  const at = habit.createdAt && habit.createdAt > 0 ? habit.createdAt : habit.lastTime
  return at && at > 0 ? localDayKey(at) : localDayKey(fallback)
}

export function habitDayRowOf(
  rows: readonly HabitDayRecord[],
  habitId: string,
  day: string,
): HabitDayRecord | undefined {
  return rows.find((row) => row.id === habitDayRowId(habitId, day))
}

/** 某天该习惯的成功日志（focus + manual） */
export function habitLogsOn(logs: readonly HabitLog[], habitId: string, day: string): HabitLog[] {
  return logs.filter(
    (log) => log.habit === habitId && log.success && habitLogDay(log) === day,
  )
}

export interface HabitDayFacts {
  focusCount: number
  manualCount: number
  seconds: number
  hasSuccess: boolean
}

/** 某天的日志事实；秒数只累加有记录的 */
export function habitDayFactsOf(
  logs: readonly HabitLog[],
  habitId: string,
  day: string,
): HabitDayFacts {
  let focusCount = 0
  let manualCount = 0
  let seconds = 0
  for (const log of logs) {
    if (log.habit !== habitId || !log.success || habitLogDay(log) !== day) continue
    if (habitLogSource(log) === 'manual') manualCount += 1
    else focusCount += 1
    seconds += Math.max(0, log.seconds ?? 0)
  }
  return { focusCount, manualCount, seconds, hasSuccess: focusCount + manualCount > 0 }
}

export interface DeriveHabitDayParams {
  habit: Habit
  day: string
  logs: readonly HabitLog[]
  /** 已有日记录；用于保留 due 快照、请假与 settledAt */
  existing?: HabitDayRecord
  now?: Date
  dayContextOf: DayContextResolver
  /**
   * 忽略已有行的 due 快照，按当前周期重算。
   * 只允许今天使用：未来靠实时计算，过去必须冻结。
   */
  forceDue?: boolean
  /** 单日临时加做：把本应休息的一天强制标记为“该做” */
  overrideDue?: boolean
  /** 写入/保留 manualDue 标记；取消临时加做时传 false 并先移除旧行 */
  manualDue?: boolean
}

/**
 * 把某天的日志 + 请假 + 周期，归一成一条日记录。
 * 返回 null 表示“这一天不需要有账”（今天未做、休息日、未来）。
 */
export function deriveHabitDay({
  habit,
  day,
  logs,
  existing,
  now = new Date(),
  dayContextOf,
  forceDue = false,
  overrideDue = false,
  manualDue = false,
}: DeriveHabitDayParams): HabitDayRecord | null {
  const today = localDayKey(now)
  if (day > today) return null

  const date = dayKeyToDate(day)
  const dueNow = isHabitDue(habit, date, dayContextOf(date))
  // 单日临时加做优先：即使周期说休息，这一天也保持“该做”
  const keepDue = existing?.manualDue === true || manualDue || overrideDue
  // 已存在的行默认保留写入时的 due 快照；今天可用 forceDue 跟着周期变
  const dueSnapshot = keepDue ? true : forceDue ? dueNow : (existing?.due ?? dueNow)
  const facts = habitDayFactsOf(logs, habit.id, day)
  const settledAt = existing?.settledAt ?? now.getTime()
  const updatedAt = now.getTime()

  if (facts.hasSuccess) {
    return {
      id: habitDayRowId(habit.id, day),
      habit: habit.id,
      day,
      due: dueSnapshot,
      manualDue: keepDue || undefined,
      state: 'done',
      focusCount: facts.focusCount,
      manualCount: facts.manualCount,
      seconds: facts.seconds,
      source: facts.focusCount > 0 ? 'auto' : 'manual',
      settledAt,
      updatedAt,
    }
  }

  if (existing?.state === 'pending') {
    // 今天临时加做但还没完成：保留 pending；周期改成休息也不撤销手动覆盖
    if (forceDue && !dueNow && !existing.manualDue) return null
    if (day === today) {
      return {
        ...existing,
        due: dueSnapshot,
        manualDue: keepDue || undefined,
        updatedAt,
      }
    }
    // 过去的 pending 应该已经被日结处理；落到下面按缺失/完成重算
  }

  if (existing?.state === 'excused') {
    // 今天改成休息日：请假行不再成立（手动加做的日子除外）
    if (forceDue && !dueNow && !existing.manualDue) return null
    return {
      ...existing,
      due: dueSnapshot,
      manualDue: keepDue || undefined,
      focusCount: 0,
      manualCount: 0,
      seconds: 0,
      updatedAt,
    }
  }

  // 今天临时加做：即使还没完成，也要留下一条 pending 行
  if (day === today && keepDue) {
    return {
      id: habitDayRowId(habit.id, day),
      habit: habit.id,
      day,
      due: true,
      manualDue: true,
      state: 'pending',
      focusCount: 0,
      manualCount: 0,
      seconds: 0,
      source: 'manual',
      settledAt,
      updatedAt,
    }
  }

  // 过去是否缺失，以当时写下的 due 快照为准；周期改了也不能把旧账删掉
  if (day < today && dueSnapshot) {
    return {
      id: habitDayRowId(habit.id, day),
      habit: habit.id,
      day,
      due: dueSnapshot,
      manualDue: keepDue || undefined,
      state: 'missed',
      focusCount: 0,
      manualCount: 0,
      seconds: 0,
      source: 'auto',
      settledAt,
      updatedAt,
    }
  }

  return null
}

export function upsertHabitDay(
  rows: readonly HabitDayRecord[],
  record: HabitDayRecord | null,
): HabitDayRecord[] {
  if (!record) return [...rows]
  return [...rows.filter((row) => row.id !== record.id), record]
}

/** 按 id 删除一条日记录；null 语义的删除必须走这里，否则不知道删哪条 */
export function removeHabitDayRow(
  rows: readonly HabitDayRecord[],
  habitId: string,
  day: string,
): HabitDayRecord[] {
  const id = habitDayRowId(habitId, day)
  return rows.filter((row) => row.id !== id)
}

export interface RecomputeHabitDayParams {
  habit: Habit
  day: string
  logs: readonly HabitLog[]
  rows: readonly HabitDayRecord[]
  now?: Date
  dayContextOf: DayContextResolver
  forceDue?: boolean
  overrideDue?: boolean
  manualDue?: boolean
}

/** 唯一写入口：由日志 + 请假 + 周期重算某天，并 upsert 回数组 */
export function recomputeHabitDayRows({
  habit,
  day,
  logs,
  rows,
  now,
  dayContextOf,
  forceDue,
  overrideDue,
  manualDue,
}: RecomputeHabitDayParams): HabitDayRecord[] {
  const existing = habitDayRowOf(rows, habit.id, day)
  const record = deriveHabitDay({
    habit,
    day,
    logs,
    existing,
    now,
    dayContextOf,
    forceDue,
    overrideDue,
    manualDue,
  })
  // derive 返回 null = 这一天不该有账（今天回到待完成 / 休息日）
  // 必须按 id 删掉旧行，不能走 upsert 的 null 分支
  if (!record) {
    return existing ? removeHabitDayRow(rows, habit.id, day) : [...rows]
  }
  return upsertHabitDay(rows, record)
}

export interface SetHabitDayExcusedParams {
  rows: readonly HabitDayRecord[]
  habit: Habit
  day: string
  excused: boolean
  now?: Date
  dayContextOf: DayContextResolver
}

/** 请假 / 取消请假：只改该做日，不动其它日期；未来日也可以提前请假 */
export function setHabitDayExcused({
  rows,
  habit,
  day,
  excused,
  now = new Date(),
  dayContextOf,
}: SetHabitDayExcusedParams): HabitDayRecord[] {
  const today = localDayKey(now)
  const existing = habitDayRowOf(rows, habit.id, day)
  if (existing?.state === 'done') return [...rows]

  if (!excused) {
    if (existing?.state !== 'excused') return [...rows]
    const without = removeHabitDayRow(rows, habit.id, day)
    // 取消请假按“当时是否该做”恢复：过去恢复缺失，今天回到待完成
    if (day < today && existing.due) {
      return upsertHabitDay(without, {
        ...existing,
        state: 'missed',
        source: 'auto',
        focusCount: 0,
        manualCount: 0,
        seconds: 0,
        updatedAt: now.getTime(),
      })
    }
    // 临时加做的今天：取消请假后回到待完成，而不是直接变成休息
    if (day === today && existing.manualDue) {
      return upsertHabitDay(without, {
        ...existing,
        state: 'pending',
        due: true,
        manualDue: true,
        source: 'manual',
        focusCount: 0,
        manualCount: 0,
        seconds: 0,
        updatedAt: now.getTime(),
      })
    }
    return without
  }

  const due = existing?.due ?? isHabitDue(habit, dayKeyToDate(day), dayContextOf(dayKeyToDate(day)))
  if (!due) return [...rows]
  return upsertHabitDay(rows, {
    id: habitDayRowId(habit.id, day),
    habit: habit.id,
    day,
    due,
    manualDue: existing?.manualDue || undefined,
    state: 'excused',
    focusCount: 0,
    manualCount: 0,
    seconds: 0,
    source: 'excused',
    settledAt: existing?.settledAt ?? now.getTime(),
    updatedAt: now.getTime(),
  })
}

/** 日结结果 */
export interface SettleHabitDaysResult {
  rows: HabitDayRecord[]
  settle: HabitSettle
  changed: boolean
}

export interface SettleHabitDaysParams {
  habits: readonly Habit[]
  logs: readonly HabitLog[]
  rows: readonly HabitDayRecord[]
  settle: HabitSettle
  now?: Date
  dayContextOf: DayContextResolver
  /** 一次最多回扫多少天，避免极端情况卡住启动 */
  maxDays?: number
}

/**
 * 日结：只结算“已经完整结束”的本地日。
 *
 * - 从 lastSettledDay 的下一天开始，最多回扫 maxDays；
 * - 有成功日志 → done；
 * - 已请假 → 保留 excused；
 * - 该做且没做 → missed；
 * - 不该做 → 跳过，不建行。
 */
export function settleHabitDays({
  habits,
  logs,
  rows,
  settle,
  now = new Date(),
  dayContextOf,
  maxDays = 366,
}: SettleHabitDaysParams): SettleHabitDaysResult {
  const today = localDayKey(now)
  const yesterday = addDayKey(today, -1)
  const floor = addDayKey(today, -Math.max(1, maxDays))
  const requestedFrom = settle.lastSettledDay
    ? addDayKey(settle.lastSettledDay, 1)
    : today
  const from = requestedFrom < floor ? floor : requestedFrom

  const out = [...rows]
  const index = new Map(out.map((row, i) => [row.id, i]))
  let changed = false

  const replaceAt = (record: HabitDayRecord) => {
    const at = index.get(record.id)
    if (at === undefined) {
      index.set(record.id, out.length)
      out.push(record)
      changed = true
      return
    }
    const current = out[at]
    if (
      current &&
      current.state === record.state &&
      current.due === record.due &&
      current.focusCount === record.focusCount &&
      current.manualCount === record.manualCount &&
      current.seconds === record.seconds
    ) {
      return
    }
    out[at] = record
    changed = true
  }

  if (from > yesterday) {
    const nextSettle = { ...settle, lastSettledDay: yesterday }
    return {
      rows: out,
      settle: nextSettle,
      changed: changed || settle.lastSettledDay !== nextSettle.lastSettledDay,
    }
  }

  // 成功日志按 habit:day 分桶，避免每天扫全量
  const successByDay = new Map<string, HabitLog[]>()
  for (const log of logs) {
    if (!log.success) continue
    const key = `${log.habit}|${habitLogDay(log)}`
    const list = successByDay.get(key)
    if (list) list.push(log)
    else successByDay.set(key, [log])
  }

  for (const day of dayKeysBetween(from, yesterday)) {
    const date = dayKeyToDate(day)
    const ctx = dayContextOf(date)
    for (const habit of habits) {
      if (day < habitCreatedDay(habit, now)) continue
      const id = habitDayRowId(habit.id, day)
      const existing = index.has(id) ? out[index.get(id)!] : undefined
      const facts = successByDay.get(`${habit.id}|${day}`)

      if (facts && facts.length > 0) {
        const record = deriveHabitDay({ habit, day, logs, existing, now, dayContextOf })
        if (record) replaceAt(record)
        continue
      }
      if (existing?.state === 'excused') continue
      // 该做日，或已有“该做/临时加做”的行（周期说休息也要把 pending 结算成 missed）
      if (isHabitDue(habit, date, ctx) || existing?.due || existing?.manualDue) {
        const record = deriveHabitDay({
          habit,
          day,
          logs,
          existing,
          now,
          dayContextOf,
        })
        if (record) replaceAt(record)
      }
    }
  }

  const nextSettle = { ...settle, lastSettledDay: yesterday }
  return {
    rows: out,
    settle: nextSettle,
    changed: changed || settle.lastSettledDay !== nextSettle.lastSettledDay,
  }
}

/** 迁移：补日志的 day/source 与习惯的 createdAt（幂等） */
export interface NormalizeHabitDataResult {
  habits: Habit[]
  logs: HabitLog[]
  changed: boolean
}

export function normalizeHabitData(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  now = new Date(),
): NormalizeHabitDataResult {
  let changed = false
  const earliest = new Map<string, number>()
  for (const log of logs) {
    const current = earliest.get(log.habit)
    if (current === undefined || log.time < current) earliest.set(log.habit, log.time)
  }

  const nextHabits = habits.map((habit) => {
    if (habit.createdAt && habit.createdAt > 0) return habit
    const created = Math.min(
      habit.lastTime && habit.lastTime > 0 ? habit.lastTime : now.getTime(),
      earliest.get(habit.id) ?? now.getTime(),
      now.getTime(),
    )
    changed = true
    return { ...habit, createdAt: created }
  })

  const nextLogs = logs.map((log) => {
    const day = log.day || localDayKey(log.time)
    const source = log.source ?? 'focus'
    if (log.day === day && log.source === source) return log
    changed = true
    return { ...log, day, source }
  })

  return { habits: nextHabits, logs: nextLogs, changed }
}

export interface BuildHabitDayRowsParams {
  habits: readonly Habit[]
  logs: readonly HabitLog[]
  rows: readonly HabitDayRecord[]
  now?: Date
  dayContextOf: DayContextResolver
  /** 首次升级回填最近 N 天的缺失；0 = 不回填 */
  backfillDays?: number
  /**
   * 忽略习惯创建日，从窗口起点开始补齐。
   * 用于“只要规则判定该做，过去一律要有未完成的账”的诉求。
   */
  ignoreCreatedAt?: boolean
}

/**
 * 首次升级用：把历史成功日志投影成 done 行，并可选回填最近 N 天的 missed。
 * 不重算已有行；已有行的 due 快照优先。
 */
export function buildHabitDayRows({
  habits,
  logs,
  rows,
  now = new Date(),
  dayContextOf,
  backfillDays = 30,
  ignoreCreatedAt = false,
}: BuildHabitDayRowsParams): HabitDayRecord[] {
  const today = localDayKey(now)
  const yesterday = addDayKey(today, -1)
  const out = [...rows]
  const index = new Map(out.map((row, i) => [row.id, i]))

  const upsert = (record: HabitDayRecord) => {
    const at = index.get(record.id)
    if (at === undefined) {
      index.set(record.id, out.length)
      out.push(record)
    } else {
      out[at] = record
    }
  }

  const successByDay = new Map<string, HabitLog[]>()
  for (const log of logs) {
    if (!log.success) continue
    const key = `${log.habit}|${habitLogDay(log)}`
    const list = successByDay.get(key)
    if (list) list.push(log)
    else successByDay.set(key, [log])
  }

  for (const [key, facts] of successByDay) {
    const [habitId, day] = key.split('|')
    const habit = habits.find((item) => item.id === habitId)
    if (!habit || !day || day > today) continue
    const existing = index.has(`${habitId}:${day}`)
      ? out[index.get(`${habitId}:${day}`)!]
      : undefined
    const record = deriveHabitDay({
      habit,
      day,
      logs: facts,
      existing,
      now,
      dayContextOf,
    })
    if (record) upsert(record)
  }

  if (backfillDays > 0) {
    for (const habit of habits) {
      const created = habitCreatedDay(habit, now)
      const from = addDayKey(today, -Math.max(0, backfillDays))
      const start = ignoreCreatedAt ? from : created > from ? created : from
      for (const day of dayKeysBetween(start, yesterday)) {
        const id = habitDayRowId(habit.id, day)
        if (index.has(id)) continue
        if (successByDay.has(`${habit.id}|${day}`)) continue
        if (!isHabitDue(habit, dayKeyToDate(day), dayContextOf(dayKeyToDate(day)))) continue
        const record = deriveHabitDay({ habit, day, logs, now, dayContextOf })
        if (record) upsert(record)
      }
    }
  }

  return out
}

export interface HabitDayViewParams {
  habit: Habit
  day: string
  rows: readonly HabitDayRecord[]
  logs: readonly HabitLog[]
  now?: Date
  dayContextOf: DayContextResolver
}

/** 任意一天的视图：卡片 7 格、月历、日视图、筛选共用 */
export function habitDayView({
  habit,
  day,
  rows,
  logs,
  now = new Date(),
  dayContextOf,
}: HabitDayViewParams): HabitDayView {
  const today = localDayKey(now)
  const date = dayKeyToDate(day)
  const row = habitDayRowOf(rows, habit.id, day)
  const due = row?.due ?? isHabitDue(habit, date, dayContextOf(date))
  const future = day > today
  const facts = habitDayFactsOf(logs, habit.id, day)

  let state: HabitDayViewState
  if (row) state = row.state
  else if (future) state = 'future'
  else if (day === today) state = due ? 'pending' : 'off'
  // 过去的该做日没有记录就是未完成：不依赖是否已经写过日记录，
  // 这样翻到任意旧月份都能看到缺失，而不会在某个日期突然断掉。
  else state = due ? 'missed' : 'off'

  return {
    day,
    date,
    due,
    state,
    focusCount: row?.focusCount ?? facts.focusCount,
    manualCount: row?.manualCount ?? facts.manualCount,
    seconds: row?.seconds ?? facts.seconds,
    isToday: day === today,
  }
}

export function habitDayViewsInRange(
  params: Omit<HabitDayViewParams, 'day'> & { from: string; to: string },
): HabitDayView[] {
  return dayKeysBetween(params.from, params.to).map((day) =>
    habitDayView({ ...params, day }),
  )
}

/** 最近 count 天（含今天），从旧到新 */
export function habitRecentDays(
  params: Omit<HabitDayViewParams, 'day'> & { count?: number },
): HabitDayView[] {
  const count = Math.max(1, params.count ?? 7)
  const today = localDayKey(params.now ?? new Date())
  return Array.from({ length: count }, (_, i) =>
    habitDayView({ ...params, day: addDayKey(today, -(count - 1 - i)) }),
  )
}

function rangeDoneDue(
  params: Omit<HabitDayViewParams, 'day'> & { from: string; to: string },
): { due: number; done: number } {
  let due = 0
  let done = 0
  const today = localDayKey(params.now ?? new Date())
  for (const day of dayKeysBetween(params.from, params.to)) {
    if (day > today) break
    const row = habitDayRowOf(params.rows, params.habit.id, day)
    if (row) {
      if (!row.due || row.state === 'excused') continue
      due += 1
      if (row.state === 'done') done += 1
      continue
    }
    // 没有日记录：今天和过去只要该做，都计入分母（过去的按未完成算）
    if (isHabitDue(params.habit, dayKeyToDate(day), params.dayContextOf(dayKeyToDate(day)))) {
      due += 1
    }
  }
  return { due, done }
}

function currentStreak(
  params: Omit<HabitDayViewParams, 'day'>,
  rowsByDay: Map<string, HabitDayRecord>,
): number {
  const today = localDayKey(params.now ?? new Date())
  const created = habitCreatedDay(params.habit, params.now ?? new Date())
  let streak = 0
  let cursor = today
  for (let guard = 0; guard < MAX_STREAK_DAYS; guard += 1) {
    if (cursor < created) break
    const row = rowsByDay.get(cursor)
    if (row) {
      if (row.due) {
        if (row.state === 'done') streak += 1
        else if (row.state === 'missed') break
        // excused：跳过，不打断也不计数
      }
      cursor = addDayKey(cursor, -1)
      continue
    }
    // 今天未做：不清零，从昨天继续数
    if (cursor === today) {
      cursor = addDayKey(cursor, -1)
      continue
    }
    // 没有账的过去 = 休息或未记录：跳过，不打断连续。
    // 周期临时改了也不会因为旧休息日突然被判成“该做却没做”而清零。
    cursor = addDayKey(cursor, -1)
  }
  return streak
}

function bestStreakOf(rows: readonly HabitDayRecord[]): number {
  let best = 0
  let run = 0
  for (const row of [...rows].sort((a, b) => (a.day < b.day ? -1 : 1))) {
    if (!row.due) continue
    if (row.state === 'excused') continue
    if (row.state === 'done') {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return best
}

export interface HabitStatsParams {
  habit: Habit
  rows: readonly HabitDayRecord[]
  logs: readonly HabitLog[]
  now?: Date
  dayContextOf: DayContextResolver
}

/** 卡片与详情头部用的汇总；所有口径都来自日记录 + 日志 */
export function habitStats({
  habit,
  rows,
  logs,
  now = new Date(),
  dayContextOf,
}: HabitStatsParams): HabitStats {
  const ownRows = rows.filter((row) => row.habit === habit.id)
  const ownLogs = logs.filter((log) => log.habit === habit.id && log.success)
  const rowsByDay = new Map(ownRows.map((row) => [row.day, row]))
  const today = localDayKey(now)
  const monthStart = `${today.slice(0, 7)}-01`

  let focusCount = 0
  let manualCount = 0
  for (const log of ownLogs) {
    if (habitLogSource(log) === 'manual') manualCount += 1
    else focusCount += 1
  }

  const doneRows = ownRows.filter((row) => row.due && row.state === 'done')
  const missedRows = ownRows.filter((row) => row.state === 'missed')
  const excusedRows = ownRows.filter((row) => row.state === 'excused')
  const dueRows = ownRows.filter((row) => row.due && row.state !== 'excused')

  const week = rangeDoneDue({
    habit,
    rows,
    logs,
    now,
    dayContextOf,
    from: addDayKey(today, -6),
    to: today,
  })
  const month = rangeDoneDue({
    habit,
    rows,
    logs,
    now,
    dayContextOf,
    from: monthStart,
    to: today,
  })

  return {
    focusCount,
    manualCount,
    doneDays: doneRows.length,
    dueDays: dueRows.length,
    missedDays: missedRows.length,
    excusedDays: excusedRows.length,
    weekDue: week.due,
    weekDone: week.done,
    monthDue: month.due,
    monthDone: month.done,
    monthRate: month.due > 0 ? Math.round((month.done / month.due) * 100) : 0,
    streak: currentStreak({ habit, rows, logs, now, dayContextOf }, rowsByDay),
    bestStreak: bestStreakOf(ownRows),
  }
}

/** 某天是否“有记录”（完成或请假），供筛选与跳转用 */
export function habitHasDayRecord(
  rows: readonly HabitDayRecord[],
  habitId: string,
  day: string,
): boolean {
  return rows.some((row) => row.habit === habitId && row.day === day)
}

/** 日记录状态 → 展示文案；界面统一用它，避免各自造词 */
export const HABIT_RECORD_STATE_LABELS: Record<HabitRecordState, string> = {
  pending: '待做',
  done: '已完成',
  missed: '未完成',
  excused: '已请假',
}
