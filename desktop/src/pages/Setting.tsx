import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { DEFAULT_CONFIG, DEFAULT_RING } from '@matcha-puff/pomodoro-core'
import { saveConfig, saveRing } from '@/lib/focus-repo'
import { refreshFocusSettings } from '@/lib/focus-store'
import { clearNoiseBlobs } from '@/lib/noise-blob'
import { stopAllNoise } from '@/lib/noise-store'
import { findSearchByType, getConf, inTauri, invoke, saveConf } from '@/ipc/bridge'
import type { AppConf, CommandItem } from '@/ipc/bridge'
import { SlidingSegmented } from '@/components/ui/sliding'
import { useSessionState } from '@/lib/session-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tip } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { FocusSettings } from '@/pages/settings/FocusSettings'

const SETTING_GROUPS: {
  value: string
  label: string
  panels: { value: string; label: string }[]
}[] = [
  {
    value: 'common',
    label: '常规',
    panels: [
      { value: 'general', label: '常规设置' },
      { value: 'data', label: '数据管理' },
    ],
  },
  {
    value: 'workspace',
    label: '工作台',
    panels: [
      { value: 'search', label: '搜索设置' },
      { value: 'sort', label: '排序设置' },
    ],
  },
  {
    value: 'focus',
    label: '专注',
    panels: [{ value: 'focus', label: '专注设置' }],
  },
]

const CLEAR_CONFIRM_TEXT = '清空所有数据'

/** 应用配置的默认值（与 Rust 端 conf.rs 的 Default 保持一致） */
const DEFAULT_CONF: AppConf = {
  theme: 'system',
  startup: false,
  home_page: 'index',
}

/**
 * 设置页
 *
 * 双层导航：
 *   上层分组：常规 / 专注 / 插件
 *   组内面板：
 *     常规 —— 常规设置、数据管理
 *     专注 —— 专注设置
 *     插件 —— 搜索设置、排序设置
 *
 * 常规设置包含启动默认页、开机启动；
 * 搜索面板自带新增弹窗。
 */
