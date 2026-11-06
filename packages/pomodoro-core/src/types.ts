/** 专注模式的领域类型。字段名与存储结构保持一致。 */

export type StartPage = 'index' | 'focus' | 'tools' | 'favorites'

export interface PomodoroConfig {
  pomodoroTime: number
  restTime: number
  longRestTime: number
  longRestInterval: number
  autoNextPomodoro: boolean
  autoRest: boolean
  disableRest: boolean
  notify: boolean
  index: StartPage
}

export interface RingSettings {
  pomodoroNotify: string
  whiteNoise: string
  restNoise: string
}

export interface SoundItem {
  title: string
  name: string
}

/** 0 = 无归属，1 = 习惯，2 = 任务，3 = 子任务 */
export type TaskType = 0 | 1 | 2 | 3

/** 四象限：1 重要且紧急 / 2 重要不紧急 / 3 不重要但紧急 / 4 不重要不紧急 */
export type TaskQuadrant = 1 | 2 | 3 | 4

export interface TaskRef {
  id: string
  name: string
  desc: string
  type: TaskType
}

export interface TaskTime {
  id: string
  name: string
  /** 当天在该任务上累计的专注秒数 */
  value: number
}

export interface Summary {
  allPomodoroCount: number
  /** 累计专注秒数 */
  allPomodoroTime: number
  firstTime: number
  todayPomodoro: number
  /** 今日专注秒数 */
  todayTime: number
  update: number
  todayTasks: TaskTime[]
}

export interface DayKey {
  year: string
  month: string
  day: string
}

export interface DayStatistic extends DayKey {
  /** 专注秒数 */
  pomodoroTime: number
  pomodoroCount: number
  tasks: TaskTime[]
}

export interface TaskDraft {
  id: string
  title: string
  desc: string
  startDate: number
  endDate: number
  pomodoroCount: number
  pomodoroTotal: number
  /** 四象限；只有叶子任务使用，未指定按 Q2 展示 */
  quadrant?: TaskQuadrant
  /** 顶层任务的手动颜色；未指定 = 灰色 */
  color?: string
}

export interface SubtaskDraft extends TaskDraft {
  futureId: string
}

/** 习惯周期：每天 / 工作日 / 法定节假日 / 每年 / 周几 / 月初月末 */
export type HabitCycle =
  | 'daily'
  | 'workday'
  | 'holiday'
  | 'yearly'
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun'
  | 'monthStart'
  | 'monthEnd'

/** 周期描述；annual 的月/日只在 cycle = yearly 时有意义 */
export interface HabitSchedule {
  cycle: HabitCycle
  anchorMonth?: number
  anchorDay?: number
}

export interface Habit extends HabitSchedule {
  id: string
  name: string
  desc: string
  /** 单次专注分钟数 */
  time: number
  lastTime: number
  /** 创建时刻；日结下界，旧数据缺失时用 lastTime / 最早日志推断 */
  createdAt?: number
  /** 手选颜色；空表示未设色，界面统一用灰 */
  color?: string
  /** 四象限归属；旧习惯没有该字段时按重要不紧急（Q2）处理 */
  quadrant?: TaskQuadrant
}

/** 一次执行的来源：番茄完成，或手动打卡/补记 */
export type HabitLogSource = 'focus' | 'manual'

export interface HabitLog {
  id: string
  habit: string
  /** 归属日 yyyy-mm-dd；旧日志缺失时由 time 的本地日期推导 */
  day?: string
  time: number
  /** 开始计时时先写 false 占位，完成那一刻才置 true —— 中断的番茄不计入执行次数 */
  success: boolean
  /** 旧日志缺失时按 focus 处理 */
  source?: HabitLogSource
  /** 该次实际专注秒数；手动打卡没有 */
  seconds?: number
  /** 是否为事后补记（只影响明细文案） */
  backfilled?: boolean
}

/**
 * 一天最终写下的结论；休息日默认不写行。
 * pending 只用于“单日临时加做”：今天被手动改成本该做、但还没完成。
 */
export type HabitRecordState = 'pending' | 'done' | 'missed' | 'excused'

/** 每天账：只存有事实的日期（完成 / 缺失 / 请假） */
export interface HabitDayRecord {
  /** 确定性 id：`${habit}:${day}` */
  id: string
  habit: string
  /** yyyy-mm-dd */
  day: string
  /** 写入时快照：这一天当时是否在计划内 */
  due: boolean
  state: HabitRecordState
  /** 当天成功完成的专注次数（不含手动） */
  focusCount: number
  /** 当天手动打卡条数 */
  manualCount: number
  /** 当天专注秒数合计 */
  seconds: number
  /** auto = 日结写入；manual = 用户打卡/补记；excused = 请假 */
  source: 'auto' | 'manual' | 'excused'
  /** 这一天是用户临时加做的（本应休息），优先级高于周期判定 */
  manualDue?: boolean
  settledAt: number
  updatedAt: number
  note?: string
}

