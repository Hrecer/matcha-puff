import { describe, expect, it } from 'vitest'
import {
  ancestorIds,
  buildTaskTree,
  canMoveTask,
  collectCompletedRoots,
  descendantIds,
  findTask,
  flattenTaskTree,
  moveTask,
  nextOrder,
  removeTaskCascade,
  setTaskDone,
  type Task,
  type TaskNode,
} from './tasks'

const DAY = 24 * 60 * 60 * 1000

function task(id: string, parentId: string | null, patch: Partial<Task> = {}): Task {
  return {
    id,
    parentId,
    title: id,
    desc: '',
    order: 0,
    startDate: 0,
    endDate: 0,
    pomodoroTotal: 0,
    pomodoroCount: 0,
    createdAt: 0,
    ...patch,
  }
}

/** 只关心单个根节点的用例：显式收窄 noUncheckedIndexedAccess 后的索引访问 */
function onlyNode(tasks: Task[]): TaskNode {
  const [first] = buildTaskTree(tasks)
  if (!first) throw new Error('期望至少有一个节点')
  return first
}

describe('buildTaskTree', () => {
  it('叶子用自身值', () => {
    const node = onlyNode([
      task('a', null, { pomodoroTotal: 4, pomodoroCount: 2, startDate: 10 * DAY, endDate: 12 * DAY }),
    ])
    expect(node.isContainer).toBe(false)
    expect(node.plannedTotal).toBe(4)
    expect(node.doneCount).toBe(2)
    expect(node.startDate).toBe(10 * DAY)
    expect(node.endDate).toBe(12 * DAY)
    expect(node.percent).toBe(50)
    expect(node.complete).toBe(false)
  })

  it('容器把后代叶子汇总成番茄数与日期区间', () => {
    const root = onlyNode([
      task('root', null, { startDate: 1 * DAY, endDate: 2 * DAY, pomodoroTotal: 99 }),
      task('a', 'root', { order: 0, pomodoroTotal: 3, pomodoroCount: 3, startDate: 5 * DAY, endDate: 6 * DAY }),
      task('b', 'root', { order: 1, pomodoroTotal: 2, pomodoroCount: 1, startDate: 3 * DAY, endDate: 9 * DAY }),
    ])
    expect(root.isContainer).toBe(true)
    // 父自身填的 99 个番茄 / 自己的日期一律不参与
    expect(root.plannedTotal).toBe(5)
    expect(root.doneCount).toBe(4)
    // 已完成子任务 a 的日期不参与；区间取未完成的 b
    expect(root.startDate).toBe(3 * DAY)
    expect(root.endDate).toBe(9 * DAY)
    expect(root.complete).toBe(false)
  })

  it('容器时间只看未完成子任务：已完成日期不再撑出上级截止日', () => {
    const root = onlyNode([
      task('root', null),
      task('done', 'root', { order: 0, pomodoroTotal: 1, pomodoroCount: 1, startDate: 11 * DAY, endDate: 11 * DAY }),
      task('open', 'root', { order: 1, pomodoroTotal: 1 }),
    ])
    // 唯一有日期的是已完成子任务，未完成子任务没日期 → 上级时间不定
    expect(root.startDate).toBe(0)
    expect(root.endDate).toBe(0)
    // 番茄进度仍按全部子任务汇总（含已完成）
    expect(root.plannedTotal).toBe(2)
    expect(root.doneCount).toBe(1)
    expect(root.complete).toBe(false)
  })

  it('容器时间只看未完成子任务：已完成的日期不参与 min/max', () => {
    const root = onlyNode([
      task('root', null),
      task('done', 'root', { order: 0, pomodoroTotal: 1, pomodoroCount: 1, startDate: 1 * DAY, endDate: 2 * DAY }),
      task('open', 'root', { order: 1, pomodoroTotal: 1, startDate: 5 * DAY, endDate: 6 * DAY }),
    ])
    expect(root.startDate).toBe(5 * DAY)
    expect(root.endDate).toBe(6 * DAY)
  })

  it('整棵子树完成时保留全部叶子的历史区间', () => {
    const root = onlyNode([
      task('root', null),
      task('a', 'root', { order: 0, pomodoroTotal: 1, pomodoroCount: 1, startDate: 3 * DAY, endDate: 4 * DAY }),
      task('b', 'root', { order: 1, pomodoroTotal: 1, pomodoroCount: 1, startDate: 7 * DAY, endDate: 9 * DAY }),
    ])
    expect(root.complete).toBe(true)
    expect(root.startDate).toBe(3 * DAY)
    expect(root.endDate).toBe(9 * DAY)
  })

  it('嵌套容器：未完成分支没日期时，上级不会继承已完成分支的日期', () => {
    const root = onlyNode([
      task('root', null),
      task('doneBranch', 'root', { order: 0 }),
      task('doneLeaf', 'doneBranch', { pomodoroTotal: 1, pomodoroCount: 1, startDate: 1 * DAY, endDate: 2 * DAY }),
      task('openBranch', 'root', { order: 1 }),
      task('openLeaf', 'openBranch', { pomodoroTotal: 1 }),
    ])
    expect(root.complete).toBe(false)
    expect(root.startDate).toBe(0)
    expect(root.endDate).toBe(0)
  })

  it('多层：孙节点也汇总到根', () => {
    const root = onlyNode([
      task('root', null),
      task('mid', 'root'),
      task('leaf', 'mid', { pomodoroTotal: 2, pomodoroCount: 2, startDate: 7 * DAY, endDate: 8 * DAY }),
    ])
    expect(root.plannedTotal).toBe(2)
    expect(root.doneCount).toBe(2)
    expect(root.startDate).toBe(7 * DAY)
    expect(root.endDate).toBe(8 * DAY)
    expect(root.complete).toBe(true)
    expect(root.percent).toBe(100)
  })

  it('计划数为 0 时不判完成', () => {
    const node = onlyNode([task('a', null, { pomodoroCount: 5 })])
    expect(node.complete).toBe(false)
    expect(node.percent).toBe(0)
  })

  it('孤儿父节点被提升为顶层，不会丢任务', () => {
    const roots = buildTaskTree([task('a', 'missing')])
    expect(roots).toHaveLength(1)
    expect(roots[0]?.task.id).toBe('a')
  })

  it('互相引用成环时全部提升为顶层，不会丢任务', () => {
    const roots = buildTaskTree([task('a', 'b'), task('b', 'a')])
    const ids = roots.map((node) => node.task.id).sort()
    expect(ids).toEqual(['a', 'b'])
  })

  it('同级按 order 排序', () => {
    const roots = buildTaskTree([
      task('b', null, { order: 1 }),
      task('a', null, { order: 0 }),
    ])
    expect(roots.map((node) => node.task.id)).toEqual(['a', 'b'])
  })
})

