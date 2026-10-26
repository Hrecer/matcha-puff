/**
 * 专注状态的前端镜像。
 *
 * 时间由 Rust 持有，这里只订阅快照；业务入账（统计、任务计数、习惯日志）
 * 全部在 `consumePending` 里完成，并用 sessionId 去重，保证 ack 之前崩溃也不会重复记。
 */
import { useSyncExternalStore } from 'react'
import {
  DEFAULT_CONFIG,
  DEFAULT_RING,
  UNASSIGNED_TASK,
  applyFocusSeconds,
  archiveDay,
  buildTaskTree,
  createSummary,
  flattenTaskTree,
  isSameDay,
  nextRestKind,
  recordFinishedSession,
  resetToday,
  restMinutes,
} from '@matcha-puff/pomodoro-core'
import type {
  FocusPolicy,
  FocusSession,
  FocusSnapshot,
  HabitLog,
  PendingFinish,
  PomodoroConfig,
  RingSettings,
  Summary,
  TaskRef,
} from '@matcha-puff/pomodoro-core'
import * as api from '@/lib/focus-api'
import * as repo from '@/lib/focus-repo'
import { playNotify, syncPhaseAudio } from '@/lib/focus-audio'
import { beginHabitLog, invalidateFocusData } from '@/lib/focus-data'
import { toast } from '@/components/ui/toast'

interface FocusStoreState {
  ready: boolean
  supported: boolean
  snapshot: FocusSnapshot | null
  config: PomodoroConfig
  ring: RingSettings
  summary: Summary
  error: string | null
}

let state: FocusStoreState = {
  ready: false,
  supported: api.focusSupported(),
  snapshot: null,
  config: { ...DEFAULT_CONFIG },
  ring: { ...DEFAULT_RING },
  summary: createSummary(),
  error: null,
}

const listeners = new Set<() => void>()

function emit(patch: Partial<FocusStoreState>): void {
  const prev = state
  state = { ...state, ...patch }
  if (state.snapshot) {
    syncPhaseAudio(prev.snapshot?.phase ?? 'idle', state.snapshot.phase, state.ring)
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getState = (): FocusStoreState => state

export function useFocusStore(): FocusStoreState {
  return useSyncExternalStore(subscribe, getState, getState)
}

export function getFocusStore(): FocusStoreState {
  return state
}

let syncInitialized = false
let dataInitialized = false
let queue: Promise<void> = Promise.resolve()

function enqueue(pending: PendingFinish): void {
  queue = queue
    .then(() => consumePending(pending))
    .catch((error) => emit({ error: String(error) }))
}

/**
 * 主动向宿主补一次快照。
 *
 * 窗口在隐藏期间可能错过 focus:phase（托盘菜单收起时停止了专注，
 * 再打开还原样显示暂停/停止）。重新获得焦点或变为可见时用真实状态覆盖。
 */
export async function refreshFocusSnapshot(): Promise<void> {
  if (!state.supported) return
  try {
    const snapshot = await api.getFocusState()
    if (snapshot) emit({ snapshot, ready: true })
  } catch {
    // 取不到就保留当前快照，下次获得焦点再补
  }
}

/** 只同步计时快照：工具子窗的芯片用这个，不读写业务文档。 */
export async function initFocusSync(): Promise<void> {
  if (syncInitialized) return
  syncInitialized = true

  if (!state.supported) {
    emit({ ready: true })
    return
  }

  try {
    const snapshot = await api.getFocusState()
    emit({ snapshot, ready: true })

    api.onTick((next) => emit({ snapshot: next }))
    api.onPhase((next) => {
      emit({ snapshot: next })
      if (dataInitialized && next.pending) enqueue(next.pending)
    })
    // 隐藏窗口的页面会被挂起、收不到广播：每次重新露出来都对一次真状态
    window.addEventListener('focus', () => void refreshFocusSnapshot())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void refreshFocusSnapshot()
    })
    api.onFinished((pending) => {
      if (!dataInitialized) return
      if (pending.completed) {
        // 专注走完会进入「时间到」响铃态，声音由 syncPhaseAudio 循环播放；
        // 休息走完才需要这声单次提示。
        if (pending.phase === 'rest') playNotify(state.ring.pomodoroNotify)
        if (state.config.notify) {
          const body =
            pending.phase === 'focus'
              ? '已完成一个番茄，休息一下。'
              : '休息结束，开始下一段专注。'
          void api.notifyHost('抹茶泡芙', body).catch(() => {})
        }
      }
      enqueue(pending)
    })
  } catch (error) {
    emit({ ready: true, error: String(error) })
  }
}

