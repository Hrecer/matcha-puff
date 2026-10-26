import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  ChevronDown,
  Eye,
  ListChecks,
  Plug,
  Power,
  Search,
  type LucideIcon,
} from 'lucide-react'
import type { PluginToggle } from '@matcha-puff/tool-settings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/search-input'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { categoryIcon } from '@/data/icon-map'
import { allCategories } from '@/data/registry'
import { allPlugins, getToolSettings, invalidateToolSettings } from '@/lib/tool-core'
import { pluginPrimaryCategoryId } from '@/lib/plugin-category'
import { openPluginTool, pluginIcon } from '@/lib/plugin-tools'
import { cn } from 'cn'

type Plugin = (typeof allPlugins)[number]
type ToggleKey = keyof PluginToggle
type CategoryId = 'webmaster' | 'reporter' | 'coding' | 'design' | 'life'
type CategoryFilter = 'all' | CategoryId
type StatusFilter = 'all' | 'enabled' | 'disabled' | 'ui-hidden'

interface CategoryDef {
  id: CategoryId
  topId: number
  label: string
  icon: LucideIcon
}

interface PluginRow {
  plugin: Plugin
  toggle: PluginToggle
}

const TOP_ID_BY_CODE = new Map(
  allCategories.filter((category) => !category.parent_id).map((category) => [category.code, category.id]),
)
const topIdFor = (code: CategoryId) => TOP_ID_BY_CODE.get(code) ?? 0

const CATEGORIES: CategoryDef[] = (
  [
    { id: 'webmaster', label: '系统运维' },
    { id: 'reporter', label: '编辑工具' },
    { id: 'coding', label: '编程工具' },
    { id: 'design', label: '设计工具' },
    { id: 'life', label: '生活常用' },
  ] as const
).map((item) => {
  const topId = topIdFor(item.id)
  return { ...item, topId, icon: categoryIcon(topId) }
})

const CATEGORY_LABEL = new Map(CATEGORIES.map((category) => [category.id, category.label]))
const SUB_NAME_BY_ID = new Map(allCategories.map((category) => [category.id, category.name]))
const COLLATOR = new Intl.Collator('zh-Hans-CN')

const PLUGIN_SUBCATEGORY = new Map<string, number | undefined>(
  allPlugins.map((plugin) => [plugin.id, pluginPrimaryCategoryId(plugin)]),
)

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: '全部状态' },
  { id: 'enabled', label: '已启用' },
  { id: 'disabled', label: '已关闭' },
  { id: 'ui-hidden', label: '界面隐藏' },
]

const STATUS_SHORT: Record<StatusFilter, string> = {
  all: '全部',
  enabled: '启用',
  disabled: '关闭',
  'ui-hidden': '隐藏',
}

const TOGGLE_FIELDS: {
  key: ToggleKey
  label: string
  help: string
  icon: ComponentType<{ className?: string }>
}[] = [
  { key: 'enabled', label: '总开关', help: '关闭后界面与应用内 AI 全部不可执行', icon: Power },
  { key: 'uiEnabled', label: '界面', help: '出现在工作台、工具页与收藏', icon: Eye },
]

const categoryLabel = (id: string) => CATEGORY_LABEL.get(id as CategoryId) ?? id

function effective(row: PluginRow, key: ToggleKey): boolean {
  return row.plugin.defaultPolicy[key] && row.toggle[key]
}

/**
 * 插件中心：把插件权限从设置页拆出来，独立搜索、筛选、批量管理与打开界面。
 */
