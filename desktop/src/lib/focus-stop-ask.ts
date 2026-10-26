import { useSyncExternalStore } from 'react'

/**
 * 「停止专注 / 休息」的确认请求。
 *
 * 停止是不可逆的（专注已走的时间会入账、这一段不再算完成），所以任何入口按下
 * 停止都要先过一道确认。挂件 / 托盘不在同一个窗口里，它们通过
 * `focus:quick_action` 的 `ask-stop` 把请求递给主窗口，由这里统一开关弹窗。
 */
let asking = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function requestStopConfirm(): void {
  if (asking) return
  asking = true
  emit()
}

export function closeStopConfirm(): void {
  if (!asking) return
  asking = false
  emit()
}

export function subscribeStopConfirm(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function isStopAsking(): boolean {
  return asking
}

export function useStopConfirmOpen(): boolean {
  return useSyncExternalStore(subscribeStopConfirm, isStopAsking, () => false)
}
