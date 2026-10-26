import type { TaskQuadrant } from './types'

/**
 * 任务树：一份 `tasks` 文档承载任意深度的层级。
 *
 * 与产品决策一致的约定：
 * - **层级就是类型**：只有任务这一种身份，深度 0 只是顶层。
 * - **有子节点 = 容器**：不可直接计时；番茄数与日期区间全部由后代叶子汇总。
 * - **无子节点 = 叶子**：普通任务，可计时，自身的 startDate/endDate/pomodoroTotal 才有意义。
 * - **汇总值不落库**：一律实时算，父子不可能不同步。
 * - **计时与统计只挂在叶子 id 上**：挪动节点只影响祖先的派生值，历史统计一个字不变。
 */

export interface Task {
  id: string
  /** null = 顶层 */
  parentId: string | null
  title: string
  desc: string
  /** 同级排序，越小越靠前 */
  order: number
  /** 计划区间（毫秒）：仅叶子有意义 */
  startDate: number
  endDate: number
  /** 目标番茄数：仅叶子有意义；0 = 不设计划 */
  pomodoroTotal: number
  /** 已完成番茄数（叶子，由计时入账累加） */
  pomodoroCount: number
  /** 四象限；只有叶子使用，未指定按 Q2 展示 */
  quadrant?: TaskQuadrant
  /** 顶层任务的手动颜色；只有 parentId === null 时有效 */
  color?: string
  /**
   * 手动完成标记：只对「没有番茄计划」的叶子有意义 —— 没数字可依据时，
   * 由用户自己在树上勾完成，而不是永远判不出完成。
   */
  done?: boolean
  createdAt: number
}

/** 建树后的节点：task + 子节点 + 全部派生值 */
export interface TaskNode {
  task: Task
  children: TaskNode[]
  /** 后代叶子（自身无子时就是自己） */
  leaves: Task[]
  /** 派生：计划番茄总数 = Σ 叶子 pomodoroTotal */
  plannedTotal: number
  /** 派生：已完成番茄数 = Σ 叶子 pomodoroCount */
  doneCount: number
  /** 派生：区间起点 = min(叶子 startDate)，全为空则 0 */
  startDate: number
  /** 派生：区间终点 = max(叶子 endDate)，全为空则 0 */
  endDate: number
  /** 有子即容器，不可直接计时 */
  isContainer: boolean
  /** 计划数为 0 时不判完成 */
  complete: boolean
  percent: number
}

const byOrder = (a: Task, b: Task): number =>
  a.order - b.order || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1)

/**
 * 建树并自底向上汇总。
 *
 * 防御两种情况：父 id 指向不存在的节点（孤儿）与互相引用的环 ——
 * 两者都会让节点从树里消失，这里统一把它们提升为顶层，保证「不会丢任务」。
 */
export function buildTaskTree(tasks: readonly Task[]): TaskNode[] {
  const map = new Map<string, TaskNode>()
  for (const task of tasks) {
    map.set(task.id, {
      task,
      children: [],
      leaves: [],
      plannedTotal: 0,
      doneCount: 0,
      startDate: 0,
      endDate: 0,
      isContainer: false,
      complete: false,
      percent: 0,
    })
  }

  const roots: TaskNode[] = []
  for (const task of tasks) {
    const node = map.get(task.id)!
    const parent = task.parentId ? map.get(task.parentId) : undefined
    if (!parent || parent === node) {
      roots.push(node)
    } else {
      parent.children.push(node)
    }
  }

  // 环防御：从顶层 DFS，走不到的节点陷在环里，摘出来提升为顶层
  const seen = new Set<string>()
  const walk = (node: TaskNode): void => {
    if (seen.has(node.task.id)) return
    seen.add(node.task.id)
    for (const child of node.children) walk(child)
  }
  for (const root of roots) walk(root)
  for (const task of tasks) {
    if (seen.has(task.id)) continue
    const node = map.get(task.id)!
    if (task.parentId) {
      const parent = map.get(task.parentId)
      if (parent) parent.children = parent.children.filter((child) => child.task.id !== task.id)
    }
    roots.push(node)
  }

  const aggregate = (node: TaskNode): void => {
    for (const child of node.children) aggregate(child)
    node.children.sort((a, b) => byOrder(a.task, b.task))

    if (node.children.length === 0) {
      node.isContainer = false
      node.leaves = [node.task]
      node.plannedTotal = Math.max(0, node.task.pomodoroTotal || 0)
      node.doneCount = Math.max(0, node.task.pomodoroCount || 0)
      node.startDate = node.task.startDate || 0
      node.endDate = node.task.endDate || 0
      // 有计划按番茄数判定；没计划就看手动完成标记
      node.complete =
        node.plannedTotal > 0 ? node.doneCount >= node.plannedTotal : Boolean(node.task.done)
    } else {
      node.isContainer = true
      node.leaves = node.children.flatMap((child) => child.leaves)
      node.plannedTotal = node.children.reduce((sum, child) => sum + child.plannedTotal, 0)
      node.doneCount = node.children.reduce((sum, child) => sum + child.doneCount, 0)
      const starts = node.children.map((child) => child.startDate).filter((value) => value > 0)
      const ends = node.children.map((child) => child.endDate).filter((value) => value > 0)
      node.startDate = starts.length > 0 ? Math.min(...starts) : 0
      node.endDate = ends.length > 0 ? Math.max(...ends) : 0
      // 容器：后代全部完成才算完成
      node.complete = node.children.every((child) => child.complete)
    }

    node.percent =
      node.plannedTotal > 0
        ? Math.min(100, Math.round((node.doneCount / node.plannedTotal) * 100))
        : node.children.length > 0
          ? Math.round(
              (node.children.filter((child) => child.complete).length / node.children.length) * 100,
            )
          : node.complete
            ? 100
            : 0
  }

  roots.sort((a, b) => byOrder(a.task, b.task))
  for (const root of roots) aggregate(root)
  return roots
}

