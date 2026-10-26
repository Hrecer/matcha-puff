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
  /** 手选颜色；空表示未设色，界面统一用灰 */
  color?: string
  /** 四象限归属；旧习惯没有该字段时按重要不紧急（Q2）处理 */
  quadrant?: TaskQuadrant
}

export interface HabitLog {
  id: string
  habit: string
  time: number
  /** 开始计时时先写 false 占位，完成那一刻才置 true —— 中断的番茄不计入执行次数 */
  success: boolean
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
