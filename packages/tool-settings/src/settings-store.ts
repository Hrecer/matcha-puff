import { migrateSettings } from './migrations'
import { defaultToggle, emptySettings, type PluginToggle, type ToolSettings } from './settings-schema'

/**
 * 存储后端
 *
 * 桌面端注入 Tauri Store 实现，其他宿主可注入各自的实现。
 * write 必须保证原子性（写临时文件后替换，或由 Store 自行保证），避免掉电导致配置损坏。
 */
export interface SettingsBackend {
  read(): Promise<unknown>
  write(data: ToolSettings): Promise<void>
}

const MAX_RECENT_TOOLS = 12

export interface SettingsStore {
  
  get(): Promise<ToolSettings>
  update(mutator: (current: ToolSettings) => ToolSettings): Promise<ToolSettings>
  getPluginToggle(pluginId: string): Promise<PluginToggle>
  setPluginToggle(pluginId: string, patch: Partial<PluginToggle>): Promise<ToolSettings>
  toggleFavorite(pluginId: string): Promise<ToolSettings>
  togglePinned(pluginId: string): Promise<ToolSettings>
  pushRecent(pluginId: string): Promise<ToolSettings>
  /** 清理已不存在的插件配置 */
  prunePlugins(knownPluginIds: readonly string[]): Promise<ToolSettings>
}

export function createSettingsStore(backend: SettingsBackend): SettingsStore {
  let cache: ToolSettings | null = null
  let loading: Promise<ToolSettings> | null = null
  let writeChain: Promise<unknown> = Promise.resolve()

  async function load(): Promise<ToolSettings> {
    const raw = await backend.read().catch(() => undefined)
    const { settings, changed } = migrateSettings(raw)
    cache = settings
    if (changed) {
      await persist(settings)
    }
    return settings
  }

  async function ensure(): Promise<ToolSettings> {
    if (cache) return cache
    if (!loading) {
      loading = load().finally(() => {
        loading = null
      })
    }
    return loading
  }

  /** 串行化写入，避免并发 update 互相覆盖 */
  function persist(settings: ToolSettings): Promise<void> {
    const task = writeChain.then(() => backend.write(settings))
    writeChain = task.catch(() => undefined)
    return task
  }

  async function commit(next: ToolSettings): Promise<ToolSettings> {
    cache = next
    await persist(next)
    return next
  }

  function toggleIn(list: readonly string[], id: string): string[] {
    return list.includes(id) ? list.filter((item) => item !== id) : [id, ...list]
  }

  return {
    get: ensure,

    update: async (mutator) => {
      const current = await ensure()
      return commit(mutator(current))
    },

    getPluginToggle: async (pluginId) => {
      const current = await ensure()
      return current.plugins[pluginId] ?? defaultToggle()
    },

    setPluginToggle: async (pluginId, patch) => {
      const current = await ensure()
      const prev = current.plugins[pluginId] ?? defaultToggle()
      return commit({
        ...current,
        plugins: { ...current.plugins, [pluginId]: { ...prev, ...patch } },
      })
    },

    toggleFavorite: async (pluginId) => {
      const current = await ensure()
      return commit({ ...current, favorites: toggleIn(current.favorites, pluginId) })
    },

    togglePinned: async (pluginId) => {
      const current = await ensure()
      return commit({ ...current, pinnedTools: toggleIn(current.pinnedTools, pluginId) })
    },

    pushRecent: async (pluginId) => {
      const current = await ensure()
      const next = [pluginId, ...current.recentTools.filter((id) => id !== pluginId)].slice(0, MAX_RECENT_TOOLS)
      return commit({ ...current, recentTools: next })
    },

    prunePlugins: async (knownPluginIds) => {
      const current = await ensure()
      const known = new Set(knownPluginIds)
      const plugins: Record<string, PluginToggle> = {}
      let removed = false
      for (const [id, toggle] of Object.entries(current.plugins)) {
        if (known.has(id)) plugins[id] = toggle
        else removed = true
      }
      if (!removed) return current
      const keep = (list: readonly string[]) => list.filter((id) => known.has(id))
      return commit({
        ...current,
        plugins,
        favorites: keep(current.favorites),
        pinnedTools: keep(current.pinnedTools),
        recentTools: keep(current.recentTools),
      })
    },
  }
}

/** 内存后端：用于测试与「不持久化」的场景 */
export function createMemoryBackend(initial: unknown = emptySettings()): SettingsBackend {
  let value = initial
  return {
    read: async () => value,
    write: async (data) => {
      value = data
    },
  }
}
