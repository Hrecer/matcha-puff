import { useSyncExternalStore } from 'react'

/**
 * 「提前完成专注」的确认请求。
 *
 * 提前完成会把当前番茄按实际时长记作完成、并直接进入对应任务的休息，无法撤销，
 * 所以任何入口按它都要先过一道确认。挂件 / 托盘 / 工具子窗不在主窗口里，统一通过
 * `focus:quick_action` 的 `ask-early-done` 把请求递给主窗口弹窗。
 */
let asking = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function requestEarlyDoneConfirm(): void {
  if (asking) return
  asking = true
  emit()
}

export function closeEarlyDoneConfirm(): void {
  if (!asking) return
  asking = false
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function isAsking(): boolean {
  return asking
}

export function useEarlyDoneConfirmOpen(): boolean {
  return useSyncExternalStore(subscribe, isAsking, () => false)
}
