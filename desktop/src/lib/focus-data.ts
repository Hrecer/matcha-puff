/**
 * 专注业务数据（任务树 / 习惯 / 执行记录 / 收件箱 / 日统计）。
 *
 * 任务只有一份：`tasks` 单表承载任意层级，读写统一走 `focus-repo`；
 * 这里把任务树聚合为界面状态，并提供 CRUD 与归档。
 *
 * 界面暂时仍按「顶层任务 + 一层子任务」渲染（下一步换成完整树视图），
 * 所以这里把 TaskNode 投影成表单需要的任务 / 子任务草稿，数值一律用派生汇总。
 */
import { useSyncExternalStore } from 'react'
import {
  buildTaskTree,
  canMoveTask,
  descendantIds,
  flattenTaskTree,
  isHabitDue,
  moveTask,
  nextOrder,
  removeTaskCascade,
  setTaskDone,
} from '@matcha-puff/pomodoro-core'
import {
  dayContextOf,
  holidayMissingAt,
  loadHolidays,
  refreshHolidays,
  subscribeHolidays,
} from '@/lib/workday'
import type {
  DayStatistic,
  FocusSession,
  Habit,
  HabitCycle,
  HabitLog,
  InboxRecord,
  SubtaskDraft,
  Summary,
  Task,
  TaskDraft,
  TaskNode,
} from '@matcha-puff/pomodoro-core'
import * as repo from '@/lib/focus-repo'

// 日历等界面统一从这里拿节假日上下文，避免 workday 模块被加载成两份后拿到空表
export { dayContextOf, ensureHolidayYear } from '@/lib/workday'

export interface HabitNode {
  habit: Habit
  due: boolean
  logs: HabitLog[]
  /** 完成次数（开始时写的占位记录是 success=false，不计） */
  count: number
  lastTime: number
}

interface FocusDataState {
  ready: boolean
  /** 任务树根节点（含派生汇总），树视图直接用它 */
  roots: TaskNode[]
  habits: HabitNode[]
  /** 今年的节假日表还没拿到：工作日 / 法定节假日 习惯只能按周一至周五近似 */
  holidayMissing: boolean
  inbox: InboxRecord[]
  statistics: DayStatistic[]
  summary: Summary | null
  /** 会话级明细：日历的时间轴与按任务筛选专注都要用 */
  sessions: FocusSession[]
}

const EMPTY: FocusDataState = {
  ready: false,
  roots: [],
  habits: [],
  holidayMissing: false,
  inbox: [],
  statistics: [],
  summary: null,
  sessions: [],
}

let state: FocusDataState = EMPTY
const listeners = new Set<() => void>()
let loading: Promise<void> | null = null
/** 读数据期间又有改动（删任务、入账…）：这一轮读完必须再读一次，不然界面会停在旧数据上 */
let dirty = false