describe('层级查询', () => {
  const tasks = [
    task('root', null),
    task('mid', 'root'),
    task('leaf', 'mid'),
    task('other', null),
  ]

  it('descendantIds 含自身与全部后代', () => {
    expect([...descendantIds(tasks, 'root')].sort()).toEqual(['leaf', 'mid', 'root'])
    expect([...descendantIds(tasks, 'leaf')]).toEqual(['leaf'])
  })

  it('ancestorIds 自顶向下', () => {
    expect(ancestorIds(tasks, 'leaf')).toEqual(['root', 'mid'])
    expect(ancestorIds(tasks, 'root')).toEqual([])
  })

  it('flattenTaskTree 带深度', () => {
    const flat = flattenTaskTree(buildTaskTree(tasks)).filter((item) => item.node.task.id !== 'other')
    expect(flat.map((item) => [item.node.task.id, item.depth])).toEqual([
      ['root', 0],
      ['mid', 1],
      ['leaf', 2],
    ])
  })

  it('nextOrder 取同级最大值 +1', () => {
    expect(nextOrder(tasks, 'root')).toBe(1)
    expect(nextOrder(tasks, null)).toBe(1)
  })
})

describe('挪动', () => {
  const tasks = [
    task('a', null, { order: 0 }),
    task('b', null, { order: 1 }),
    task('c', null, { order: 2 }),
  ]

  it('禁止挂到自身或自己的后代下', () => {
    expect(canMoveTask(tasks, 'a', 'a').ok).toBe(false)
    const nested = [task('root', null), task('mid', 'root'), task('leaf', 'mid')]
    expect(canMoveTask(nested, 'root', 'mid').ok).toBe(false)
    expect(canMoveTask(nested, 'mid', 'leaf').ok).toBe(false)
    expect(canMoveTask(nested, 'leaf', 'root').ok).toBe(true)
  })

  it('挪动只改 parentId/order，任务与计数不动', () => {
    const withCount = [
      task('root', null),
      task('a', 'root', { pomodoroTotal: 3, pomodoroCount: 2 }),
    ]
    const after = moveTask(withCount, 'a', null)
    const moved = findTask(after, 'a')!
    expect(moved.parentId).toBe(null)
    expect(moved.pomodoroTotal).toBe(3)
    expect(moved.pomodoroCount).toBe(2)
    // 原来的根节点仍在，计数由派生重算而不是被搬走
    expect(findTask(after, 'root')!.pomodoroCount).toBe(0)
  })

  it('插入到指定位置时重排同级 order', () => {
    const after = moveTask(tasks, 'c', null, 0)
    const orders = after
      .filter((item) => item.parentId === null)
      .sort((x, y) => x.order - y.order)
      .map((item) => item.id)
    expect(orders).toEqual(['c', 'a', 'b'])
  })

  it('非法挪动时原数组不变', () => {
    const after = moveTask(tasks, 'a', 'a')
    expect(after.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('删除与归档', () => {
  it('删除级联整棵子树', () => {
    const after = removeTaskCascade(
      [task('root', null), task('mid', 'root'), task('leaf', 'mid'), task('other', null)],
      'root',
    )
    expect(after.map((item) => item.id)).toEqual(['other'])
  })

  it('归档只取最上层完成节点，父完成后子不再单独归档', () => {
    const roots = buildTaskTree([
      task('root', null),
      task('a', 'root', { order: 0, pomodoroTotal: 2, pomodoroCount: 2 }),
      task('b', 'root', { order: 1, pomodoroTotal: 1, pomodoroCount: 1 }),
    ])
    const done = collectCompletedRoots(roots)
    expect(done.map((node) => node.task.id)).toEqual(['root'])
  })

  it('部分完成的子树不归档', () => {
    const roots = buildTaskTree([
      task('root', null),
      task('a', 'root', { order: 0, pomodoroTotal: 2, pomodoroCount: 2 }),
      task('b', 'root', { order: 1, pomodoroTotal: 1, pomodoroCount: 0 }),
    ])
    expect(collectCompletedRoots(roots)).toHaveLength(0)
  })
})

describe('手动完成标记（所有任务都能用）', () => {
  it('叶子没填计划：只有手动标记才算完成', () => {
    const open = onlyNode([task('a', null)])
    expect(open.complete).toBe(false)
    expect(open.percent).toBe(0)

    const closed = onlyNode([task('a', null, { done: true })])
    expect(closed.complete).toBe(true)
    expect(closed.percent).toBe(100)
  })

  it('容器要所有子节点完成才算完成，没计划时完成比例按子节点数算', () => {
    const half = buildTaskTree([
      task('root', null),
      task('a', 'root', { order: 0, done: true }),
      task('b', 'root', { order: 1 }),
    ])
    expect(half[0]?.complete).toBe(false)
    expect(half[0]?.percent).toBe(50)

    const all = buildTaskTree([
      task('root', null),
      task('a', 'root', { order: 0, done: true }),
      task('b', 'root', { order: 1, done: true }),
    ])
    expect(all[0]?.complete).toBe(true)
    expect(all[0]?.percent).toBe(100)
  })

  it('没干预过仍按番茄数自动判定', () => {
    const node = onlyNode([task('a', null, { pomodoroTotal: 3, pomodoroCount: 1 })])
    expect(node.complete).toBe(false)
    expect(node.percent).toBe(33)
  })

  it('手动标记完成优先于番茄数：没做满也能亲手收尾', () => {
    const node = onlyNode([task('a', null, { pomodoroTotal: 3, pomodoroCount: 1, done: true })])
    expect(node.complete).toBe(true)
  })

  it('手动撤销完成能压住已经做满的番茄数', () => {
    const node = onlyNode([task('a', null, { pomodoroTotal: 3, pomodoroCount: 3, done: false })])
    expect(node.complete).toBe(false)
  })

  it('勾完的「无计划」叶子会进归档候选', () => {
    expect(collectCompletedRoots(buildTaskTree([task('a', null, { done: true })])).map((n) => n.task.id)).toEqual(['a'])
  })
})

describe('setTaskDone 级联整棵子树', () => {
  const family = () => [
    task('root', null),
    task('a', 'root', { order: 0, pomodoroTotal: 3, pomodoroCount: 0 }),
    task('mid', 'root', { order: 1 }),
    task('leaf', 'mid', { pomodoroTotal: 2, pomodoroCount: 2 }),
    task('other', null, { order: 1 }),
  ]

  it('父任务标记完成：所有后代一起完成，兄弟分支不受影响', () => {
    const next = setTaskDone(family(), 'root', true)
    expect(next.filter((item) => item.done === true).map((item) => item.id)).toEqual([
      'root', 'a', 'mid', 'leaf',
    ])
    expect(next.find((item) => item.id === 'other')?.done).toBeUndefined()
    const roots = buildTaskTree(next)
    expect(roots.find((node) => node.task.id === 'root')?.complete).toBe(true)
    expect(roots.find((node) => node.task.id === 'other')?.complete).toBe(false)
  })

  it('再撤销完成：整棵回到未完成，包括原本番茄已做满的叶子', () => {
    const next = setTaskDone(setTaskDone(family(), 'root', true), 'root', false)
    const roots = buildTaskTree(next)
    const root = roots.find((node) => node.task.id === 'root')
    expect(root?.complete).toBe(false)
    expect(flattenTaskTree([root!]).every(({ node }) => !node.complete)).toBe(true)
  })

  it('叶子只改自己', () => {
    const next = setTaskDone(family(), 'a', true)
    expect(next.filter((item) => item.done === true).map((item) => item.id)).toEqual(['a'])
  })
})
