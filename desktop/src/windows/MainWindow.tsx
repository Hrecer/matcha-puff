import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Clock,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  Settings,
  Sparkles,
  Timer,
  Waves,
} from 'lucide-react'
import { AmbientBackground } from '@/components/ui/ambient'
import { CaptionBar } from '@/components/ui/caption-bar'
import { Glass } from '@/components/ui/glass'
import { Tip } from '@/components/ui/tooltip'
import { NavItem } from '@/components/ui/nav-item'
import { useSlidingIndicator } from '@/components/ui/sliding'
import { getConf, listen } from '@/ipc/bridge'
import { useMaximized } from '@/lib/use-maximized'
import { preloadUiPlugins } from '@/lib/use-ui-plugins'
import { readSessionState } from '@/lib/session-state'
import { UNASSIGNED_TASK } from '@matcha-puff/pomodoro-core'
import {
  getFocusStore,
  initFocusStore,
  pauseFocus,
  resumeFocus,
  skipCurrentRest,
  startFocus,
  startManualRest,
  stopFocus,
} from '@/lib/focus-store'
import { About } from '@/pages/About'
import { FocusStopConfirm } from '@/components/focus/FocusStopConfirm'
import { requestStopConfirm } from '@/lib/focus-stop-ask'
import { FocusPage } from '@/pages/focus/FocusPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { NoisePage } from '@/pages/noise/NoisePage'
import { useNoiseStore } from '@/lib/noise-store'
import { PluginCenter } from '@/pages/PluginCenter'
import { Setting } from '@/pages/Setting'
import { ToolRoute } from '@/pages/ToolRoute'
import { WorkbenchHome } from '@/pages/WorkbenchHome'
import { WorkbenchSection, WORKBENCH_PATH_KEY } from '@/pages/WorkbenchSection'
import { WorkbenchTools } from '@/pages/WorkbenchTools'
import { TimePage } from '@/pages/TimePage'
import { categoryIcon } from '@/data/icon-map'
import { topCategories } from '@/data/registry'
import { cn } from 'cn'

