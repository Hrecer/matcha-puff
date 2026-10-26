import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Search, Star, Timer } from 'lucide-react'
import type { CommandItem } from '@/ipc/bridge'
import { openExternal, searchCommandByCode } from '@/ipc/bridge'
import { Empty } from '@/components/ui/empty'
import { pluginIcon, openPluginTool } from '@/lib/plugin-tools'
import { toggleFavorite, useLibrary } from '@/lib/library'
import { initFocusSync, useFocusStore } from '@/lib/focus-store'
import { formatRemain } from '@matcha-puff/pomodoro-core'
import { useUiPlugins } from '@/lib/use-ui-plugins'
import { cn } from 'cn'

interface ToolItem {
  key: string
  name: string
  desc: string
  pluginId: string
  disabled: boolean
}









export function WorkbenchHome() {
  const { favorites } = useLibrary()
  const pluginTools = useUiPlugins()
  const [commands, setCommands] = useState<CommandItem[]>([])
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => dayjs())

  useEffect(() => {
    searchCommandByCode('')
      .then((list) => setCommands(Array.isArray(list) ? list : []))
      .catch(() => setCommands([]))
    const timer = window.setInterval(() => setNow(dayjs()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const q = query.trim().toLowerCase()

  const pluginHits = useMemo(
    () =>
      !q
        ? []
        : pluginTools.filter(
            ({ meta }) =>
              meta.name.toLowerCase().includes(q) ||
              meta.description.toLowerCase().includes(q) ||
              meta.keywords.some((keyword) => keyword.toLowerCase().includes(q)),
          ),
    [q, pluginTools],
  )

  /**
   * 空搜索的基础列表：全面列出已启用插件；
   * 目录数据为空时也能正常展示可用工具。
   */
  const pluginBase = useMemo(
    () => pluginTools.filter(({ enabled }) => enabled),
    [pluginTools],
  )

  const toolItems = useMemo<ToolItem[]>(() => {
    const plugins = q ? pluginHits : pluginBase
    return plugins.map(({ meta, enabled }) => ({
      key: `plugin:${meta.id}`,
      name: meta.name,
      desc: meta.description,
      pluginId: meta.id,
      disabled: !enabled,
    }))
  }, [q, pluginHits, pluginBase])

  /**
   * 中栏不参与筛选。
   *
   * 输入框里的字，在中栏是「要搜的内容」而不是「筛引擎的关键词」。用同一份输入去筛引擎，
   * 会出现「刚打完要搜的词，引擎全被筛没」——那样就永远搜不出去。所以引擎列表常驻，
   * 点哪条就用哪条搜当前输入；只有左栏的工具才按输入筛选。
   */
  const sources = commands
  /** 待搜索的内容（去首尾空白），用于行内提示与拼 URL */
  const keyword = query.trim()

  const activateTool = (item: ToolItem | undefined) => {
    if (!item) return
    // 打开前由 openPluginTool 统一复查启用状态；禁用时给明确反馈
    void openPluginTool(item.pluginId)
  }

  /** 中栏只承载搜索源：点哪条就用哪条搜当前输入，${query} 换成输入框里的内容 */
  const runCommand = (cmd: CommandItem | undefined) => {
    if (!cmd) return
    openExternal(cmd.command.replace('${query}', keyword)).catch(() => {})
  }


  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-7 py-6">
        {/* ── 搜索台 ───────────────────────────────────────────── */}
        <section className="glass rounded-panel p-3.5">
          <div className="flex h-12 items-center gap-3 px-1.5">
            <Search className="size-4.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              spellCheck={false}
              autoFocus
              placeholder="输入任意关键词"
              onChange={(e) => setQuery(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-medium text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </div>

          <div className="mt-2 border-t border-border/50 pt-3">
            <div className="grid gap-4 md:grid-cols-[1.15fr_1fr_1fr]">
              {}
              <div className="h-[360px] overflow-y-auto pr-1 scroll-thin">
                {toolItems.length === 0 ? (
                  <Empty size="sm" title="没有匹配的工具" description="换个关键词试试。" />
                ) : (
                  toolItems.map((item) => {
                    const fav = favorites.includes(item.key)
                    return (
                      <div
                        key={item.key}
                        onClick={() => activateTool(item)}
                        className="flex h-[50px] cursor-default items-center gap-2.5 rounded-md px-2.5 transition-colors hover:bg-foreground/8"
                      >
                        <ToolChip pluginId={item.pluginId} />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[14.5px] font-semibold',
                            item.disabled && 'text-muted-foreground',
                          )}
                        >
                          {item.name}
                        </span>
                        {item.disabled ? (
                          <span className="shrink-0 rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            已禁用
                          </span>
                        ) : null}
                        <button
                          type="button"
                          aria-label={fav ? '取消收藏' : '收藏'}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(item.key)
                          }}
                          className={cn(
                            'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40',
                            fav ? 'text-warning' : 'text-muted-foreground/50',
                          )}
                        >
                          <Star className={cn('size-5', fav && 'fill-warning')} />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>

              {/* 搜索源：固定不变，不筛不空；点哪条就用哪条搜输入框里的内容 */}
              <div className="h-[360px] overflow-y-auto pr-1 scroll-thin">
                {sources.map((cmd) => (
                  <div
                    key={cmd.id}
                    onClick={() => runCommand(cmd)}
                    className="flex h-[45px] cursor-default items-center gap-2.5 rounded-md px-2.5 transition-colors hover:bg-foreground/8"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <Search className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                      {cmd.name}
                    </span>
                  </div>
                ))}
              </div>

              <StatusPanel now={now} className="min-w-0" />
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}


const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 第三栏：实时时钟 + 专注概览，只读展示 */
function StatusPanel({ now, className }: { now: dayjs.Dayjs; className?: string }) {
  const { snapshot, ready, config } = useFocusStore()

  useEffect(() => {
    void initFocusSync()
  }, [])

  const phase = snapshot?.phase ?? 'idle'
  const paused = phase === 'paused'
  const pausedFrom = snapshot?.pausedFrom ?? null
  const resting = phase === 'rest' || (paused && pausedFrom === 'rest')
  const focusing = phase === 'focus' || (paused && pausedFrom === 'focus')
  const awaiting = phase === 'awaiting'
  const active = focusing || resting
  /** 时间到也要留在面板里：那一段还没被用户确认，不是「没有专注」 */
  const showing = active || awaiting

  const remain = formatRemain(snapshot?.remainMs ?? 0)
  const progress = Math.max(0, Math.min(100, snapshot?.progress ?? 0))
  const taskName = snapshot?.task?.name ?? ''
  const completed = snapshot?.cycleCompleted ?? 0
  /** 长休间隔：每完成这么多个番茄进一次长休息 */
  const longRestEvery = config.longRestInterval > 0 ? config.longRestInterval : 4

  return (
    <div className={cn('flex h-[360px] flex-col gap-3', className)}>
      {/* 时钟：内容居中，占位略小 */}
      <div className="flex min-h-0 flex-[0.85] flex-col items-center justify-center gap-4 rounded-lg bg-foreground/[0.035] px-4">
        <p className="font-mono text-[42px] font-medium leading-none tabular-nums text-foreground">
          {now.format('HH:mm:ss')}
        </p>
        <p className="text-[12.5px] text-muted-foreground">
          {now.format('YYYY年M月D日')} · 周{WEEKDAYS[now.day()]}
        </p>
      </div>

      {/* 专注：标题贴左上，中间区自适应撑满 */}
      <div className="flex min-h-0 flex-[1.15] flex-col rounded-lg bg-foreground/[0.035] px-4 py-4">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
          <Timer className="size-3.5" aria-hidden />
          专注
          {awaiting ? <span className="text-primary">· 时间到</span> : null}
        </span>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          {showing ? (
            <>
              <p className="font-mono text-[32px] font-medium leading-none tabular-nums text-foreground">
                {remain.minutes}:{remain.seconds}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
              {ready ? '当前没有进行中的专注' : '正在读取专注状态…'}
            </p>
          )}
        </div>

        {showing ? (
          <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
            <span className="min-w-0 truncate">{taskName || '未关联任务'}</span>
            <span className="shrink-0 tabular-nums">
              本轮 <span className="text-foreground">{completed}</span>/{longRestEvery}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ToolChip({ pluginId }: { pluginId: string }) {
  const Icon = pluginIcon(pluginId)
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
      <Icon className="size-3.5" />
    </span>
  )
}