export function findTask(tasks: readonly Task[], id: string): Task | undefined {
  return tasks.find((task) => task.id === id)
}

/** 自身 + 所有后代 id（对环安全） */
export function descendantIds(tasks: readonly Task[], id: string): Set<string> {
  const childrenOf = new Map<string | null, Task[]>()
  for (const task of tasks) {
    const list = childrenOf.get(task.parentId) ?? []
    list.push(task)
    childrenOf.set(task.parentId, list)
  }
  const out = new Set<string>()
  const stack = [id]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (out.has(current)) continue
    out.add(current)
    for (const child of childrenOf.get(current) ?? []) stack.push(child.id)
  }
  return out
}

/** ancestors: 自顶向下到 node 的父链（不含自身） */
export function ancestorIds(tasks: readonly Task[], id: string): string[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const chain: string[] = []
  const guard = new Set<string>()
  let cursor = byId.get(id)?.parentId ?? null
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor)
    chain.unshift(cursor)
    cursor = byId.get(cursor)?.parentId ?? null
  }
  return chain
}

export interface MoveCheck {
  ok: boolean
  reason?: string
}

/** 挪动前的合法性检查：不能挂到自己或自己的后代下（否则成环） */
export function canMoveTask(
  tasks: readonly Task[],
  nodeId: string,
  nextParentId: string | null,
): MoveCheck {
  if (nextParentId === nodeId) return { ok: false, reason: '不能把任务挂到它自己下面' }
  if (nextParentId && descendantIds(tasks, nodeId).has(nextParentId)) {
    return { ok: false, reason: '不能把任务挂到它自己的子任务下面' }
  }
  return { ok: true }
}

/** 同级下一个 order 值 */
export function nextOrder(tasks: readonly Task[], parentId: string | null): number {
  const siblings = tasks.filter((task) => task.parentId === parentId)
  return siblings.reduce((max, task) => Math.max(max, task.order + 1), 0)
}

/**
 * 挪动任务：改 parentId 并重排新旧两组同级顺序。
 * 返回新的数组（不改原数组），统计与历史记录都不受影响。
 */
export function moveTask(
  tasks: readonly Task[],
  nodeId: string,
  nextParentId: string | null,
  index?: number,
): Task[] {
  const node = findTask(tasks, nodeId)
  if (!node) return [...tasks]
  if (!canMoveTask(tasks, nodeId, nextParentId).ok) return [...tasks]

  const oldParentId = node.parentId
  const next = tasks.map((task) => ({ ...task }))
  const target = next.find((task) => task.id === nodeId)!
  target.parentId = nextParentId
  // 颜色只属于顶层任务：挪到任何父级下面即作废
  if (nextParentId !== null) target.color = undefined

  const resequence = (parentId: string | null) => {
    const siblings = next
      .filter((task) => task.parentId === parentId)
      .sort((a, b) => byOrder(a, b))
    siblings.forEach((task, i) => {
      task.order = i
    })
  }
  resequence(oldParentId)

  if (index !== undefined && index >= 0) {
    const siblings = next
      .filter((task) => task.parentId === nextParentId && task.id !== nodeId)
      .sort((a, b) => byOrder(a, b))
    const at = Math.min(index, siblings.length)
    siblings.splice(at, 0, target)
    siblings.forEach((task, i) => {
      task.order = i
    })
  } else {
    resequence(nextParentId)
  }
  return next
}

/** 删除节点及其整棵子树 */
export function removeTaskCascade(tasks: readonly Task[], id: string): Task[] {
  const doomed = descendantIds(tasks, id)
  return tasks.filter((task) => !doomed.has(task.id))
}

/** 手动完成标记（只用于没有番茄计划的叶子） */
export function setTaskDone(tasks: readonly Task[], id: string, done: boolean): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, done } : task))
}

/** 按层级展开，供树视图渲染（深度从 0 起） */
export function flattenTaskTree(nodes: readonly TaskNode[]): { node: TaskNode; depth: number }[] {
  const out: { node: TaskNode; depth: number }[] = []
  const walk = (node: TaskNode, depth: number) => {
    out.push({ node, depth })
    for (const child of node.children) walk(child, depth + 1)
  }
  for (const node of nodes) walk(node, 0)
  return out
}

/**
 * 归档候选：只取「整棵顶层树都完成」的节点。
 *
 * 整棵完成才归档，不会让「父还在、某个子任务却莫名其妙消失」；
 * 未整体完成的子树保持 100% 挂在树上，进度一目了然。
 */
export function collectCompletedRoots(nodes: readonly TaskNode[]): TaskNode[] {
  return nodes.filter((node) => node.complete)
}