export function MainWindow() {
  const nav = useNavigate()
  const location = useLocation()
  const pathname = location.pathname.replace(/\.html$/, '') || '/'
  const [collapsed, setCollapsed] = useState(false)
  const maximized = useMaximized()
  /** 工具页滚动到哪个顶层分类（由页面 scroll spy 回报，驱动分类高亮滑动） */
  const [visibleTopId, setVisibleTopId] = useState<number | undefined>(undefined)
  /** 工具页搜索词：抬到页头，与标题同一行，不再单占一行 */
  const [toolsQuery, setToolsQuery] = useState('')

  useEffect(() => {
    if (pathname !== '/') return
    // 启动落到哪个页面由设置里的「启动默认页」决定，缺省工作台。
    getConf()
      .then((conf) => {
        const target = ['index', 'favorites', 'focus', 'noise'].includes(conf.home_page)
          ? conf.home_page
          : 'index'
        nav(`/${target}`, { replace: true })
      })
      .catch(() => nav('/index', { replace: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 主窗口负责载入专注数据并消费启动时残留的结算；工具窗只同步计时快照。
  useEffect(() => {
    void initFocusStore()
  }, [])

  // 预热工具清单：工具页首帧直接有内容，不再闪空态
  useEffect(() => {
    void preloadUiPlugins()
  }, [])

  // 托盘菜单 / 全局快捷键的专注动作：宿主只负责转发，执行统一落在主窗口的 store，
  // 保证入账、音频、自动流转只有一条路径。
  useEffect(() => {
    const off = listen<{ action?: string }>('focus:quick_action', (payload) => {
      const { config } = getFocusStore()
      switch (payload?.action) {
        case 'start':
          // 已有会话时不再覆盖：与「重复 start 覆盖」的旧行为作别。
          if ((getFocusStore().snapshot?.phase ?? 'idle') === 'idle') {
            void startFocus(config.pomodoroTime, UNASSIGNED_TASK)
          }
          break
        case 'pause':
          void pauseFocus()
          break
        case 'resume':
          void resumeFocus()
          break
        case 'stop':
          void stopFocus()
          break
        case 'skip':
          void skipCurrentRest()
          break
        // 挂件上的「时间到」动作
        case 'rest':
          void startManualRest()
          break
        case 'dismiss':
          void stopFocus()
          break
        // 挂件 / 托盘上的「停止」：先唤起主窗并落到专注页，再弹确认
        case 'ask-stop': {
          nav('/focus')
          requestStopConfirm()
          break
        }
        // 挂件上的「打开」：主窗口直接落到「专注 → 番茄钟」
        case 'open-focus': {
          try {
            sessionStorage.setItem('matcha-puff/focus-tab', 'timer')
          } catch {
            // 存不住不影响本次跳转
          }
          nav('/focus')
          // 若专注页已经挂着，sessionStorage 不会触发重渲染，用事件补一次
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('matcha:focus-tab', { detail: 'timer' }))
          }, 0)
          break
        }
      }
    })
    return off
  }, [nav])



  const cats = topCategories()

  const workbenchPath =
    pathname === '/index' || pathname === '/recent' || pathname === '/favorites'

  const activeKey = workbenchPath
    ? '/index'
    : pathname === '/focus'
      ? '/focus'
      : pathname === '/time'
        ? '/time'
        : pathname === '/noise'
          ? '/noise'
          : undefined

  // 侧栏分类按住上下拖：滑到哪一类就立刻切过去（不等松手）
  const catDrag = useRef({
    down: false,
    startY: 0,
    moved: false,
    suppress: false,
    last: undefined as number | undefined,
  })
  const catSettleUntil = useRef(0)
  const [catDragging, setCatDragging] = useState(false)

  // 上/下导航组按住拖动：滑到哪一项就切到哪一项，指示器 100ms 追随
  const navDrag = useRef({
    down: false,
    startY: 0,
    moved: false,
    last: undefined as string | undefined,
  })
  const [navDragging, setNavDragging] = useState(false)

  const onNavPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    navDrag.current = {
      down: true,
      startY: e.clientY,
      moved: false,
      last: activeKey,
    }
  }

  const onNavPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!navDrag.current.down) return
    if ((e.buttons & 1) === 0) {
      navDrag.current.down = false
      setNavDragging(false)
      const el = e.currentTarget
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      return
    }
    const dy = e.clientY - navDrag.current.startY
    if (!navDrag.current.moved && Math.abs(dy) > 6) {
      navDrag.current.moved = true
      setNavDragging(true)
      try {
        e.currentTarget?.setPointerCapture(e.pointerId)
      } catch {
        /* 指针已释放时忽略：不影响后续命中 */
      }
    }
    if (!navDrag.current.moved) return
    const hit = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-nav-key]')
    const key = hit?.dataset.navKey
    if (!key || key === navDrag.current.last) return
    navDrag.current.last = key
    nav(key)
  }

  const finishNavDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!navDrag.current.down) return
    navDrag.current.down = false
    setNavDragging(false)
    const el = e.currentTarget
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  }
  const catActiveId = pathname === '/tools' ? visibleTopId : undefined


  const topSliding = useSlidingIndicator(activeKey, {
    motion: 'spring',
    extraKey: collapsed ? 'collapsed' : 'expanded',
    fast: navDragging,
  })
  const catSliding = useSlidingIndicator(catActiveId, {
    motion: 'spring',
    extraKey: collapsed ? 'collapsed' : 'expanded',
    fast: catDragging,
  })
  const bottomSliding = useSlidingIndicator(
    pathname === '/plugins'
      ? 'plugins'
      : pathname === '/setting'
        ? 'setting'
        : pathname === '/about'
          ? 'about'
          : undefined,
    { motion: 'spring', extraKey: collapsed ? 'collapsed' : 'expanded', fast: navDragging },
  )

  const onCatPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // 不在按下时抢指针捕获，否则普通点击不会落到分类按钮上
    catDrag.current = {
      down: true,
      startY: e.clientY,
      moved: false,
      suppress: false,
      last: visibleTopId,
    }
  }

  const onCatPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!catDrag.current.down) return
    // 松开后 pointerup 丢失：立即终止拖动，后续悬停不得再切页。
    // 只有真正拖动过才结算；普通点击被丢掉的 pointerup 不能补发跳转。
    if ((e.buttons & 1) === 0) {
      catDrag.current.down = false
      setCatDragging(false)
      if (catDrag.current.moved) {
        window.dispatchEvent(
          new CustomEvent('matcha:tools-drag-end', {
            detail: { id: catDrag.current.last ?? visibleTopId },
          })
        )
      }
      catDrag.current.moved = false
      const el = catSliding.containerRef.current
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      return
    }
    const dy = e.clientY - catDrag.current.startY
    if (!catDrag.current.moved && Math.abs(dy) > 6) {
      catDrag.current.moved = true
      setCatDragging(true)
      catSliding.containerRef.current?.setPointerCapture(e.pointerId)
    }
    if (!catDrag.current.moved) return
    const hit = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-cat-id]')
    if (!hit?.dataset.catId) return
    const id = Number(hit.dataset.catId)
    if (id === catDrag.current.last) return
    // 不松手也立即切页
    catDrag.current.last = id
    setVisibleTopId(id)
    nav(`/tools?cat=${id}`)
  }

  const finishCatDrag = (e: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    if (!catDrag.current.down) return
    catDrag.current.down = false
    setCatDragging(false)
    catSettleUntil.current = performance.now() + 700
    if (commit && catDrag.current.moved) {
      catDrag.current.suppress = true
      window.dispatchEvent(
        new CustomEvent('matcha:tools-drag-end', {
          detail: { id: catDrag.current.last ?? visibleTopId },
        })
      )
    }
    const el = catSliding.containerRef.current
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  }

  
  const handleTopChange = useCallback((id?: number) => {
    if (catDrag.current.down) return
    if (performance.now() < catSettleUntil.current) return
    setVisibleTopId(id)
  }, [])

  const onCatClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!catDrag.current.suppress) return
    catDrag.current.suppress = false
    e.preventDefault()
    e.stopPropagation()
  }

  const pageTitle =
    pathname === '/tools'
      ? '工具'
      : pathname === '/focus'
        ? '专注'
        : pathname === '/noise'
          ? '白噪音'
          : pathname === '/time'
            ? '时间'
          : pathname === '/plugins'
            ? '插件中心'
            : pathname === '/setting'
              ? '设置'
              : pathname === '/about' || pathname === '/update'
                ? '关于'
                : '工作台'

  return (
    <div className={cn('window-shell', maximized && 'is-maximized')}>
      <AmbientBackground />

      <div className="relative z-10 flex h-full flex-col">
        {/* ── 沉浸式标题栏（品牌 + 拖拽 + 自绘窗口按钮） ───────────────── */}
        <CaptionBar maximized={maximized} />

        {/* ── 内容区：玻璃侧栏 + 内容列 ───────────────────────────────── */}
        <div className="flex min-h-0 flex-1 gap-6 p-6">
          {



}
          <Glass
            className={cn(
              // 自己一层淡抹茶底（面板那支绿放淡一档），不套玻璃、不复用卡片材质
              'bg-none bg-[var(--sidebar-surface)] flex shrink-0 select-none flex-col rounded-glass transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
              collapsed ? 'w-[64px]' : 'w-[212px]'
            )}
            aria-label="主导航"
            onDragStart={(e) => e.preventDefault()}
          >
            {/* 顶部折叠钮：与 NavItem 完全同盒模型（w-full/36px、h-9、图标左缘 10px）。
                只渲染一个图标，不做任何位移/交叉淡入。 */}
            <div className="flex h-12 shrink-0 items-center px-3">
              <Tip
                label={collapsed ? '展开侧栏' : '收起侧栏'}
                side="bottom"
                align="start"
                sideOffset={2}
              >
                <button
                  type="button"
                  aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
                  onClick={() => setCollapsed((v) => !v)}
                  className="relative flex h-10 w-full items-center overflow-hidden rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  {collapsed ? (
                    <PanelLeftOpen className="absolute left-3 size-4" />
                  ) : (
                    <PanelLeftClose className="absolute left-2.5 size-4" />
                  )}
                </button>
              </Tip>
            </div>

            {/* 主导航（滑动指示器垫在项下，项本身不画选中底色） */}
            <nav
              ref={topSliding.containerRef}
              onPointerDown={onNavPointerDown}
              onPointerMove={onNavPointerMove}
              onPointerUp={finishNavDrag}
              onPointerCancel={finishNavDrag}
              className="relative flex flex-col gap-1 px-3"
            >
              <span
                aria-hidden
                className="glass-select pointer-events-none absolute left-0 top-0 z-0 rounded-md"
                style={topSliding.indicatorStyle}
              />
              <NavItem
                icon={Sparkles}
                label="工作台"
                active={activeKey === '/index'}
                collapsed={collapsed}
                navKey="/index"
                onClick={() => nav(readSessionState(WORKBENCH_PATH_KEY, '/index'))}
              />
              <NavItem
                icon={Timer}
                label="专注"
                active={activeKey === '/focus'}
                collapsed={collapsed}
                navKey="/focus"
                onClick={() => nav('/focus')}
              />
              <NavItem
                icon={Clock}
                label="时间"
                active={activeKey === '/time'}
                collapsed={collapsed}
                navKey="/time"
                onClick={() => nav('/time')}
              />
              <NoiseNavItem
                active={activeKey === '/noise'}
                collapsed={collapsed}
                onClick={() => nav('/noise')}
              />
            </nav>

            {/* 分组分割线：与底部「设置/关于」上方同款 */}
            <div className="mx-3 mt-4 mb-1 border-t border-border/50" />
            {/* 分组小标题：收起态隐藏文字、保留同高占位，避免列表整体上跳 */}
            <p className="h-5 shrink-0 overflow-hidden whitespace-nowrap px-5 text-[12px] font-semibold leading-5 tracking-wide text-muted-foreground/80">
              {collapsed ? '' : '工具'}
            </p>
            {/* 顶层分类：同一枚滑动指示器随当前滚动分类平滑滑动 */}
            <div
              ref={catSliding.containerRef}
              onPointerDown={onCatPointerDown}
              onPointerMove={onCatPointerMove}
              onPointerUp={(e) => finishCatDrag(e, true)}
              onPointerCancel={(e) => finishCatDrag(e, false)}
              onClickCapture={onCatClickCapture}
              className="relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 scroll-thin"
            >
              <span
                aria-hidden
                className="glass-select pointer-events-none absolute left-0 top-0 z-0 rounded-md"
                style={catSliding.indicatorStyle}
              />
              {cats.map((c) => {
                const Icon = categoryIcon(c.id)
                return (
                  <NavItem
                    key={c.id}
                    icon={Icon}
                    label={c.name}
                    active={catActiveId === c.id}
                    catId={c.id}
                    collapsed={collapsed}
                    onClick={() => {
                      setVisibleTopId(c.id)
                      // 搜索态：侧栏只做「跳到该分类在结果中的位置」，不写 URL cat，
                      // 否则会把其余分类的结果筛掉（列表变短、也滑不到底）
                      if (pathname === '/tools' && toolsQuery.trim()) {
                        if (new URLSearchParams(location.search).get('cat')) {
                          nav('/tools', { replace: true })
                        }
                        window.setTimeout(() => {
                          window.dispatchEvent(
                            new CustomEvent('matcha:tools-jump', { detail: { id: c.id } })
                          )
                        }, 60)
                        return
                      }
                      nav(`/tools?cat=${c.id}`)
                    }}
                  />
                )
              })}
            </div>

            {/* 底部：插件中心 / 设置 / 关于 */}
            <div className="mx-3 mb-1 border-t border-border/50" />
            <div
              ref={bottomSliding.containerRef}
              onPointerDown={onNavPointerDown}
              onPointerMove={onNavPointerMove}
              onPointerUp={finishNavDrag}
              onPointerCancel={finishNavDrag}
              className="relative flex flex-col gap-1 px-3 pb-3 pt-2"
            >
              <span
                aria-hidden
                className="glass-select pointer-events-none absolute left-0 top-0 z-0 rounded-md"
                style={bottomSliding.indicatorStyle}
              />
              <NavItem
                icon={Puzzle}
                label="插件中心"
                active={pathname === '/plugins'}
                collapsed={collapsed}
                navKey="/plugins"
                onClick={() => nav('/plugins')}
              />
              <NavItem
                icon={Settings}
                label="设置"
                active={pathname === '/setting'}
                collapsed={collapsed}
                navKey="/setting"
                onClick={() => nav('/setting')}
              />
              <NavItem
                icon={Info}
                label="关于"
                active={pathname === '/about'}
                collapsed={collapsed}
                navKey="/about"
                onClick={() => nav('/about')}
              />
            </div>
          </Glass>

          {/* 内容列：页头 + 视口 */}
          <div className="flex min-w-0 flex-1 flex-col">
            {!workbenchPath &&
            pathname !== '/tools' &&
            pathname !== '/plugins' &&
            pathname !== '/focus' &&
            pathname !== '/time' &&
            pathname !== '/noise' ? (
              <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-7">
                {/* pr-[2px]：tracking-tight 是负字距，最后一个字的步进比字面窄，
                    truncate 自带 overflow:hidden 就会把它的右边缘切掉 1px（「收藏」的藏看起来被削了一角）。
                    补 2px 右内边距把这点负空间还回去。 */}
                <h1 className="truncate pr-[2px] text-[19px] font-bold tracking-tight text-foreground">
                  {pageTitle}
                </h1>
              </header>
            ) : null}
            <main
              className={cn(
                'min-h-0 flex-1 overflow-hidden',
                // 工具页的滚动视口一直延伸到标题栏下沿：吸顶卡浮在内容上，
                // 卡片上方那条带里能看到内容继续向上滚
                pathname === '/tools' && '-mt-6',
              )}
            >
              <ContentRoute
                pathname={pathname}
                search={location.search}
                toolsQuery={toolsQuery}
                onToolsQueryChange={setToolsQuery}
                onTopChange={handleTopChange}
              />
            </main>
          </div>
        </div>
      </div>

      {/* 停止确认挂在窗口层：不管停在哪个页面，按停止都能弹出来 */}
      <FocusStopConfirm />
    </div>
  )
}

