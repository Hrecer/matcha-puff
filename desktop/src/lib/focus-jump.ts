import { useSyncExternalStore } from 'react'

/**
 * 「跳转到某个任务 / 习惯」的请求信箱。
 *
 * 日视图里的任务、习惯都在另一个页签里，点一下要「切页签 + 定位到那一条」。
 * 这两件事分属不同的组件（FocusPage 管页签，TasksTab / HabitsTab 管列表），
 * 用一个模块级的信箱把请求递过去：
 *
 * 1. 日视图调 `jumpTo('task', id)` → 写进 pending 并通知订阅者；
 * 2. FocusPage 收到后切到对应页签；
 * 3. 列表页挂载后 `consumeJump(kind)` 取走请求，做展开 / 滚动 / 高亮，并把它清掉。
 *
 * 只存一条：后一次跳转会覆盖前一次。不进任何持久化，重启即消失。
 */
export type JumpKind = 'task' | 'habit'

export interface JumpRequest {
  kind: JumpKind
  id: string
  /** 发起时刻：同一个目标连续点两次也算新请求（靠它区分） */
  at: number
}

let pending: JumpRequest | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** 请求跳转：由日视图（或任何地方）调用 */
export function jumpTo(kind: JumpKind, id: string) {
  pending = { kind, id, at: Date.now() }
  emit()
}

/** 取走请求（同 kind 才取），取走后清空，避免重复定位 */
export function consumeJump(kind: JumpKind): JumpRequest | null {
  if (!pending || pending.kind !== kind) return null
  const request = pending
  pending = null
  emit()
  return request
}

/** 订阅当前请求；没有请求时为 null */
export function useJumpRequest(): JumpRequest | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => pending,
    () => null,
  )
}
