import { useCallback, useState } from 'react'

/**
 * 会话内记忆：切页（组件卸载再挂载）保持选择，重启应用（模块重新求值）回到默认。
 * 用于导航这类界面偏好；需要跨启动保留的内容仍走各自的持久化。
 */
const memory = new Map<string, unknown>()

export function readSessionState<T>(key: string, initial: T): T {
  const stored = memory.get(key)
  return stored === undefined ? initial : (stored as T)
}

export function writeSessionState<T>(key: string, value: T): void {
  memory.set(key, value)
}

export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readSessionState(key, initial))

  const set = useCallback(
    (next: T) => {
      writeSessionState(key, next)
      setValue(next)
    },
    [key],
  )

  return [value, set] as const
}
