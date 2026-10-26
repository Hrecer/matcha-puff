import type { Summary, TaskRef } from './types'

/**
 * 专注秒数入账：todayTime / allPomodoroTime / 任务明细。
 * 按秒累加，批量结算，减少落盘次数。
 */
export function applyFocusSeconds(
  summary: Summary,
  task: TaskRef,
  seconds: number,
  now = Date.now(),
): Summary {
  const delta = Math.max(0, Math.floor(seconds))
  if (delta === 0) return summary

  const tasks = summary.todayTasks || []
  const index = tasks.findIndex((item) => item.id === task.id)
  const todayTasks =
    index >= 0
      ? tasks.map((item, i) => (i === index ? { ...item, value: item.value + delta } : item))
      : [...tasks, { id: task.id, name: task.name, value: delta }]

  return {
    ...summary,
    todayTime: (summary.todayTime || 0) + delta,
    allPomodoroTime: (summary.allPomodoroTime || 0) + delta,
    todayTasks,
    update: now,
  }
}

/** 一个番茄完成：计数 +1（时长已经由 applyFocusSeconds 记过） */
export function countCompletedPomodoro(summary: Summary): Summary {
  return {
    ...summary,
    allPomodoroCount: (summary.allPomodoroCount || 0) + 1,
    todayPomodoro: (summary.todayPomodoro || 0) + 1,
  }
}

/**
 * 会话结束时的完整入账：先记秒数，再记番茄数。
 * 用于「应用关闭期间到点、下次启动补结算」的场景。
 */
export function recordFinishedSession(
  summary: Summary,
  task: TaskRef,
  seconds: number,
  now = Date.now(),
): Summary {
  return countCompletedPomodoro(applyFocusSeconds(summary, task, seconds, now))
}