export function PluginCenter() {
  const [rows, setRows] = useState<PluginRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [subcategory, setSubcategory] = useState<number | 'all'>('all')
  const [expandedCategory, setExpandedCategory] = useState<CategoryFilter | null>(null)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const load = useCallback(() => {
    // 每次进入都重读，避免沿用别的窗口留下的设置单例缓存
    invalidateToolSettings()
    const settings = getToolSettings()
    Promise.all(
      allPlugins.map(async (plugin) => ({
        plugin,
        toggle: await settings.getPluginToggle(plugin.id),
      })),
    )
      .then((next) => {
        setRows(next)
      })
      .catch(() => {
        setRows([])
        toast('读取插件设置失败', 'error')
      })
  }, [])

  useEffect(() => {
    load()
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'matcha-puff/tool-settings') load()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [load])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const plugin of allPlugins) {
      counts.set(plugin.category, (counts.get(plugin.category) ?? 0) + 1)
    }
    return counts
  }, [])

  const subcategoryCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const subId of PLUGIN_SUBCATEGORY.values()) {
      if (subId !== undefined) counts.set(subId, (counts.get(subId) ?? 0) + 1)
    }
    return counts
  }, [])

  const searchedRows = useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    return rows.filter(({ plugin }) => {
      if (!q) return true
      const subId = PLUGIN_SUBCATEGORY.get(plugin.id)
      const subName = subId !== undefined ? (SUB_NAME_BY_ID.get(subId) ?? '') : ''
      return [plugin.name, plugin.description, plugin.id, categoryLabel(plugin.category), subName].some(
        (text) => text.toLowerCase().includes(q),
      )
    })
  }, [rows, query])

  const categoryRows = useMemo(
    () => searchedRows.filter(({ plugin }) => category === 'all' || plugin.category === category),
    [searchedRows, category],
  )

  const scopedRows = useMemo(
    () =>
      subcategory === 'all'
        ? categoryRows
        : categoryRows.filter(({ plugin }) => PLUGIN_SUBCATEGORY.get(plugin.id) === subcategory),
    [categoryRows, subcategory],
  )

  const statusCounts = useMemo(
    () => ({
      all: scopedRows.length,
      enabled: scopedRows.filter((row) => effective(row, 'enabled')).length,
      disabled: scopedRows.filter((row) => !effective(row, 'enabled')).length,
      'ui-hidden': scopedRows.filter((row) => !effective(row, 'uiEnabled')).length,
    }),
    [scopedRows],
  )

  const filteredRows = useMemo(
    () =>
      scopedRows
        .filter((row) => {
          if (status === 'enabled') return effective(row, 'enabled')
          if (status === 'disabled') return !effective(row, 'enabled')
          if (status === 'ui-hidden') return !effective(row, 'uiEnabled')
          return true
        })
        .sort((a, b) => COLLATOR.compare(a.plugin.name, b.plugin.name)),
    [scopedRows, status],
  )

  const groups = useMemo(() => {
    if (category !== 'all') {
      const def = CATEGORIES.find((item) => item.id === category)
      if (!def) return []
      const subName = subcategory !== 'all' ? SUB_NAME_BY_ID.get(subcategory) : undefined
      return [{ ...def, label: subName ? `${def.label} / ${subName}` : def.label, rows: filteredRows }]
    }
    return CATEGORIES.map((def) => ({
      ...def,
      rows: filteredRows.filter(({ plugin }) => plugin.category === def.id),
    })).filter((group) => group.rows.length > 0)
  }, [category, filteredRows])

  useEffect(() => {
    const firstVisible = groups[0]?.rows[0]?.plugin.id ?? null
    setSelectedId((current) =>
      filteredRows.some((row) => row.plugin.id === current) ? current : firstVisible,
    )
  }, [filteredRows, groups])

  const selected =
    filteredRows.find((row) => row.plugin.id === selectedId) ?? filteredRows[0] ?? null
  const selectableRows = filteredRows.filter((row) => row.plugin.defaultPolicy.enabled)
  const enabledSelectable = selectableRows.filter((row) => effective(row, 'enabled'))
  const allSelected =
    selectableRows.length > 0 && enabledSelectable.length === selectableRows.length
  const someSelected = enabledSelectable.length > 0 && !allSelected
  const selectAllState = allSelected ? true : someSelected ? 'indeterminate' : false

  const patchToggle = (pluginId: string, key: ToggleKey, checked: boolean) => {
    const current = rows?.find((row) => row.plugin.id === pluginId)?.toggle
    if (!current) return
    const nextToggle = { ...current, [key]: checked }
    setRows((currentRows) =>
      currentRows?.map((row) =>
        row.plugin.id === pluginId ? { ...row, toggle: nextToggle } : row,
      ) ?? currentRows,
    )
    getToolSettings()
      .setPluginToggle(pluginId, { [key]: checked })
      .then(() => {
        window.dispatchEvent(new CustomEvent('matcha:tool-settings-changed'))
      })
      .catch(() => {
        setRows((currentRows) =>
          currentRows?.map((row) =>
            row.plugin.id === pluginId ? { ...row, toggle: current } : row,
          ) ?? currentRows,
        )
        toast('保存插件设置失败', 'error')
      })
  }

  const setEnabledMany = async (targets: PluginRow[], enable: boolean, notify = false) => {
    const unique = [...new Map(targets.map((row) => [row.plugin.id, row])).values()]
    if (unique.length === 0) return
    const targetIds = new Set(unique.map((row) => row.plugin.id))
    const toggles = new Map(unique.map((row) => [row.plugin.id, row.toggle]))
    setRows((currentRows) =>
      currentRows?.map((row) =>
        targetIds.has(row.plugin.id)
          ? { ...row, toggle: { ...row.toggle, enabled: enable } }
          : row,
      ) ?? currentRows,
    )
    try {
      await getToolSettings().update((current) => {
        const plugins = { ...current.plugins }
        for (const pluginId of targetIds) {
          const previous = plugins[pluginId] ?? toggles.get(pluginId)
          if (previous) plugins[pluginId] = { ...previous, enabled: enable }
        }
        return { ...current, plugins }
      })
      window.dispatchEvent(new CustomEvent('matcha:tool-settings-changed'))
      if (notify) toast(`${enable ? '已开启' : '已关闭'} ${targetIds.size} 个插件的总开关`)
    } catch {
      toast('批量保存失败', 'error')
      load()
    }
  }

  const selectAllCategory = () => {
    setCategory('all')
    setSubcategory('all')
  }

  const selectCategory = (id: CategoryId) => {
    setCategory(id)
    setSubcategory('all')
  }

  const toggleExpandedCategory = (id: CategoryId) => {
    setExpandedCategory((current) => (current === id ? null : id))
  }

  const selectSubcategory = (topId: number, subId: number) => {
    const parent = CATEGORIES.find((item) => item.topId === topId)
    if (!parent) return
    setCategory(parent.id)
    setSubcategory(subId)
    setStatus('all')
  }

  const selectRow = (row: PluginRow) => {
    setSelectedId(row.plugin.id)
    // 窄窗口没有右侧详情栏，点行直接弹出详情
    if (!window.matchMedia('(min-width: 1100px)').matches) setDetailOpen(true)
  }

  return (
    <div className="flex h-full flex-col gap-5 px-7 py-6">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold tracking-tight text-foreground">插件中心</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            共 {allPlugins.length} 个插件 · 当前显示 {filteredRows.length} 个
          </p>
        </div>
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="搜索名称、描述、ID 或分类…"
          className="w-[340px] max-w-full"
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)] gap-3 min-[1100px]:grid-cols-[180px_minmax(0,1fr)_320px]">
        <aside className="glass flex min-h-0 flex-col overflow-hidden rounded-panel">
          <div className="shrink-0 border-b border-border/50 p-2">
            <div className="grid grid-cols-4 gap-1">
              {STATUS_FILTERS.map((item) => (
                <Tip
                  key={item.id}
                  label={`${item.label}（${statusCounts[item.id]}）`}
                  side="bottom"
                >
                  <button
                    type="button"
                    aria-pressed={status === item.id}
                    onClick={() => setStatus(item.id)}
                    className={cn(
                      'rounded-md px-1 py-1.5 text-[10.5px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40',
                      status === item.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                    )}
                  >
                    {STATUS_SHORT[item.id]}
                  </button>
                </Tip>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center px-3 pt-1.5 pb-1">
            <p className="text-[12px] font-semibold tracking-wide text-muted-foreground">分类</p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2 scroll-thin">
            <FilterButton
              active={category === 'all' && subcategory === 'all'}
              label="全部插件"
              count={rows?.length ?? 0}
              onClick={selectAllCategory}
            />
            {CATEGORIES.map((item) => {
              const subs = allCategories.filter(
                (sub) => sub.parent_id === item.topId && (subcategoryCounts.get(sub.id) ?? 0) > 0,
              )
              return (
                <div key={item.id}>
                  <FilterButton
                    active={category === item.id && subcategory === 'all'}
                    icon={item.icon}
                    label={item.label}
                    count={categoryCounts.get(item.id) ?? 0}
                    expanded={expandedCategory === item.id}
                    onClick={() => selectCategory(item.id)}
                    onToggleExpanded={() => toggleExpandedCategory(item.id)}
                  />
                  {expandedCategory === item.id ? (
                    <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-border/50 pl-2">
                      {subs.map((sub) => (
                        <FilterButton
                          key={sub.id}
                          active={subcategory === sub.id}
                          label={sub.name}
                          count={subcategoryCounts.get(sub.id) ?? 0}
                          sub
                          onClick={() => selectSubcategory(item.topId, sub.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </aside>

        <section className="glass flex min-h-0 flex-col overflow-hidden rounded-panel">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
            <p className="text-[13px] text-muted-foreground">
              显示 <span className="font-semibold text-foreground">{filteredRows.length}</span> 个插件
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={bulkMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBulkMode((value) => !value)}
              >
                <ListChecks className="size-3.5" />
                {bulkMode ? '退出批量' : '批量启停'}
              </Button>
              {bulkMode ? (
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2 py-1.5 text-[12.5px] font-medium text-foreground">
                  <Checkbox
                    checked={selectAllState}
                    disabled={selectableRows.length === 0}
                    onCheckedChange={(checked) => {
                      void setEnabledMany(selectableRows, checked === true, true)
                    }}
                    className="size-5"
                    aria-label="全选当前结果"
                  />
                  全选
                </label>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 scroll-thin">
            {rows === null ? (
              <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
                正在读取插件设置…
              </p>
            ) : filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
                <Search className="size-7 text-muted-foreground/70" />
                <p className="text-[14px] font-semibold text-foreground">没有匹配的插件</p>
                <p className="text-[12.5px] text-muted-foreground">换个关键词，或清空筛选条件。</p>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.id} className="mb-1">
                  <div className="sticky top-0 z-10 flex items-center justify-between rounded-md bg-background/85 px-2 py-1.5 text-[11.5px] font-semibold text-muted-foreground backdrop-blur-sm">
                    <span>{group.label}</span>
                    <span>{group.rows.length}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.rows.map((row) => (
                      <PluginListRow
                        key={row.plugin.id}
                        row={row}
                        bulkMode={bulkMode}
                        selected={row.plugin.id === selected?.plugin.id}
                        onSelect={() => selectRow(row)}
                        onToggle={(checked) => void setEnabledMany([row], checked)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </section>

        <aside className="glass hidden min-h-0 overflow-y-auto rounded-panel p-3 scroll-thin min-[1100px]:block">
          {selected ? (
            <PluginDetail
              row={selected}
              onToggle={(key, checked) => patchToggle(selected.plugin.id, key, checked)}
              onOpen={() => void openPluginTool(selected.plugin.id)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Plug className="size-7 text-muted-foreground/70" />
              <p className="text-[13px] text-muted-foreground">选择一个插件查看权限</p>
            </div>
          )}
        </aside>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[82vh] overflow-y-auto scroll-thin">
          {selected ? (
            <PluginDetail
              row={selected}
              onToggle={(key, checked) => patchToggle(selected.plugin.id, key, checked)}
              onOpen={() => void openPluginTool(selected.plugin.id)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterButton({
  active,
  icon: Icon,
  label,
  count,
  expanded,
  sub = false,
  onClick,
  onToggleExpanded,
}: {
  active: boolean
  icon?: LucideIcon
  label: string
  count: number
  expanded?: boolean
  sub?: boolean
  onClick: () => void
  onToggleExpanded?: () => void
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center rounded-md transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 py-2 pl-2 pr-2 text-left font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
          sub && 'py-1.5 text-[11.5px]',
          !sub && 'text-[12.5px]',
        )}
      >
        {sub ? (
          <span className="size-1.5 shrink-0 rounded-full bg-current opacity-40" />
        ) : Icon ? (
          <Icon className="size-4 shrink-0" />
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span
          className={cn(
            'text-[11.5px] tabular-nums',
            active ? 'text-accent-foreground/75' : 'text-muted-foreground/70',
          )}
        >
          {count}
        </span>
      </button>
      {onToggleExpanded ? (
        <button
          type="button"
          aria-label={expanded ? '折叠子分类' : '展开子分类'}
          aria-expanded={expanded}
          onClick={onToggleExpanded}
          className="mr-0.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none transition-colors hover:bg-foreground/[0.08] focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 transition-transform',
              expanded ? '' : '-rotate-90',
            )}
          />
        </button>
      ) : (
        <span className="w-2 shrink-0" />
      )}
    </div>
  )
}

function PluginListRow({
  row,
  bulkMode,
  selected,
  onSelect,
  onToggle,
}: {
  row: PluginRow
  bulkMode: boolean
  selected: boolean
  onSelect: () => void
  onToggle: (checked: boolean) => void
}) {
  const Icon = pluginIcon(row.plugin.id)
  const enabled = effective(row, 'enabled')
  const uiVisible = effective(row, 'uiEnabled')

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors',
        selected ? 'bg-accent text-accent-foreground' : 'hover:bg-foreground/[0.04]',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-foreground/80">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold">{row.plugin.name}</span>
            {!enabled ? <StatusPill>已关闭</StatusPill> : null}
            {enabled && !uiVisible ? <StatusPill>界面隐藏</StatusPill> : null}
          </span>
          <span
            className={cn(
              'mt-0.5 block truncate text-[12px]',
              selected ? 'text-accent-foreground/75' : 'text-muted-foreground',
            )}
          >
            {row.plugin.description}
          </span>
        </span>
      </button>
      {bulkMode ? (
        <Checkbox
          checked={enabled}
          disabled={!row.plugin.defaultPolicy.enabled}
          onCheckedChange={(checked) => onToggle(checked === true)}
          className="size-5"
          aria-label={`${row.plugin.name} 总开关`}
        />
      ) : (
        <Switch
          size="sm"
          checked={enabled}
          disabled={!row.plugin.defaultPolicy.enabled}
          onCheckedChange={onToggle}
          aria-label={`${row.plugin.name} 总开关`}
        />
      )}
    </div>
  )
}

function PluginDetail({
  row,
  onToggle,
  onOpen,
}: {
  row: PluginRow
  onToggle: (key: ToggleKey, checked: boolean) => void
  onOpen: () => void
}) {
  const Icon = pluginIcon(row.plugin.id)
  const canOpen =
    effective(row, 'enabled') && effective(row, 'uiEnabled') && row.plugin.defaultPolicy.uiEnabled
  const openHint = !effective(row, 'enabled')
    ? '总开关已关闭，打开界面不可用'
    : !effective(row, 'uiEnabled')
      ? '界面入口已隐藏，打开界面不可用'
      : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold leading-tight text-foreground">{row.plugin.name}</h2>
          <p className="mt-1 truncate font-mono text-[11.5px] text-muted-foreground">{row.plugin.id}</p>
        </div>
      </div>

      <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{row.plugin.description}</p>

      <p className="text-[12px] font-medium text-muted-foreground">
        分类：{categoryLabel(row.plugin.category)}
        <span className="mx-1.5">·</span>
        {SUB_NAME_BY_ID.get(PLUGIN_SUBCATEGORY.get(row.plugin.id) ?? -1) ?? '未细分'}
      </p>

      <div className="flex flex-col gap-1">
        {TOGGLE_FIELDS.map((field) => {
          const allowed = row.plugin.defaultPolicy[field.key]
          const checked = allowed && row.toggle[field.key]
          const FieldIcon = field.icon
          return (
            <label
              key={field.key}
              className="flex items-start justify-between gap-3 rounded-lg bg-foreground/[0.04] px-3 py-2"
            >
              <span className="flex min-w-0 gap-2">
                <FieldIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">
                    {field.label}
                    {!allowed ? (
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">默认不允许</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                    {field.help}
                  </span>
                </span>
              </span>
              <Switch
                size="sm"
                checked={checked}
                disabled={!allowed}
                onCheckedChange={(next) => onToggle(field.key, next)}
                aria-label={`${row.plugin.name} ${field.label}`}
              />
            </label>
          )
        })}
      </div>

      <Button variant="outline" className="w-full" disabled={!canOpen} onClick={onOpen}>
        打开界面
      </Button>
      {openHint ? <p className="text-center text-[11.5px] text-muted-foreground">{openHint}</p> : null}
    </div>
  )
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-full bg-foreground/[0.08] px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground/75">
      {children}
    </span>
  )
}