/** 主窗口初始化：载入配置/摘要，并消费启动时残留的结算。 */
export async function initFocusStore(): Promise<void> {
  await initFocusSync()
  if (dataInitialized) return
  dataInitialized = true

  if (!state.supported) return

  try {
    const [config, ring, summary] = await Promise.all([
      repo.loadConfig(),
      repo.loadRing(),
      repo.loadSummary(),
    ])
    emit({ config, ring, summary })
    await rolloverIfNeeded()

    const pending = state.snapshot?.pending
    if (pending) await consumePending(pending)
  } catch (error) {
    emit({ error: String(error) })
  }
}

function policyOf(config: PomodoroConfig): FocusPolicy {
  return {
    restMinutes: config.restTime,
    longRestMinutes: config.longRestTime,
    longRestInterval: config.longRestInterval,
    autoRest: config.autoRest,
    disableRest: config.disableRest,
  }
}

/**
 * 开始一段专注。
 *
 * @returns 是否真的开始了；被「已有会话在跑」拦下时返回 false，
 * 调用方据此决定要不要切页 —— 拦下来了就不该动界面。
 */
export async function startFocus(minutes: number, task: TaskRef = UNASSIGNED_TASK): Promise<boolean> {
  // 已经有会话在跑就不再覆盖：直接开新的一段会把正在走的时间、任务上下文和
  // 「本轮」计数一起冲掉。所有入口（番茄钟页、任务页、习惯页、四象限、托盘）
  // 都会经过这里，所以只在这拦一次就够。
  const current = state.snapshot?.phase ?? 'idle'
  if (current !== 'idle') {
    toast(
      current === 'rest'
        ? '正在休息中，先结束这一段'
        : current === 'awaiting'
          ? '时间到，先确认这一段'
          : '已经有一个番茄钟在运行',
    )
    return false
  }
  // 上一段还没入账就先补掉，避免开新会话时把旧结算丢掉。
  if (state.snapshot?.pending) await consumePending(state.snapshot.pending)
  // 习惯：开始时只占一条待确认记录，完成时（bumpTask）才置 success。
  if (task.type === 1) await beginHabitLog(task.id)
  const snapshot = await api.startFocus({
    minutes,
    task,
    policy: policyOf(state.config),
  })
  emit({ snapshot, error: null })
  return true
}

export async function pauseFocus(): Promise<void> {
  emit({ snapshot: await api.pauseFocus() })
}

export async function resumeFocus(): Promise<void> {
  emit({ snapshot: await api.resumeFocus() })
}

export async function stopFocus(): Promise<void> {
  const snapshot = await api.stopFocus()
  emit({ snapshot })
  if (snapshot.pending) enqueue(snapshot.pending)
}

export async function skipCurrentRest(): Promise<void> {
  const snapshot = await api.skipRest()
  emit({ snapshot })
}

/** 手动开始休息：短/长由当前周期计数决定（completed>0 才可能长休）。 */
export async function startManualRest(): Promise<void> {
  const { config, snapshot } = state
  const kind = nextRestKind(snapshot?.cycleCompleted ?? 0, config.longRestInterval)
  emit({ snapshot: await api.startRest(restMinutes(config, kind), kind) })
}

/** 设置变更后重新读配置（恢复默认等外部改动时调用） */
export async function refreshFocusSettings(): Promise<void> {
  const [config, ring] = await Promise.all([repo.loadConfig(), repo.loadRing()])
  emit({ config, ring })
}

/** 设置页保存成功后把值直接推入镜像，避免再读盘让快速切换时旧值回弹 */
export function publishFocusSettings(config: PomodoroConfig, ring: RingSettings): void {
  emit({ config, ring })
}

async function rolloverIfNeeded(): Promise<void> {
  const summary = state.summary
  if (isSameDay(summary.update, Date.now())) return

  const statistics = await repo.loadStatistics()
  await repo.saveStatistics(archiveDay(statistics, summary, summary.update))
  const next = resetToday(summary)
  await repo.saveSummary(next)
  emit({ summary: next })
}

