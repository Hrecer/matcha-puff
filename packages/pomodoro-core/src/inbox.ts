/**
 * 归档：把「整棵任务树都完成」的顶层任务搬进收件箱。
 *
 * 判定只认任务树的派生 complete：整棵都完成才归档，层级不封顶。
 */
import { buildTaskTree, collectCompletedRoots, flattenTaskTree, type Task } from './tasks'
import type { InboxRecord, InboxSubTask } from './types'

export interface ArchiveResult {
  tasks: Task[]
  inbox: InboxRecord[]
  archived: InboxRecord[]
}

export function archiveCompletedTasks(
  tasks: readonly Task[],
  inbox: readonly InboxRecord[],
  now = Date.now(),
  /** 这些 id 所在的那棵树一律不归档：例如正在计时的那颗番茄，归档走了就结算不到了 */
  excludeIds?: ReadonlySet<string>,
): ArchiveResult {
  const roots = collectCompletedRoots(buildTaskTree(tasks))
  if (roots.length === 0) return { tasks: [...tasks], inbox: [...inbox], archived: [] }

  const doomed = new Set<string>()
  let nextInbox = [...inbox]
  const archived: InboxRecord[] = []

  for (const root of roots) {
    const subtree = flattenTaskTree([root])
    // 子树里只要有一个被排除的 id（正在计时），整棵树这轮都不归档
    if (excludeIds && subtree.some(({ node }) => excludeIds.has(node.task.id))) continue
    // 根自身不进明细：它的标题/描述本身就是记录抬头。
    // 其余后代（含中间容器）都带 parentId，还原时可以原样接回树上。
    const detail: InboxSubTask[] = subtree.slice(1).map(({ node }) => ({
      id: node.task.id,
      parentId: node.task.parentId,
      title: node.task.title,
      desc: node.task.desc,
      count: node.plannedTotal,
      start: node.startDate,
      end: node.endDate,
    }))
    const record: InboxRecord = {
      id: root.task.id,
      title: root.task.title,
      desc: root.task.desc,
      start: root.startDate,
      end: root.endDate,
      count: root.plannedTotal,
      subtask: detail,
      time: now,
    }
    // 先移除同 id 的旧记录再插入：重复调用幂等。
    nextInbox = [...nextInbox.filter((item) => item.id !== record.id), record]
    archived.push(record)
    for (const { node } of subtree) doomed.add(node.task.id)
  }

  return {
    tasks: tasks.filter((task) => !doomed.has(task.id)),
    inbox: nextInbox,
    archived,
  }
}
