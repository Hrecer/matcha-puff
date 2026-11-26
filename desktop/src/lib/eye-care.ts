import { useSyncExternalStore } from 'react'
import { getEyeCare, setEyeCare, type EyeCareState } from '@/ipc/bridge'

/**
 * 护眼遮罩状态。
 *
 * 状态归后端持有（遮罩窗口由 Rust 侧渲染），这里是一份共享镜像：
 * 挂载时拉一次真实值；改动时先乐观更新让界面立刻响应，
 * 再以后端返回值为准 —— 写盘失败就退回真实值。
 *
 * 专注页的按钮和设置页的面板读同一份，两边永远一致。
 */
export const EYE_CARE_DEFAULT: EyeCareState = {
  enabled: false,
  strength: 2,
  mode: 'always',
  start_minute: 1080,
  end_minute: 360,
}

let state: EyeCareState = { ...EYE_CARE_DEFAULT }
let started = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function commit(next: EyeCareState): void {
  const same =
    state.enabled === next.enabled &&
    state.strength === next.strength &&
    state.mode === next.mode &&
    state.start_minute === next.start_minute &&
    state.end_minute === next.end_minute
  if (same) return
  state = next
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function initEyeCare(): void {
  if (started) return
  started = true
  getEyeCare()
    .then((value) => {
      if (value) commit({ ...EYE_CARE_DEFAULT, ...value })
    })
    .catch(() => {})
}

/** 订阅整份状态；传 selector 只取关心的字段，避免无关变更引起重渲染 */
export function useEyeCare<T>(selector: (value: EyeCareState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(EYE_CARE_DEFAULT),
  )
}

export function useEyeCareEnabled(): boolean {
  return useEyeCare((value) => value.enabled)
}

/** 改一项：乐观更新 → 落盘 → 用后端返回值校正 */
export async function patchEyeCare(patch: Partial<EyeCareState>): Promise<EyeCareState> {
  const previous = state
  commit({ ...state, ...patch })
  try {
    const value = await setEyeCare(patch)
    if (value) commit({ ...EYE_CARE_DEFAULT, ...value })
    return state
  } catch {
    commit(previous)
    return state
  }
}

export async function toggleEyeCare(): Promise<boolean> {
  const next = await patchEyeCare({ enabled: !state.enabled })
  return next.enabled
}