async function consumePending(pending: PendingFinish): Promise<void> {
  const processed = await repo.loadProcessed()
  if (processed.includes(pending.sessionId)) {
    await api.ackPending()
    emit({ snapshot: state.snapshot ? { ...state.snapshot, pending: null } : null })
    return
  }

  await rolloverIfNeeded()

  const task = pending.task ?? UNASSIGNED_TASK
  let summary = state.summary

  if (pending.phase === 'focus') {
    summary = pending.completed
      ? recordFinishedSession(summary, task, pending.seconds, pending.at)
      : applyFocusSeconds(summary, task, pending.seconds, pending.at)
  }

  // 会话明细按 sessionId 去重：崩溃重放时不会多出一条会话
  if (pending.phase === 'focus' && pending.seconds > 0) {
    const sessions = await repo.loadSessions()
    if (!sessions.some((session) => session.id === pending.sessionId)) {
      const entry: FocusSession = {
        id: pending.sessionId,
        task,
        start: Math.max(0, pending.at - pending.seconds * 1000),
        end: pending.at,
        seconds: pending.seconds,
        completed: pending.completed,
      }
      await repo.saveSessions([...sessions, entry])
    }
  }

  // 先记「已处理」再写业务数据：中途崩溃最多少记一次，绝不会重复计数。
  await repo.saveProcessed([...processed, pending.sessionId].slice(-100))
  await repo.saveSummary(summary)
  emit({ summary })

  if (pending.phase === 'focus' && pending.completed) {
    await bumpTask(task, pending.at)
  }

  await api.ackPending()
  emit({ snapshot: state.snapshot ? { ...state.snapshot, pending: null } : null })

  invalidateFocusData()

  if (pending.completed) await maybeAutoNext(pending)
}

/** 自动下一个：休息由 Rust 负责，这里只负责「休息/完成之后是否再开一段」 */
async function maybeAutoNext(pending: PendingFinish): Promise<void> {
  const config = state.config
  if (!config.autoNextPomodoro) return
  // 已自动进入休息时，等休息结束再决定
  if (pending.phase === 'focus' && config.autoRest && !config.disableRest) return

  const task = state.snapshot?.task ?? pending.task
  if (!task || task.type === 1) return

  if (task.type === 2 || task.type === 3) {
    // 任务树里「完成」是派生值：整棵子树都做完才算完成，和界面上看到的一致。
    const tasks = await repo.loadTasks()
    const entry = flattenTaskTree(buildTaskTree(tasks)).find((item) => item.node.task.id === task.id)
    if (!entry || entry.node.complete) {
      toast(`${task.name} 已完成`)
      return
    }
  }

  await startFocus(config.pomodoroTime, task)
}

async function bumpTask(task: TaskRef, at: number): Promise<void> {
  if (task.type === 1) {
    await markHabitSuccess(task.id, at)
    return
  }
  // 无归属会话只记时间，不挂到任何任务上。
  if (task.type === 0) return

  const tasks = await repo.loadTasks()
  const index = tasks.findIndex((item) => item.id === task.id)
  if (index < 0) return
  await repo.saveTasks(
    tasks.map((item, i) => (i === index ? { ...item, pomodoroCount: (item.pomodoroCount || 0) + 1 } : item)),
  )
}

/** 习惯在「完成」时才计一次执行：开始时那条是 success=false 的占位记录。 */
async function markHabitSuccess(habitId: string, at: number): Promise<void> {
  const logs = await repo.loadHabitLogs()
  // 同一天可能有多条待确认记录，只认最近的一条，旧的留给 beginHabitLog 清理。
  const index = logs.reduce<number>((found, log, i) => {
    if (log.habit !== habitId || log.success) return found
    if (found < 0) return i
    return log.time > logs[found].time ? i : found
  }, -1)
  if (index >= 0) {
    const next = logs.map((log, i) => (i === index ? { ...log, success: true } : log))
    await repo.saveHabitLogs(next)
    return
  }
  const entry: HabitLog = {
    id: `habit-${at}-${Math.random().toString(36).slice(2, 8)}`,
    habit: habitId,
    time: at,
    success: true,
  }
  await repo.saveHabitLogs([...logs, entry])
}
