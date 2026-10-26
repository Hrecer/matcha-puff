import { useEffect, useState, type ComponentType } from 'react'
import { Settings2 } from 'lucide-react'
import type { PluginToggle } from '@matcha-puff/tool-settings'
import { cn } from 'cn'
import { AmbientBackground } from '@/components/ui/ambient'
import { CaptionBar } from '@/components/ui/caption-bar'
import { Empty } from '@/components/ui/empty'
import { WindowResizeHandles } from '@/components/ui/window-resize-handles'
import { getPlugin, getToolSettings, invalidateToolSettings } from '@/lib/tool-core'
import { useMaximized } from '@/lib/use-maximized'
import { pluginIcon } from '@/lib/plugin-tools'

/**
 * 插件工具子窗口外壳
 *
 * 五段式：标题栏 → 说明 → 参数区 → 执行 → 结果。
 * 说明与参数区由各工具自己的视图提供（每个工具的形态不同）；
 * 外壳只负责窗口材质、标题栏、禁用/缺失状态与统一背景。
 */
type ViewModule = Record<string, unknown>

/**
 * 界面组件按导出名自动发现：manifest.desktop.view 指向哪个导出，
 * 就在这里取哪个组件。删插件时只需删掉组件本身，无需维护映射表。
 */
const VIEW_COMPONENTS: Record<string, ComponentType> = {}
for (const mod of Object.values(
  import.meta.glob<ViewModule>('/src/pages/tools/**/*.tsx', { eager: true }),
)) {
  for (const [name, value] of Object.entries(mod)) {
    if (name.endsWith('Tool') && (typeof value === 'function' || typeof value === 'object')) {
      VIEW_COMPONENTS[name] = value as ComponentType
    }
  }
}

function resolveToolId(): string {
  if (typeof window.__MATCHA_TOOL_ID__ === 'string' && window.__MATCHA_TOOL_ID__) {
    return window.__MATCHA_TOOL_ID__
  }
  return new URLSearchParams(window.location.search).get('tool') ?? ''
}

export function ToolWindow() {
  const toolId = resolveToolId()
  const plugin = getPlugin(toolId)
  const Icon = pluginIcon(toolId)
  const View = plugin?.desktop?.view ? VIEW_COMPONENTS[plugin.desktop.view] : undefined
  const [toggle, setToggle] = useState<PluginToggle | null>(null)
  const maximized = useMaximized()

  useEffect(() => {
    document.title = plugin?.name ?? '工具'
  }, [plugin])

  useEffect(() => {
    if (!plugin) return
    let alive = true
    const load = () => {
      invalidateToolSettings()
      getToolSettings()
        .getPluginToggle(plugin.id)
        .then((next) => {
          if (alive) setToggle(next)
        })
        .catch(() => {})
    }
    load()
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'matcha-puff/tool-settings') load()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      alive = false
      window.removeEventListener('storage', onStorage)
    }
  }, [plugin])

  const disabled = !!plugin && !!toggle && !(plugin.defaultPolicy.enabled && toggle.enabled)
  const hidden = !!plugin && !!toggle && !(plugin.defaultPolicy.uiEnabled && toggle.uiEnabled)

  return (
    <div className={cn('window-stage relative', maximized && 'is-maximized')}>
      <div className={cn('window-shell flex h-full flex-col', maximized && 'is-maximized')}>
        <AmbientBackground />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <CaptionBar brand={plugin?.name ?? '工具'} icon={plugin ? Icon : undefined} maximized={maximized} />

          {!plugin ? (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <Empty
                icon={Settings2}
                title="没有找到这个工具"
                description="它可能已被移除，或窗口参数已失效。"
              />
            </div>
          ) : !toggle ? (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <p className="text-xs text-muted-foreground">正在读取工具设置…</p>
            </div>
          ) : disabled || hidden ? (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <div className="glass w-full max-w-md rounded-panel">
                <Empty
                  icon={Settings2}
                  title={disabled ? '该工具已在设置中禁用' : '该工具已从界面入口隐藏'}
                  description={
                    disabled
                      ? '打开主窗口的「插件中心」，重新打开总开关后即可使用。'
                      : '打开主窗口的「插件中心」，重新打开「界面」开关后即可使用。'
                  }
                />
              </div>
            </div>
          ) : View ? (
            <View />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <Empty
                icon={Settings2}
                title="界面正在接入"
                description="这个工具的专属界面还在制作中，功能仍可正常使用。"
              />
            </div>
          )}
        </div>
      </div>
      <WindowResizeHandles maximized={maximized} />
    </div>
  )
}
