import { useEffect, useState } from 'react'
import { listUiPlugins, type UiPlugin } from '@/lib/tool-core'

/**
 * 插件清单是异步读的：缓存上一次结果，页面重挂时先同步渲染，
 * 避免工具页首帧先闪一下空态再长出内容。
 */
let cachedPlugins: UiPlugin[] = []
let loadedOnce = false
let loading: Promise<UiPlugin[]> | null = null

async function fetchPlugins(): Promise<UiPlugin[]> {
  try {
    const next = await listUiPlugins()
    cachedPlugins = next
    return next
  } catch {
    return cachedPlugins
  } finally {
    loadedOnce = true
  }
}

/** 启动预热：用户切到工具页前把清单准备好；并发调用共用同一次加载 */
export function preloadUiPlugins(force = false): Promise<UiPlugin[]> {
  if (force || !loading) {
    loading = fetchPlugins().finally(() => {
      loading = null
    })
  }
  return loading
}

/** 目录首帧是否还欠着数据（渲染期只读） */
export function uiPluginsLoaded(): boolean {
  return loadedOnce
}

/**
 * 界面插件清单：设置页改动（同窗事件 / 跨窗 storage）后自动刷新。
 * 工作台与工具页共用同一份口径，避免两处列表不同步。
 */
export function useUiPlugins(): UiPlugin[] {
  const [plugins, setPlugins] = useState<UiPlugin[]>(cachedPlugins)

  useEffect(() => {
    let alive = true
    const reload = (force = false) => {
      preloadUiPlugins(force)
        .then((next) => {
          if (alive) setPlugins(next)
        })
        .catch(() => {
          if (alive) setPlugins([])
        })
    }
    reload()
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'matcha-puff/tool-settings') reload(true)
    }
    const onChanged = () => reload(true)
    window.addEventListener('matcha:tool-settings-changed', onChanged)
    window.addEventListener('storage', onStorage)
    return () => {
      alive = false
      window.removeEventListener('matcha:tool-settings-changed', onChanged)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return plugins
}
