import { useSyncExternalStore } from 'react'
import { invoke, listen } from '@/ipc/bridge'

let visible = false
let started = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setVisible(next: boolean): void {
  if (visible === next) return
  visible = next
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function sync(): void {
  invoke<boolean>('focus_widget_visible')
    .then((value) => setVisible(Boolean(value)))
    .catch(() => {})
}

/**
 * 每个窗口初始化一次：先订阅后端广播，再对一次真实窗口。
 * 挂件可能在别的窗口或挂件自身被关闭，靠广播 + 焦点兜底保持同步。
 */
export function initWidgetVisibility(): void {
  if (started) return
  started = true
  listen<{ visible?: boolean }>('focus:widget', (payload) => {
    if (typeof payload?.visible === 'boolean') setVisible(payload.visible)
  })
  sync()
  window.addEventListener('focus', sync)
}

export function useWidgetVisible(): boolean {
  return useSyncExternalStore(subscribe, () => visible, () => false)
}

export async function showWidget(): Promise<boolean> {
  const next = Boolean(await invoke<boolean>('focus_widget_show'))
  setVisible(next)
  return next
}

export async function hideWidget(): Promise<boolean> {
  const next = Boolean(await invoke<boolean>('focus_widget_hide'))
  setVisible(next)
  return next
}

export async function toggleWidget(): Promise<boolean> {
  const next = Boolean(await invoke<boolean>('focus_widget_toggle'))
  setVisible(next)
  return next
}
