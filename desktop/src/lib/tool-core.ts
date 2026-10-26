/**
 * 工具内核接入层（设计契约 §7）
 *
 * 桌面端 UI 使用内核的唯一入口：Registry + Runtime + Settings 在这里组装成单例。
 * UI 严禁绕过 runtime.execute 直接调插件 execute —— 那会跳过启用状态与权限检查。
 *
 * 设置后端：桌面端先落在 localStorage（键 matcha-puff/tool-settings），
 * 后续如需跨窗口/持久化升级，只替换这里的 Backend，调用方无感。
 */
import { createRegistry } from '@matcha-puff/tool-runtime'
import { createRuntime } from '@matcha-puff/tool-runtime'
import { browserImageService } from '@/lib/image-service'
import { browserStorageService } from '@/lib/storage-service'
import { inTauri, invoke } from '@/ipc/bridge'
import { toToolMetadata } from '@matcha-puff/tool-contracts'
import type { ToolCaller, ToolMetadata, ToolResult } from '@matcha-puff/tool-contracts'
import { createSettingsStore } from '@matcha-puff/tool-settings'
import type {
  PluginToggle,
  SettingsBackend,
  SettingsStore,
  ToolSettings,
} from '@matcha-puff/tool-settings'
import { builtinPlugins } from '@matcha-puff/tools'

const STORAGE_KEY = 'matcha-puff/tool-settings'

/** localStorage 后端：结构存 JSON，读写即序列化（后续换 Tauri Store 只改这里） */
function createLocalStorageBackend(): SettingsBackend {
  return {
    async read() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : undefined
      } catch {
        return undefined
      }
    },
    async write(data: ToolSettings) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    },
  }
}

/**
 * 桌面版后端：写 `~/.matcha-puff/settings.json`。
 *
 * 工具开关落盘后，重启应用读到的就是同一份设置。
 *
 * 首次运行会把旧版存在 localStorage 里的开关迁移过去，老用户的选择不会丢。
 */
function createDesktopBackend(): SettingsBackend {
  let migrated = false
  return {
    async read() {
      const raw = await invoke<string | null>('tool_settings_read').catch(() => null)
      if (raw) return JSON.parse(raw)
      if (!migrated) {
        migrated = true
        try {
          const legacy = localStorage.getItem(STORAGE_KEY)
          if (legacy) {
            await invoke('tool_settings_write', { data: legacy })
            localStorage.removeItem(STORAGE_KEY)
            return JSON.parse(legacy)
          }
        } catch {
          // 迁移失败就按全新配置处理，用户重新勾一遍即可
        }
      }
      return undefined
    },
    async write(data: ToolSettings) {
      await invoke('tool_settings_write', { data: JSON.stringify(data, null, 2) })
    },
  }
}

/** 桌面端走共用文件；浏览器预览没有 Rust 侧，继续用 localStorage */
function createBackend(): SettingsBackend {
  return inTauri() ? createDesktopBackend() : createLocalStorageBackend()
}

let runtimeInstance: ReturnType<typeof createRuntime> | null = null
let settingsInstance: SettingsStore | null = null

export function getToolSettings(): SettingsStore {
  if (!settingsInstance) {
    settingsInstance = createSettingsStore(createBackend())
  }
  return settingsInstance
}

export function getToolRuntime() {
  if (!runtimeInstance) {
    const registry = createRegistry()
    registry.registerAll(builtinPlugins)
    runtimeInstance = createRuntime({
      registry,
      settings: getToolSettings(),
      services: { image: browserImageService, storage: browserStorageService },
    })
  }
  return runtimeInstance
}

/** 界面可见的工具清单（uiEnabled=false 的不出现在导航与搜索里） */
export async function listVisibleTools(): Promise<ToolMetadata[]> {
  const entries = await listUiPlugins()
  return entries.filter((entry) => entry.enabled).map((entry) => entry.meta)
}

export interface UiPlugin {
  meta: ToolMetadata
  toggle: PluginToggle
  /** false = 总开关已关：入口保留并置灰，执行由 Runtime 拒绝 */
  enabled: boolean
}

/**
 * 界面用的插件清单：只按 uiEnabled 隐藏，总开关关闭的仍返回并标记 enabled=false。
 * 这样“禁用”在界面上是置灰 + 说明，而不是工具毫无解释地消失。
 */
export async function listUiPlugins(): Promise<UiPlugin[]> {
  const settings = getToolSettings()
  const entries: UiPlugin[] = []
  for (const plugin of allPlugins) {
    const toggle = await settings.getPluginToggle(plugin.id).catch(() => null)
    if (!toggle) continue
    if (!(plugin.defaultPolicy.uiEnabled && toggle.uiEnabled)) continue
    entries.push({
      meta: toToolMetadata(plugin),
      toggle,
      enabled: plugin.defaultPolicy.enabled && toggle.enabled,
    })
  }
  return entries
}

/** 设置被其他窗口改动后，让本窗口重新读取（单例缓存基于 localStorage） */
export function invalidateToolSettings(): void {
  settingsInstance = null
  runtimeInstance = null
}

/** UI 调用工具的固定入口 */
export function runTool<TOutput = unknown>(
  toolId: string,
  input: unknown,
): Promise<ToolResult<TOutput>> {
  const caller: ToolCaller = 'ui'
  return getToolRuntime().execute<TOutput>({ toolId, input, caller })
}

/** 拿原始插件（表单渲染需要 inputSchema 与 ui 元数据） */
export function getPlugin(toolId: string) {
  return builtinPlugins.find((p) => p.id === toolId)
}

/** 全部插件（含被隐藏的，设置页用） */
export const allPlugins = builtinPlugins