/** 日结游标：上次结算到哪一天，避免每次启动全量重扫 */
export interface HabitSettle {
  /** yyyy-mm-dd；空表示尚未结算过 */
  lastSettledDay: string
  /** 迁移版本；1 = 已把旧日志补齐 day/source */
  version: number
  /** 首次升级回填的缺失天数（0 表示不回填） */
  backfillDays?: number
}

/** 日历/卡片上看到的日状态（pending / off 不落库，实时算） */
export type HabitDayViewState = 'done' | 'pending' | 'missed' | 'excused' | 'off' | 'future'

export interface HabitDayView {
  day: string
  date: Date
  due: boolean
  state: HabitDayViewState
  focusCount: number
  manualCount: number
  seconds: number
  isToday: boolean
}

export interface HabitStats {
  /** 全部成功 focus 日志 */
  focusCount: number
  /** 全部成功 manual 日志 */
  manualCount: number
  /** 该做且完成的天数（due=true 的 done 行） */
  doneDays: number
  /** 该做天数（done + missed，不含请假） */
  dueDays: number
  missedDays: number
  excusedDays: number
  /** 最近 7 天该做/完成（含今天；今天未做计入分母） */
  weekDue: number
  weekDone: number
  /** 本月该做/完成 */
  monthDue: number
  monthDone: number
  /** 本月完成率 0–100 */
  monthRate: number
  /** 当前连续（按该做日，休息/请假跳过） */
  streak: number
  /** 历史最长连续 */
  bestStreak: number
}

/** 一次专注会话（完成或中途停止），用于日历的时段与会话级明细 */
export interface FocusSession {
  id: string
  task: TaskRef
  /** 开始 / 结束（毫秒） */
  start: number
  end: number
  /** 实际专注秒数（不含暂停） */
  seconds: number
  completed: boolean
}

export interface InboxSubTask {
  id: string
  /** 归档时的父节点 id（null/缺省 = 顶层）；还原时据此重建层级 */
  parentId?: string | null
  title: string
  desc: string
  count: number
  start?: number
  end?: number
  time?: number
  state?: number
}

export interface InboxRecord {
  id: string
  title: string
  desc: string
  start: number
  end: number
  count: number
  subtask: InboxSubTask[]
  time: number
}

/**
 * 专注阶段
 *
 * awaiting：专注刚走完、等着用户确认。此时不计时、不自动进休息，
 * 只有「开始休息」或「知道了」才会离开 —— 这就是「响铃」态。
 */
export type FocusPhase = 'idle' | 'focus' | 'rest' | 'awaiting'

/** Rust 计时内核的快照阶段（比 FocusPhase 多一个 paused） */
export type EnginePhase = FocusPhase | 'paused'

export type RestKind = 'short' | 'long'

/** Rust 到点后留下的待结算记录，TS 消费后 ack */
export interface PendingFinish {
  sessionId: string
  phase: 'focus' | 'rest'
  task: TaskRef | null
  seconds: number
  completed: boolean
  restKind: RestKind | null
  at: number
}

/** `focus_state` 返回的快照（camelCase，与 Rust serde 对齐） */
export interface FocusSnapshot {
  phase: EnginePhase
  pausedFrom: 'focus' | 'rest' | null
  restKind: RestKind | null
  task: TaskRef | null
  durationMs: number
  remainMs: number
  progress: number
  cycleCompleted: number
  paused: boolean
  pending: PendingFinish | null
}

/** 启动专注时同步给 Rust 的策略；TS 是配置的唯一来源 */
export interface FocusPolicy {
  restMinutes: number
  longRestMinutes: number
  longRestInterval: number
  autoRest: boolean
  disableRest: boolean
}

/** 一轮专注的计数：跨天不清零，长休后归零，间隔过久视为新一段 */
export interface CycleState {
  completed: number
  lastCompletedAt: number | null
}

export interface FocusSessionSnapshot {
  sessionId: string
  phase: FocusPhase
  restKind: RestKind | null
  task: TaskRef | null
  durationMs: number
  deadline: number
  accumulatedMs: number
  cycle: CycleState
  paused: boolean
}