export function Setting() {
  const [tab, setTab] = useSessionState<string>('setting/tab', 'general')
  const activeGroup =
    SETTING_GROUPS.find((group) => group.panels.some((panel) => panel.value === tab)) ??
    SETTING_GROUPS[0]
  const [radio, setRadio] = useState('official')
  const [conf, setConf] = useState<AppConf>(DEFAULT_CONF)
  /** 配置与自启状态都读完后再渲染开关，避免默认值先显示再被真实值覆盖 */
  const [ready, setReady] = useState(false)
  const [list, setList] = useState<CommandItem[]>([])
  
  const [pendingDelete, setPendingDelete] = useState<CommandItem | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearConfirm, setClearConfirm] = useState('')

  // 两个新增弹窗的状态
  const [searchAdd, setSearchAdd] = useState({
    visible: false,
    name: '',
    query: '',
  })

  /** 按当前标签页与来源拉取列表（searchType：默认搜索 2 / 自定义搜索 4，排序 0 表示全部） */
  const loadList = useCallback(
    (nextTab = tab, nextRadio = radio) => {
      const typeMap: Record<string, number> = {
        'search:official': 2,
        'search:customize': 4,
      }
      const searchType = nextTab === 'sort' ? 0 : typeMap[`${nextTab}:${nextRadio}`]
      if (searchType === undefined) return
      findSearchByType(searchType)
        .then((rows) => setList(Array.isArray(rows) ? rows : []))
        .catch(() => setList([]))
    },
    [radio, tab],
  )

  /** 切换标签页：来源复位为官方并重新拉取列表 */
  const onTabChange = (next: string) => {
    setTab(next)
    setRadio('official')
    loadList(next, 'official')
  }

  const onGroupChange = (groupId: string) => {
    const group = SETTING_GROUPS.find((item) => item.value === groupId)
    const first = group?.panels[0]
    if (first && first.value !== tab) onTabChange(first.value)
  }

  // 标签从会话记忆恢复时列表还没请求过，挂载后补一次（常规设置等无列表的标签是空操作）
  useEffect(() => {
    loadList(tab, 'official')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 初始化：配置与系统自启状态一次读齐，再点亮开关（避免「打开→自动变关闭」的闪变）
  useEffect(() => {
    let alive = true
    Promise.allSettled([invoke<boolean>('plugin:autostart|is_enabled'), getConf()]).then(
      ([auto, stored]) => {
        if (!alive) return
        const c = stored.status === 'fulfilled' ? stored.value : undefined
        const theme = c?.theme === 'auto' ? 'system' : (c?.theme ?? DEFAULT_CONF.theme)
        setConf({
          ...DEFAULT_CONF,
          ...c,
          theme,
          startup:
            auto.status === 'fulfilled' ? Boolean(auto.value) : Boolean(c?.startup ?? false),
        })
        setReady(true)
      },
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 写入配置（不 await：写失败不阻塞交互） */
  const writeConf = useCallback((next: AppConf) => {
    saveConf(next).catch(() => {})
  }, [])

  /** 开机启动开关 */
  const onStartupChange = (checked: boolean) => {
    const next = { ...conf, startup: checked }
    setConf(next)
    invoke(checked ? 'plugin:autostart|enable' : 'plugin:autostart|disable')
      .then(() => writeConf(next))
      .catch(() => writeConf(next))
  }

  /**
   * 恢复默认设置：这是全局的那一个，常规设置和专注设置一起回到出厂值。
   * 顺序上先写应用配置，再写专注的时长/声音，最后刷新快捷键与专注状态。
   */
  const resetAllSettings = async () => {
    try {
      await saveConf({ ...DEFAULT_CONF })
      await saveConfig({ ...DEFAULT_CONFIG })
      await saveRing({ ...DEFAULT_RING })
      await refreshFocusSettings()
      // 开机启动跟着关掉；这些外部副作用失败不阻塞其余恢复
      await invoke('plugin:autostart|disable').catch(() => {})
      setConf({ ...DEFAULT_CONF })
      toast('已恢复默认设置')
    } catch {
      toast('恢复失败，请稍后重试', 'error')
    } finally {
      setResetOpen(false)
    }
  }

  /** 清空全部用户数据：停掉计时、清库、重置设置与本地数据，然后回到工作台 */
  const clearAllUserData = async () => {
    try {
      // 桌面版：连 Rust 侧的数据（数据库、开机自启）一起清
      if (inTauri()) {
        await invoke('clear_user_data')
        await saveConf({ ...DEFAULT_CONF })
        await invoke('plugin:autostart|disable').catch(() => {})
      }
      // 浏览器预览里没有 Rust 侧：清掉本地存储与 IndexedDB（含自定义声音音频）即可
      stopAllNoise()
      await clearNoiseBlobs()
      localStorage.clear()
      sessionStorage.clear()
      window.location.hash = '#/index'
      window.location.reload()
    } catch (e) {
      toast(`清空失败：${String(e)}`, 'error')
    }
  }

  /** 启用 / 停用某条记录 */
  const toggleState = (item: CommandItem) => {
    invoke('set_search_state_by_code', { id: item.id, state: item.state ? 1 : 0 }).catch(() => {})
  }

  /** 删除一条自定义项 */
  const removeItem = (id: number) => {
    invoke('delete_command_by_id', { id })
      .then(() => {
        toast('删除成功')
        loadList()
      })
      .catch(() => {})
  }

  /** 新增自定义搜索 */
  const addSearch = () => {
    invoke('add_search', {
      name: searchAdd.name,
      icon: 'ri-search-line',
      color: '#A8D4AD',
      command: searchAdd.query,
      typeId: 4,
    })
      .then(() => {
        toast('添加成功')
        setSearchAdd({ visible: false, name: '', query: '' })
        loadList()
      })
      .catch(() => {})
  }

  const moveUp = (item: CommandItem, index: number) => {
    const prev = list[index - 1]
    if (index <= 0 || !prev) return
    invoke('update_command_sort', { id: item.id, weight: prev.weight })
      .then(() => invoke('update_command_sort', { id: prev.id, weight: item.weight }))
      .then(() => {
        const next = [...list]
        next[index - 1] = { ...item, weight: prev.weight }
        next[index] = { ...prev, weight: item.weight }
        setList(next)
      })
      .catch(() => {})
  }

  /** 下移：与下一条交换 weight */
  const moveDown = (item: CommandItem, index: number) => {
    const nextItem = list[index + 1]
    if (index >= list.length - 1 || !nextItem) return
    invoke('update_command_sort', { id: item.id, weight: nextItem.weight })
      .then(() => invoke('update_command_sort', { id: nextItem.id, weight: item.weight }))
      .then(() => {
        const next = [...list]
        next[index + 1] = { ...item, weight: nextItem.weight }
        next[index] = { ...nextItem, weight: item.weight }
        setList(next)
      })
      .catch(() => {})
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 双层导航：分组 + 组内面板；页面标题由外层页头统一提供 */}
      <header className="flex shrink-0 flex-col gap-2 px-7 pb-2 pt-2">
        <div className="flex min-h-10 items-center gap-4">
          <SlidingSegmented
            options={SETTING_GROUPS.map(({ value, label }) => ({ value, label }))}
            value={activeGroup.value}
            onValueChange={onGroupChange}
            size="md"
            motion="spring"
            ariaLabel="设置分组"
          />
        </div>
        <SlidingSegmented
          options={activeGroup.panels}
          value={tab}
          onValueChange={onTabChange}
          size="sm"
          motion="spring"
          ariaLabel="设置面板"
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {tab === 'general' && (
          <div className="flex max-w-2xl flex-col gap-7 px-6 py-7">
            {ready ? (
              <>
                <div className="flex items-center gap-4">
                  <Label className="w-32 shrink-0">启动默认页</Label>
                  <Select
                    value={conf.home_page || 'index'}
                    onValueChange={(value) => {
                      const next = { ...conf, home_page: value }
                      setConf(next)
                      writeConf(next)
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="index">工作台</SelectItem>
                      <SelectItem value="favorites">收藏</SelectItem>
                      <SelectItem value="focus">专注</SelectItem>
                      <SelectItem value="noise">白噪音</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4">
                  <Label className="w-32 shrink-0">开机启动</Label>
                  <Switch checked={conf.startup} onCheckedChange={onStartupChange} />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">正在读取设置…</p>
            )}
          </div>
        )}

        {tab === 'search' && (
          <div className="flex h-full min-h-0 flex-col px-6 py-6">
            {/* 来源选择：同款滑动指示器；「新增搜索」只在自定义分栏出现，与它同一行等高 */}
            <div className="flex items-center gap-3">
              <SlidingSegmented
                options={
                  [
                    { value: 'official', label: '默认搜索' },
                    { value: 'customize', label: '自定义搜索' },
                  ] as { value: string; label: string }[]
                }
                value={radio}
                onValueChange={(v) => {
                  setRadio(v)
                  loadList(tab, v)
                }}
                size="md"
                motion="spring"
                ariaLabel="来源"
              />
              {radio === 'customize' && (
                <Button
                  className="ml-auto"
                  onClick={() => setSearchAdd((s) => ({ ...s, visible: true }))}
                >
                  <Plus />
                  新增搜索
                </Button>
              )}
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 scroll-thin">
              {list.map((item) => (
                <div
                  key={item.code ?? item.id}
                  className="glass flex items-center gap-3 rounded-lg px-3 py-2.5"
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"
                  >
                    <Search className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.command}</p>
                  </div>
                  {radio === 'customize' ? (
                    <Tip label="删除">
                      <span className="inline-flex">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="删除"
                          onClick={() => setPendingDelete(item)}
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    </Tip>
                  ) : null}
                  <Switch
                    size="sm"
                    checked={item.state === 1}
                    onCheckedChange={(checked) => {
                      const next = { ...item, state: checked ? 1 : 0 }
                      toggleState(next)
                      setList((l) => l.map((x) => (x.id === item.id ? next : x)))
                    }}
                  />
                </div>
              ))}
              {list.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">暂无数据</p>
              ) : null}
            </div>
          </div>
        )}

        {tab === 'sort' && (
          <div className="flex h-full min-h-0 flex-col px-6 py-6">
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 scroll-thin">
              {list.map((item, index) => (
                <div
                  key={item.code ?? item.id}
                  className="glass flex items-center gap-3 rounded-lg px-3 py-2.5"
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"
                  >
                    <Search className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.command}</p>
                  </div>
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="上移"
                      disabled={index === 0}
                      onClick={() => moveUp(item, index)}
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="下移"
                      disabled={index >= list.length - 1}
                      onClick={() => moveDown(item, index)}
                    >
                      <ChevronDown />
                    </Button>
                  </div>
                </div>
              ))}
              {list.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">暂无数据</p>
              ) : null}
            </div>
          </div>
        )}

        {tab === 'focus' && <FocusSettings />}

        {tab === 'data' && (
          <div className="flex max-w-2xl flex-col gap-7 px-6 py-7">
            <section className="flex flex-col gap-3">
              <h2 className="text-[13px] font-semibold text-foreground">恢复默认设置</h2>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                把常规设置和专注设置（时长、流转、提示音与白噪音）恢复为默认值。
              </p>
              <div>
                <Button variant="outline" onClick={() => setResetOpen(true)}>
                  <RotateCcw className="size-3.5" aria-hidden />
                  恢复默认设置
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-3 border-t border-border/50 pt-6">
              <h2 className="text-[13px] font-semibold text-destructive">清空所有用户数据</h2>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                任务、习惯、专注记录、统计、收件箱、收藏、最近使用、自定义搜索与全部设置都会被永久删除，且无法恢复。
              </p>
              <div>
                <Button variant="destructive" onClick={() => setClearOpen(true)}>
                  <Trash2 className="size-3.5" aria-hidden />
                  清空所有用户数据
                </Button>
              </div>
            </section>
          </div>
        )}

      </div>

      {/* 新增搜索弹窗 */}
      <Dialog open={searchAdd.visible} onOpenChange={(open) => setSearchAdd((s) => ({ ...s, visible: open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增搜索</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="matcha-search-name">展示名称</Label>
              <Input
                id="matcha-search-name"
                value={searchAdd.name}
                onChange={(e) => setSearchAdd((s) => ({ ...s, name: e.target.value }))}
                placeholder="例：XX搜索"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="matcha-search-query">
                搜索链接
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {'{query} 为搜索关键词占位符'}
                </span>
              </Label>
              <Input
                id="matcha-search-query"
                value={searchAdd.query}
                onChange={(e) => setSearchAdd((s) => ({ ...s, query: e.target.value }))}
                placeholder="例：https://www.*.com/s?wd={query}"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSearchAdd((s) => ({ ...s, visible: false }))}>
              取消
            </Button>
            <Button onClick={addSearch}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除确认</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            确定要删除「{pendingDelete?.name}」吗？删除后不可恢复。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) removeItem(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>恢复默认设置</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            常规设置和专注设置都会恢复为默认值，自定义的快捷键、时长、提示音都会被重置。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void resetAllSettings()}>
              恢复默认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={clearOpen}
        onOpenChange={(open) => {
          setClearOpen(open)
          if (!open) setClearConfirm('')
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>清空所有用户数据</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              任务、习惯、专注记录、统计、收件箱、收藏、最近使用、自定义搜索与全部设置都会被永久删除，无法恢复。
            </p>
            <p className="text-sm font-medium text-foreground">
              请输入「{CLEAR_CONFIRM_TEXT}」以确认：
            </p>
            <Input
              value={clearConfirm}
              onChange={(event) => setClearConfirm(event.target.value)}
              placeholder={CLEAR_CONFIRM_TEXT}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={clearConfirm.trim() !== CLEAR_CONFIRM_TEXT}
              onClick={() => void clearAllUserData()}
            >
              永久清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
