import { useEffect, useState } from 'react'
import { inTauri, isMaximized } from '@/ipc/bridge'

/**
 * 窗口最大化态：只在初始化和 resize 时查询。
 * 之前每 400ms 轮询一次宿主，空闲时也会持续唤醒 IPC。
 */
export function useMaximized(): boolean {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!inTauri()) return
    let alive = true
    let timer: number | undefined
    const read = () => {
      isMaximized()
        .then((v) => {
          if (alive) setMaximized(v)
        })
        .catch(() => {})
    }
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(read, 60)
    }
    read()
    window.addEventListener('resize', schedule)
    return () => {
      alive = false
      window.clearTimeout(timer)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return maximized
}
