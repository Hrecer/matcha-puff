/** 专注能力的宿主接口：桌面端全部走 Rust，浏览器预览不可用。 */
import { inTauri, invoke, listen } from '@/ipc/bridge'
import type { FocusPolicy, FocusSnapshot, PendingFinish, TaskRef } from '@matcha-puff/pomodoro-core'

export interface StartFocusPayload {
  minutes: number
  task: TaskRef
  policy: FocusPolicy
}

export const focusSupported = (): boolean => inTauri()

export const getFocusState = () => invoke<FocusSnapshot | null>('focus_state')

export const startFocus = (payload: StartFocusPayload) =>
  invoke<FocusSnapshot>('focus_start', { ...payload })

export const pauseFocus = () => invoke<FocusSnapshot>('focus_pause')

export const resumeFocus = () => invoke<FocusSnapshot>('focus_resume')

export const stopFocus = () => invoke<FocusSnapshot>('focus_stop')

export const skipRest = () => invoke<FocusSnapshot>('focus_skip_rest')

/** 手动开始休息：时长与短/长种类由前端判定后交给宿主计时 */
export const startRest = (minutes: number, restKind: 'short' | 'long') =>
  invoke<FocusSnapshot>('focus_start_rest', { minutes, restKind })

export const ackPending = () => invoke<FocusSnapshot>('focus_ack')

/** 系统通知：Rust 侧用 tauri-plugin-notification 发，前端只给文案 */
export const notifyHost = (title: string, body: string) =>
  invoke('notify', { title, body })

export const onTick = (cb: (snapshot: FocusSnapshot) => void) =>
  listen<FocusSnapshot>('focus:tick', cb)

export const onPhase = (cb: (snapshot: FocusSnapshot) => void) =>
  listen<FocusSnapshot>('focus:phase', cb)

export const onFinished = (cb: (pending: PendingFinish) => void) =>
  listen<PendingFinish>('focus:finished', cb)
