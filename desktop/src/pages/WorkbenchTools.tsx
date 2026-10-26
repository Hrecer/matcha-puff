import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty } from '@/components/ui/empty'
import { FrostedGlassUnion, type FrostedGlassUnionHandle } from '@/components/ui/frosted-glass'
import { SearchInput } from '@/components/ui/search-input'
import { SlidingSegmented } from '@/components/ui/sliding'
import { categoryById, childrenOf, topCategories } from '@/data/registry'
import { PluginTile } from '@/pages/PluginTile'
import { pluginCategoryIds } from '@/lib/plugin-category'
import type { UiPlugin } from '@/lib/tool-core'
import { uiPluginsLoaded, useUiPlugins } from '@/lib/use-ui-plugins'

/** 吸顶第一行（工具 + 搜索）与分类条的固定高度 */
const HEAD_H = 56
const STRIP_H = 48
/** 悬浮上边距 */
const TOP_INSET = 24

interface SubGroup {
  category: { id: number; name: string }
  plugins: UiPlugin[]
}

interface Group {
  top: { id: number; name: string }
  /** 分类条上展示的子分类 */
  headerSubs: SubGroup[]
  /** 目录中实际渲染的工具组（搜索态可能已收窄） */
  subs: SubGroup[]
  /** 没有可映射分类的插件，才挂在顶层 */
  pluginDirect: UiPlugin[]
}

const PLUGIN_TOP_CATEGORY: Record<string, number> = {
  webmaster: 1, // 系统运维
  reporter: 2, // 编辑工具
  coding: 3, // 编程工具
  design: 4, // 设计工具
  life: 5, // 生活常用
}
const topForPlugin = (category: string) => PLUGIN_TOP_CATEGORY[category] ?? 5