function emit(patch: Partial<FocusDataState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getState = (): FocusDataState => state

export function useFocusData(): FocusDataState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/** 其它模块（例如专注入账）改完文档后调用，界面据此重新聚合。 */
export function invalidateFocusData(): void {
  // 正在读：标记一下，读完立刻补读（不能只是 return，那样这次改动会被丢掉）
  if (loading) {
    dirty = true
    return
  }
  void loadFocusData()
}

/** 任务树节点 → 表单任务投影（数值全部取派生值） */
export function topTaskViewOf(node: TaskNode): TaskDraft {
  return {
    id: node.task.id,
    title: node.task.title,
    desc: node.task.desc,
    startDate: node.startDate,
    endDate: node.endDate,
    pomodoroCount: node.doneCount,
    pomodoroTotal: node.plannedTotal,
    quadrant: node.task.quadrant,
    color: node.task.color,
  }
}

/** 任务树节点 → 表单子任务投影（futureId 就是它的父节点） */
export function subtaskViewOf(node: TaskNode): SubtaskDraft {
  return { ...topTaskViewOf(node), futureId: node.task.parentId ?? '' }
}

function buildHabitNodes(habits: Habit[], logs: HabitLog[], now: Date): HabitNode[] {
  const day = dayContextOf(now)
  return habits.map((habit) => {
    const own = logs.filter((log) => log.habit === habit.id).sort((a, b) => b.time - a.time)
    return {
      habit,
      due: isHabitDue(habit, now, day),
      logs: own,
      count: own.filter((log) => log.success).length,
      lastTime: own[0]?.time ?? 0,
    }
  })
}

// 节假日表补齐（或失败后重试成功）时重新聚合：到期判断跟着换算法
subscribeHolidays(() => invalidateFocusData())

export async function loadFocusData(): Promise<void> {
  if (loading) return loading
  loading = (async () => {
    const [tasks, habits, logs, inbox, statistics, summary, sessions] = await Promise.all([
      repo.loadTasks(),
      repo.loadHabits(),
      repo.loadHabitLogs(),
      repo.loadInbox(),
      repo.loadStatistics(),
      repo.loadSummary(),
      repo.loadSessions(),
      // 先把本地那份节假日表读进来（读不到就是空表），判断到期时才有依据
      loadHolidays(),
    ])
    const roots = buildTaskTree(tasks)
    emit({
      ready: true,
      roots,
      habits: buildHabitNodes(habits, logs, new Date()),
      holidayMissing: holidayMissingAt(new Date()),
      inbox: [...inbox].sort((a, b) => b.time - a.time),
      statistics,
      summary,
      sessions,
    })
    // 缺今年 / 明年的表就去补拉；失败或离线就静默留着，第二天再试
    void refreshHolidays()
  })().finally(() => {
    loading = null
    // 这轮读的同时又改了数据：补读一次，保证界面拿到的是改完之后的状态
    if (dirty) {
      dirty = false
      void loadFocusData()
    }
  })
  return loading
}

/** 跨天时习惯的「今天可做」会变，常驻窗口需要按分钟自检。 */
export function startFocusDataClock(): () => void {
  let day = new Date().toDateString()
  const timer = window.setInterval(() => {
    const next = new Date().toDateString()
    if (next === day) return
    day = next
    invalidateFocusData()
  }, 30_000)
  return () => window.clearInterval(timer)
}

function uid(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

export function newTopTask(
  title: string,
  desc: string,
  total: number,
  startDate: number,
  endDate: number,
): TaskDraft {
  return {
    id: uid('task'),
    title: title.trim(),
    desc: desc.trim(),
    startDate,
    endDate,
    pomodoroCount: 0,
    pomodoroTotal: Math.max(0, Math.round(total)),
  }
}

export function newSubtask(
  futureId: string,
  title: string,
  desc: string,
  total: number,
  startDate: number,
  endDate: number,
): SubtaskDraft {
  return {
    ...newTopTask(title, desc, total, startDate, endDate),
    id: uid('task'),
    futureId,
  }
}

/** 表单值 → 任务字段（不含身份与层级：编辑时不覆盖 parentId / order / createdAt） */
function taskFieldsOf(
  draft: TaskDraft,
): Pick<Task, 'title' | 'desc' | 'startDate' | 'endDate' | 'pomodoroTotal' | 'quadrant'> {
  const quadrant =
    draft.quadrant === 1 || draft.quadrant === 2 || draft.quadrant === 3 || draft.quadrant === 4
      ? draft.quadrant
      : 2
  return {
    title: draft.title.trim(),
    desc: draft.desc.trim(),
    startDate: draft.startDate || 0,
    endDate: draft.endDate || 0,
    pomodoroTotal: Math.max(0, Math.round(draft.pomodoroTotal || 0)),
    quadrant,
  }
}

/**
 * 容器（有子任务的任务）自己的时间与番茄数一律是「不定」：写库前统一清掉。
 * 不清的话，子任务全被挪走、它变回叶子时，那些旧值又会冒出来 ——
 * 界面上就变成「变成容器时清空了，变回来又有了」。
 */
function clearContainerFields(tasks: readonly Task[]): Task[] {
  const containers = new Set(
    tasks.map((task) => task.parentId).filter((id): id is string => Boolean(id)),
  )
  return tasks.map((task) =>
    containers.has(task.id) && (task.startDate > 0 || task.endDate > 0 || task.pomodoroTotal > 0)
      ? { ...task, startDate: 0, endDate: 0, pomodoroTotal: 0 }
      : task,
  )
}

/** 任务表的唯一写入口：每次写入都过一遍容器清空（幂等） */
const writeTasks = (tasks: readonly Task[]) => repo.saveTasks(clearContainerFields(tasks))

/** 新增叶子任务；parentId = null 即顶层 */
async function appendTask(parentId: string | null, draft: TaskDraft): Promise<void> {
  const tasks = await repo.loadTasks()
  const created: Task = {
    id: draft.id,
    parentId,
    order: nextOrder(tasks, parentId),
    pomodoroCount: 0,
    createdAt: Date.now(),
    ...taskFieldsOf(draft),
    color: parentId === null ? draft.color : undefined,
  }
  await writeTasks([...tasks, created])
  invalidateFocusData()
}

export async function saveTopTask(topTask: TaskDraft): Promise<void> {
  const tasks = await repo.loadTasks()
  if (!tasks.some((item) => item.id === topTask.id)) return appendTask(null, topTask)
  await writeTasks(
    tasks.map((item) =>
      item.id === topTask.id
        ? { ...item, ...taskFieldsOf(topTask), color: topTask.color || undefined }
        : item,
    ),
  )
  invalidateFocusData()
}

export async function saveSubtask(subtask: SubtaskDraft): Promise<void> {
  const tasks = await repo.loadTasks()
  if (!tasks.some((item) => item.id === subtask.id)) return appendTask(subtask.futureId, subtask)
  await writeTasks(
    tasks.map((item) =>
      item.id === subtask.id ? { ...item, ...taskFieldsOf(subtask), color: undefined } : item,
    ),
  )
  invalidateFocusData()
}

/** 删除任务及其整棵子树（层级不再封顶，所以两个入口共用一条级联删除）。 */
export async function removeTask(id: string): Promise<void> {
  await writeTasks(removeTaskCascade(await repo.loadTasks(), id))
  invalidateFocusData()
}

/**
 * 手动完成标记：给「没填番茄数」的叶子用。
 * 有计划的叶子不看这个标记，完成仍按番茄数自动判定。
 */
export async function toggleTaskDone(id: string, done: boolean): Promise<void> {
  await writeTasks(setTaskDone(await repo.loadTasks(), id, done))
  invalidateFocusData()
}

/**
 * 挪动任务：换父节点并按落点重排同级顺序。
 *
 * 合法性交给领域层的 `canMoveTask` 把关（不能挂到自己或自己的后代下），
 * 历史统计不受影响 —— 计时只挂在叶子 id 上，父值一律是实时派生。
 */
export async function moveTaskTo(
  nodeId: string,
  parentId: string | null,
  index?: number,
): Promise<void> {
  const tasks = await repo.loadTasks()
  if (!canMoveTask(tasks, nodeId, parentId).ok) return
  await writeTasks(moveTask(tasks, nodeId, parentId, index))
  invalidateFocusData()
}

export function newHabit(name: string, desc: string, cycle: HabitCycle, time: number): Habit {
  return {
    id: uid('habit'),
    name: name.trim(),
    desc: desc.trim(),
    cycle,
    time: Math.max(1, Math.round(time)),
    lastTime: Date.now(),
  }
}

export async function saveHabit(habit: Habit): Promise<void> {
  const habits = await repo.loadHabits()
  const exists = habits.some((item) => item.id === habit.id)
  await repo.saveHabits(exists ? habits.map((item) => (item.id === habit.id ? habit : item)) : [...habits, habit])
  invalidateFocusData()
}

/**
 * 习惯顺序：按 id 列表整体重排（卡片拖拽排序用）。
 * 只改数组顺序，不碰任何习惯字段。
 */
export async function reorderHabits(ids: readonly string[]): Promise<void> {
  const habits = await repo.loadHabits()
  const byId = new Map(habits.map((habit) => [habit.id, habit]))
  const next = ids
    .map((id) => byId.get(id))
    .filter((habit): habit is Habit => Boolean(habit))
  // 列表算完之后又被删/增过：没在 ids 里的按原顺序补在末尾，不至于丢
  for (const habit of habits) {
    if (!next.includes(habit)) next.push(habit)
  }
  await repo.saveHabits(next)
  invalidateFocusData()
}

export async function removeHabit(id: string): Promise<void> {
  const [habits, logs] = await Promise.all([repo.loadHabits(), repo.loadHabitLogs()])
  await repo.saveHabits(habits.filter((item) => item.id !== id))
  await repo.saveHabitLogs(logs.filter((log) => log.habit !== id))
  invalidateFocusData()
}

export async function removeInboxRecord(id: string): Promise<void> {
  const inbox = await repo.loadInbox()
  await repo.saveInbox(inbox.filter((item) => item.id !== id))
  invalidateFocusData()
}

export async function clearInbox(): Promise<void> {
  await repo.saveInbox([])
  invalidateFocusData()
}

/**
 * 逾期的任务 id：每条任务**只依据自己汇总出来的截止日**独立判断 ——
 * 过期且还没完成才算逾期，不再向上传染。
 *
 * 容器的截止日由 buildTaskTree 汇总（子任务里最晚的那个，没设日期的不参与），
 * 所以「父任务是否逾期」看的正是它各个子任务算出来的那个日期：
 * 只要还有一个子任务的截止日在将来，父任务就不算逾期。
 *
 * 界面上的「已逾期」徽章查这张表；归档按钮也用它 —— 过期的不给归档。
 */
export function overdueTaskIds(tasks: readonly Task[]): Set<string> {
  const today = new Date().setHours(0, 0, 0, 0)
  const out = new Set<string>()
  for (const { node } of flattenTaskTree(buildTaskTree(tasks))) {
    if (!node.complete && node.endDate > 0 && node.endDate < today) out.add(node.task.id)
  }
  return out
}

/**
 * 手动归档：只收「本身已完成、且没有任何父任务（顶层）」的任务。
 *
 * 子任务一律忽略：整棵子树连同明细一起从任务列表移除，收件箱里只留根本身的
 * 名称、起止日期与番茄数，不记子任务明细 —— 少一条要维护的还原链路。
 * 过期的不归档（先把日期改到不过期）；正在计时的也不归档（这一颗番茄还得入账）。
 */
export async function archiveTask(id: string): Promise<boolean> {
  const [tasks, inbox] = await Promise.all([repo.loadTasks(), repo.loadInbox()])
  const node = buildTaskTree(tasks).find((root) => root.task.id === id)
  if (!node || node.task.parentId !== null || !node.complete) return false

  const subtree = descendantIds(tasks, id)
  const record: InboxRecord = {
    id: node.task.id,
    title: node.task.title,
    desc: node.task.desc,
    start: node.startDate,
    end: node.endDate,
    count: node.plannedTotal,
    subtask: [],
    time: Date.now(),
  }
  await writeTasks(tasks.filter((task) => !subtree.has(task.id)))
  await repo.saveInbox([...inbox.filter((item) => item.id !== id), record])
  invalidateFocusData()
  return true
}

/**
 * 会话开始前给习惯占一条待确认记录，完成时才置 success。
 *
 * 同时清掉 24 小时前仍未确认的记录：那是中途放弃的会话，
 * 留着会让「执行次数」和待确认判断都变脏。
 */
export async function beginHabitLog(habitId: string): Promise<string> {
  const now = Date.now()
  const logs = (await repo.loadHabitLogs()).filter(
    (log) => log.success || now - log.time < 24 * 60 * 60 * 1000,
  )
  const id = uid('log')
  const entry: HabitLog = { id, habit: habitId, time: now, success: false }
  await repo.saveHabitLogs([...logs, entry])
  invalidateFocusData()
  return id
}