/** 侧栏白噪音入口：只订阅播放状态，音量拖动不会牵动整张主窗重渲染 */
function NoiseNavItem({
  active,
  collapsed,
  onClick,
}: {
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  const noise = useNoiseStore()
  return (
    <NavItem
      icon={Waves}
      label="白噪音"
      active={active}
      collapsed={collapsed}
      navKey="/noise"
      pulse={noise.playing.length > 0}
      onClick={onClick}
    />
  )
}

function ContentRoute({
  pathname,
  search,
  toolsQuery,
  onToolsQueryChange,
  onTopChange,
}: {
  pathname: string
  search: string
  toolsQuery: string
  onToolsQueryChange: (value: string) => void
  onTopChange: (id?: number) => void
}) {
  if (pathname === '/index' || pathname === '/recent' || pathname === '/favorites') {
    return (
      <WorkbenchSection>
        {pathname === '/index' ? (
          <WorkbenchHome />
        ) : (
          <LibraryPage kind={pathname === '/favorites' ? 'favorites' : 'recent'} />
        )}
      </WorkbenchSection>
    )
  }
  if (pathname === '/focus') return <FocusPage />
  if (pathname === '/time') return <TimePage />
  if (pathname === '/noise') return <NoisePage />
  if (pathname === '/tools')
    return (
      <WorkbenchTools
        initialCategory={Number(new URLSearchParams(search).get('cat')) || undefined}
        query={toolsQuery}
        onQueryChange={onToolsQueryChange}
        onTopChange={onTopChange}
      />
    )
  if (pathname === '/plugins') return <PluginCenter />
  if (pathname === '/setting') return <Setting />
  if (pathname === '/about' || pathname === '/update') return <About />
  // /tool/* 与未知地址：占位说明（工具不在此打开）
  return <ToolRoute />
}