export const WorkbenchTools = memo(function WorkbenchTools({
  initialCategory,
  query,
  onQueryChange,
  onTopChange,
}: {
  initialCategory?: number
  query: string
  onQueryChange: (value: string) => void
  onTopChange?: (id?: number) => void
}) {
  const nav = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const floatCardRef = useRef<HTMLDivElement>(null)
  const fixedRowRef = useRef<HTMLDivElement>(null)
  const mergeUnionRef = useRef<FrostedGlassUnionHandle | null>(null)
  const mergeCopyRef = useRef<HTMLDivElement>(null)
  const mergeApiRef = useRef<(() => void) | null>(null)
  const mergeIdRef = useRef<number | undefined>(undefined)
  const [mergeId, setMergeId] = useState<number | undefined>(undefined)
  const qRef = useRef('')
  const prevQRef = useRef('')
  const lastScrollQRef = useRef<string | null>(null)
  const subOverrideTimer = useRef<number | undefined>(undefined)
  /** 用户点选的子分类：滚动到位前锁定选中值，避免平滑滚动途经其他分类时来回跳 */
  const pendingSubRef = useRef<number | undefined>(undefined)
  /** 初始分类的落点还没兑现：插件目录异步返回前目标 section 不存在，等内容到了再补 */
  const pendingInitialRef = useRef<number | undefined>(initialCategory)
  /** 首次落点直接到位，不走平滑；进页时不触发吸顶卡的接合动画 */
  const firstLandingRef = useRef(true)
  const lastInitialCategoryRef = useRef<number | undefined>(initialCategory)
  const [spyTopId, setSpyTopId] = useState<number | undefined>(() => {
    if (initialCategory === undefined) return undefined
    const c = categoryById(initialCategory)
    return c ? (c.parent_id === 0 ? c.id : c.parent_id) : undefined
  })
  const [spySubId, setSpySubId] = useState<number | undefined>(undefined)
  const [selectedSubId, setSelectedSubId] = useState<number | undefined>(undefined)
  const [userSubOverride, setUserSubOverride] = useState(false)
  const pluginEntries = useUiPlugins()

  const q = query.trim().toLowerCase()
  qRef.current = q

  const matchedPlugins = useMemo(() => {
    if (!q) return pluginEntries
    return pluginEntries.filter(
      ({ meta }) =>
        meta.name.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q) ||
        meta.keywords.some((keyword) => keyword.toLowerCase().includes(q)),
    )
  }, [q, pluginEntries])

  const buildGroups = useCallback(
    (plugins: UiPlugin[]): Group[] =>
      topCategories()
        .map((top) => {
          const subs = childrenOf(top.id)
            .slice()
            .sort((a, b) => a.id - b.id)
            .map((sub) => ({
              category: sub,
              plugins: plugins.filter((entry) => pluginCategoryIds(entry.meta).includes(sub.id)),
            }))
            .filter((g) => g.plugins.length > 0)
          const pluginDirect = plugins.filter((entry) => {
            if (topForPlugin(entry.meta.category) !== top.id) return false
            const ids = pluginCategoryIds(entry.meta)
            return ids.length === 0 || ids.includes(top.id)
          })
          return { top, headerSubs: subs, subs, pluginDirect }
        })
        .filter((g) => g.subs.length > 0 || g.pluginDirect.length > 0),
    [],
  )

  const groups = useMemo<Group[]>(() => buildGroups(pluginEntries), [buildGroups, pluginEntries])

  const searchGroups = useMemo<Group[] | null>(() => {
    if (!q) return null
    return buildGroups(matchedPlugins)
  }, [q, matchedPlugins, buildGroups])

  const active = initialCategory !== undefined ? categoryById(initialCategory) : undefined
  const activeTop = active ? (active.parent_id === 0 ? active : categoryById(active.parent_id)) : undefined
  const activeSub = active && active.parent_id !== 0 ? active : undefined

  const renderedGroups = useMemo<Group[]>(() => {
    if (!searchGroups) return groups
    const base = activeTop ? searchGroups.filter((g) => g.top.id === activeTop.id) : searchGroups
    return base
      .map((g) => ({
        top: g.top,
        headerSubs: g.headerSubs,
        pluginDirect: activeSub ? [] : g.pluginDirect,
        subs: activeSub ? g.subs.filter((s) => s.category.id === activeSub.id) : g.subs,
      }))
      .filter((g) => g.subs.length > 0 || g.pluginDirect.length > 0)
  }, [groups, searchGroups, activeTop, activeSub])

  const currentGroup = useMemo(
    () => renderedGroups.find((g) => g.top.id === spyTopId) ?? renderedGroups[0],
    [renderedGroups, spyTopId],
  )

  /** 插件目录异步返回前，先用注册表把吸顶第二行撑起来，避免进页时卡片向下展开 */
  const headerFallback = useMemo(() => {
    if (renderedGroups.length > 0 || initialCategory === undefined) return undefined
    const cat = categoryById(initialCategory)
    const top = cat ? (cat.parent_id === 0 ? cat : categoryById(cat.parent_id)) : undefined
    if (!top) return undefined
    return {
      top,
      headerSubs: childrenOf(top.id)
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((sub) => ({ category: sub, plugins: [] })),
    }
  }, [renderedGroups.length, initialCategory])
  const headerGroup = currentGroup ?? headerFallback

  const mergeGroup = useMemo(
    () => (mergeId !== undefined ? renderedGroups.find((g) => g.top.id === mergeId) : undefined),
    [mergeId, renderedGroups],
  )

  const scrollToSection = useCallback((id: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    const target = el?.querySelector<HTMLElement>(`#cat-${id}`)
    if (!el || !target) return
    const isTop = target.dataset.topId !== undefined
    // 子项落点必须与当前分类切换线一致：落在 128px 时卡片顶部正好到 80px，
    // 否则会停在卡片尚未接管的位置，出现上一分类与下一张卡重叠。
    const offset = TOP_INSET + (isTop ? HEAD_H : HEAD_H + STRIP_H)
    const portTop = el.getBoundingClientRect().top
    el.scrollTo({
      top: Math.max(0, el.scrollTop + target.getBoundingClientRect().top - portTop - offset),
      behavior,
    })
  }, [])

  /** 搜索态侧栏点分类：只跳到该分类的结果位置，不改变结果集 */
  useEffect(() => {
    const onJump = (e: Event) => {
      const id = (e as CustomEvent<{ id?: number }>).detail?.id
      if (id !== undefined) scrollToSection(id)
    }
    window.addEventListener('matcha:tools-jump', onJump as EventListener)
    return () => window.removeEventListener('matcha:tools-jump', onJump as EventListener)
  }, [scrollToSection])

  /** 拖动松手：立即定住，不留下持续滚动的「悬停还在变」 */
  useEffect(() => {
    const onDragEnd = (e: Event) => {
      const id = (e as CustomEvent<{ id?: number }>).detail?.id
      if (id !== undefined) scrollToSection(id, 'auto')
    }
    window.addEventListener('matcha:tools-drag-end', onDragEnd as EventListener)
    return () => window.removeEventListener('matcha:tools-drag-end', onDragEnd as EventListener)
  }, [scrollToSection])

  /** 原生滚动只更新「当前分类/子项」，不碰任何玻璃几何 */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const portTop = el.getBoundingClientRect().top
      const sections = Array.from(el.querySelectorAll<HTMLElement>('section[data-top-id]'))
      let cur: number | undefined
      let incomingId: number | undefined
      let incomingTop: number | undefined
      for (const section of sections) {
        const top = section.getBoundingClientRect().top - portTop
        if (top <= TOP_INSET + HEAD_H + 0.5) cur = Number(section.dataset.topId)
        else {
          incomingId = Number(section.dataset.topId)
          incomingTop = top
          break
        }
      }
      if (cur === undefined && sections.length > 0) {
        cur = Number(sections[0]!.dataset.topId)
      }
      let sub: number | undefined
      if (cur !== undefined) {
        const sec = el.querySelector<HTMLElement>(`#cat-${cur}`)
        const subs = sec ? Array.from(sec.querySelectorAll<HTMLElement>('[data-sub-id]')) : []
        for (const node of subs) {
          if (node.getBoundingClientRect().top - portTop > TOP_INSET + HEAD_H + STRIP_H + 16) {
            break
          }
          sub = Number(node.dataset.subId)
        }
        if (sub === undefined && subs.length > 0) sub = Number(subs[0]!.dataset.subId)
      }
      setSpyTopId((prev) => (prev === cur ? prev : cur))
      setSpySubId((prev) => (prev === sub ? prev : sub))

      // 平滑滚动途经其他子分类时不释放；真正到达点选目标后才交回滚动监听
      if (pendingSubRef.current !== undefined && sub === pendingSubRef.current) {
        pendingSubRef.current = undefined
        window.clearTimeout(subOverrideTimer.current)
        setUserSubOverride(false)
      }

      // 合体区间：来卡顶边从贴住悬浮卡底沿（128）滑到完全盖住（80）
      const mergeStart = TOP_INSET + HEAD_H + STRIP_H
      const mergeEnd = TOP_INSET + HEAD_H
      const merging =
        incomingId !== undefined &&
        incomingTop !== undefined &&
        incomingTop > mergeEnd &&
        incomingTop <= mergeStart
      if (merging) {
        if (mergeIdRef.current !== incomingId) {
          mergeIdRef.current = incomingId
          setMergeId(incomingId)
        }
        mergeApiRef.current?.()
      } else if (mergeIdRef.current !== undefined) {
        mergeIdRef.current = undefined
        setMergeId(undefined)
      }
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    /** 用户主动滚轮/触摸时立刻交回滚动监听，不把点选值粘住 */
    const releaseOverride = () => {
      if (pendingSubRef.current === undefined) return
      pendingSubRef.current = undefined
      window.clearTimeout(subOverrideTimer.current)
      setUserSubOverride(false)
    }
    const onScrollEnd = () => releaseOverride()
    el.addEventListener('scroll', schedule, { passive: true })
    el.addEventListener('scrollend', onScrollEnd)
    el.addEventListener('wheel', releaseOverride, { passive: true })
    el.addEventListener('touchstart', releaseOverride, { passive: true })
    window.addEventListener('resize', schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    schedule()
    return () => {
      el.removeEventListener('scroll', schedule)
      el.removeEventListener('scrollend', onScrollEnd)
      el.removeEventListener('wheel', releaseOverride)
      el.removeEventListener('touchstart', releaseOverride)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [renderedGroups])

  // 目录态始终占住第二行：数据到达前也不让卡片高度从 56 长到 104
  const hasRow = currentGroup !== undefined || !q

  /**
   * 拼合区间内才挂载 goo 浮层：只在这 48px 内按滚动位置实时算形状；
   * 离开区间立即卸载，回到纯静态卡。
   */
  useLayoutEffect(() => {
    if (mergeId === undefined) return
    const sc = scrollRef.current
    const float = floatCardRef.current
    const row = fixedRowRef.current
    if (!sc || !float || !row) {
      setMergeId(undefined)
      return
    }
    const section = sc.querySelector<HTMLElement>(`#cat-${mergeId}`)
    const pill = section?.querySelector<HTMLElement>('.tools-strip-card')
    const union = mergeUnionRef.current
    if (!pill || !union) {
      setMergeId(undefined)
      return
    }

    const prevVisibility = pill.style.visibility
    pill.style.visibility = 'hidden'
    const width = float.clientWidth
    const portTop = sc.getBoundingClientRect().top

    const update = () => {
      const top = pill.getBoundingClientRect().top - portTop
      const progress = Math.max(
        0,
        Math.min(1, ((TOP_INSET + HEAD_H + STRIP_H) - top) / STRIP_H),
      )
      const pillY = HEAD_H + STRIP_H - STRIP_H * progress
      union.setRects(
        [
          { x: 0, y: 0, w: width, h: HEAD_H + STRIP_H, rx: 36 },
          { x: 0, y: pillY, w: width, h: STRIP_H, rx: 24 },
        ],
        HEAD_H + STRIP_H + STRIP_H,
      )
      if (mergeCopyRef.current) {
        mergeCopyRef.current.style.transform = `translate3d(0, ${pillY}px, 0)`
      }
      const fade = progress <= 0.55 ? 1 : Math.max(0, 1 - (progress - 0.55) / 0.45)
      row.style.opacity = String(fade)
    }

    mergeApiRef.current = update
    update()

    return () => {
      mergeApiRef.current = null
      const top = pill.getBoundingClientRect().top - portTop
      // 停在切换线上时卡片已属于当前分类，保持隐藏；反向滑出则恢复
      pill.style.visibility =
        top <= TOP_INSET + HEAD_H + 0.5 ? 'hidden' : prevVisibility
      row.style.opacity = ''
    }
  }, [mergeId])

  useEffect(() => {
    onTopChange?.(spyTopId)
  }, [spyTopId, onTopChange])

  useEffect(() => () => window.clearTimeout(subOverrideTimer.current), [])

  useEffect(() => {
    window.clearTimeout(subOverrideTimer.current)
    pendingSubRef.current = undefined
    setUserSubOverride(false)
  }, [spyTopId])

  useLayoutEffect(() => {
    if (qRef.current) {
      scrollRef.current?.scrollTo({ top: 0 })
      return
    }
    if (initialCategory === undefined) {
      pendingInitialRef.current = undefined
      // 首次进入本来就在顶部；从某个分类回到不带分类时再平滑回顶
      if (lastInitialCategoryRef.current !== undefined) {
        lastInitialCategoryRef.current = undefined
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }
    if (lastInitialCategoryRef.current !== initialCategory) {
      lastInitialCategoryRef.current = initialCategory
      pendingInitialRef.current = initialCategory
    }
    if (pendingInitialRef.current === undefined) return
    // 目录还没到：等内容渲染出来（renderedGroups 变化）再补这次落点
    const id = pendingInitialRef.current
    const target = scrollRef.current?.querySelector<HTMLElement>(`#cat-${id}`)
    if (!target) return
    pendingInitialRef.current = undefined
    // 首帧落点必须与绘制同帧，否则会先露出顶部再跳
    scrollToSection(id, firstLandingRef.current ? 'auto' : 'smooth')
    firstLandingRef.current = false
  }, [initialCategory, scrollToSection, renderedGroups])

  useEffect(() => {
    // 搜索词变化时回到顶部；首帧不要覆盖 initialCategory 的跳转
    if (lastScrollQRef.current === null) {
      lastScrollQRef.current = q
      return
    }
    if (lastScrollQRef.current === q) return
    lastScrollQRef.current = q
    scrollRef.current?.scrollTo({ top: 0 })
  }, [q])

  useEffect(() => {
    const wasSearching = prevQRef.current.length > 0
    prevQRef.current = q
    if (q && !wasSearching && initialCategory !== undefined) {
      nav('/tools', { replace: true })
    }
  }, [q, initialCategory, nav])

  const selectSub = (subId: number) => {
    setSelectedSubId(subId)
    setUserSubOverride(true)
    pendingSubRef.current = subId
    window.clearTimeout(subOverrideTimer.current)
    // 兜底：环境不支持 scrollend 且没有触发滚动事件时，最终交回滚动监听
    subOverrideTimer.current = window.setTimeout(() => {
      pendingSubRef.current = undefined
      setUserSubOverride(false)
    }, 2500)
    scrollToSection(subId)
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto px-7 pb-10 scroll-thin [overflow-anchor:none]"
      >
        {/* 悬浮卡在流内的占位：上边距 + 头行高度；第一条分类卡从 80 开始 */}
        <div aria-hidden style={{ height: TOP_INSET + HEAD_H }} />

        {renderedGroups.length === 0 ? (
          // 目录还在加载：先留空，别闪一下「没有匹配的工具」
          !q && !uiPluginsLoaded() ? null : (
            <div className="pt-10">
              <Empty size="sm" title="没有匹配的工具" description="换个关键词或分类试试。" />
            </div>
          )
        ) : (
          <>
            <div className="flex flex-col">
              {renderedGroups.map(({ top, headerSubs, subs, pluginDirect }) => {
                const isCurrent = spyTopId === top.id
                return (
                  <section key={top.id} id={`cat-${top.id}`} data-top-id={top.id}>
                    {/* 原生玻璃分类条：整张卡和描边都是普通元素，滚动时不做任何几何重算 */}
                    <div
                      className="tools-strip-card -mx-4 flex min-w-0 items-center gap-4 px-8"
                      style={{
                        height: STRIP_H,
                        visibility: isCurrent ? 'hidden' : 'visible',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => scrollToSection(top.id)}
                        className="shrink-0 cursor-pointer rounded-md text-[16px] font-bold tracking-tight text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                      >
                        {top.name}
                      </button>
                      {headerSubs.length > 0 ? (
                        <SlidingSegmented
                          options={headerSubs.map((s) => ({
                            value: s.category.id,
                            label: s.category.name,
                          }))}
                          onValueChange={selectSub}
                          motion="spring"
                          size="sm"
                          bare
                          ariaLabel={`${top.name}子分类`}
                          className="min-w-0"
                        />
                      ) : null}
                    </div>

                    {pluginDirect.length > 0 ? (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 pt-5">
                        {pluginDirect.map((entry) => (
                          <PluginTile
                            key={entry.meta.id}
                            meta={entry.meta}
                            disabled={!entry.enabled}
                          />
                        ))}
                      </div>
                    ) : null}
                    {subs.map((g, i) => (
                      <div
                        key={g.category.id}
                        id={`cat-${g.category.id}`}
                        data-sub-id={g.category.id}
                        className={
                          i > 0 || pluginDirect.length > 0
                            ? 'mt-5 border-t-[1.5px] border-foreground/20 pt-5'
                            : 'pt-5'
                        }
                      >
                        <p className="pb-2.5 text-[14px] font-semibold text-foreground/85">
                          {g.category.name}
                        </p>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                          {g.plugins.map((entry) => (
                            <PluginTile
                              key={entry.meta.id}
                              meta={entry.meta}
                              disabled={!entry.enabled}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="h-10" />
                  </section>
                )
              })}
            </div>
            <div aria-hidden style={{ height: 'max(0px, calc(100dvh - 480px))' }} />
          </>
        )}
      </div>

      {/* 固定悬浮卡：大圆角玻璃矩形 + 搜索行 + 当前分类行。滚动中完全不动 */}
      {mergeGroup ? (
        <div
          data-merge-layer="1"
          className="tools-merge-layer pointer-events-none absolute left-3 right-[22px] z-[25]"
          style={{ top: TOP_INSET }}
        >
          <FrostedGlassUnion ref={mergeUnionRef} radius={36} mergeTouching={false} />
          <div
            ref={mergeCopyRef}
            aria-hidden
            className="absolute left-0 right-0 top-0 z-30 flex min-w-0 items-center gap-4 px-8"
            style={{
              height: STRIP_H,
              transform: 'translate3d(0, 104px, 0)',
              pointerEvents: 'none',
            }}
          >
            <span className="shrink-0 text-[16px] font-bold tracking-tight text-foreground">
              {mergeGroup.top.name}
            </span>
            {mergeGroup.headerSubs.length > 0 ? (
              <SlidingSegmented
                options={mergeGroup.headerSubs.map((s) => ({
                  value: s.category.id,
                  label: s.category.name,
                }))}
                onValueChange={() => {}}
                motion="spring"
                size="sm"
                bare
                ariaLabel={`${mergeGroup.top.name}子分类`}
                className="min-w-0"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={floatCardRef}
        className={`tools-float-card pointer-events-none absolute left-3 right-[22px] z-30${mergeId !== undefined ? ' is-merging' : ''}`}
        style={{ top: TOP_INSET, height: hasRow ? HEAD_H + STRIP_H : HEAD_H }}
      >
        <div
          className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between gap-3 px-8"
          style={{ height: HEAD_H, pointerEvents: 'auto', zIndex: 30 }}
        >
          <h1 className="shrink-0 text-[20px] font-bold tracking-tight text-foreground">
            工具
          </h1>
          <SearchInput value={query} onValueChange={onQueryChange} className="w-72" />
        </div>
        {headerGroup ? (
          <div
            ref={fixedRowRef}
            className="absolute left-0 right-0 z-30 flex min-w-0 items-center gap-4 px-8"
            style={{ top: HEAD_H, height: STRIP_H, pointerEvents: 'auto', zIndex: 30 }}
          >
            <button
              type="button"
              onClick={() => scrollToSection(headerGroup.top.id)}
              className="shrink-0 cursor-pointer rounded-md text-[16px] font-bold tracking-tight text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              {headerGroup.top.name}
            </button>
            {headerGroup.headerSubs.length > 0 ? (
              <SlidingSegmented
                options={headerGroup.headerSubs.map((s) => ({
                  value: s.category.id,
                  label: s.category.name,
                }))}
                value={userSubOverride ? selectedSubId : spySubId}
                onValueChange={selectSub}
                motion="spring"
                size="sm"
                bare
                ariaLabel={`${headerGroup.top.name}子分类`}
                className="min-w-0"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
})
