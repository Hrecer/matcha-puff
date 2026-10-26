import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react'
import dayjs from 'dayjs'
import {
  Disc3,
  Headphones,
  Heart,
  ListMusic,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  SearchX,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import { applyScrollAnchor, readScrollAnchor, type ScrollAnchor } from '@/lib/scroll-anchor'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/focus/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlayingBars } from '@/components/ui/playing-bars'
import { SearchInput } from '@/components/ui/search-input'
import { SectionTitle } from '@/components/ui/section-title'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SlidingSegmented } from '@/components/ui/sliding'
import { toast } from '@/components/ui/toast'
import { inTauri, openDialog, readFileBase64 } from '@/ipc/bridge'
import {
  NOISE_CATEGORIES,
  type NoiseCategoryId,
  type NoiseTrack,
} from '@/data/noise-library'
import {
  addCustomNoise,
  allNoiseTracks,
  deleteNoiseCollection,
  findNoiseTrack,
  noiseTrackVolume,
  playNoiseCollection,
  removeCustomNoise,
  reorderNoiseCollections,
  resetNoiseVolumes,
  saveNoiseCollection,
  setMasterVolume,
  setNoiseVolume,
  stopAllNoise,
  stopNoise,
  toggleNoise,
  toggleNoiseFavorite,
  useNoiseStore,
} from '@/lib/noise-store'
import type { NoiseCollectionRecord } from '@/lib/noise-storage'

type NoiseTab = 'library' | 'collections' | 'custom'
type FilterId = 'all' | 'favorites' | NoiseCategoryId

const TABS: { value: NoiseTab; label: string }[] = [
  { value: 'library', label: '声音库' },
  { value: 'collections', label: '合集' },
  { value: 'custom', label: '自定义' },
]

const FILTERS: { value: FilterId; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'favorites', label: '喜欢' },
  { value: 'nature', label: '自然' },
  { value: 'daily', label: '日常' },
  { value: 'animal', label: '动物' },
  { value: 'weather', label: '天气' },
  { value: 'life', label: '生活' },
]

const TAB_STORAGE_KEY = 'matcha-puff/noise-tab'
const FILTER_STORAGE_KEY = 'matcha-puff/noise-filter'

/**
 * 视口位置记忆（只活在内存里，不落存储）：
 * 切页签、切到别的页面再回来都接着上次的位置，重启应用自然回到顶部。
 * 声音库/自定义滚的是外层内容容器；合集板块是 h-full，滚的是板块内部的列表，各记一份。
 * 声音库再按筛选项分开记。
 *
 * 记的是「锚点」而不是 scrollTop 像素值（见 lib/scroll-anchor.ts）：
 * 上面删掉一张卡片时，像素值不变会让画面整体串一位，而锚点会按卡片重新对齐。
 */
const noisePageScroll: Record<string, ScrollAnchor | null> = {}
let noiseBoardScroll: ScrollAnchor | null = null

/** 声音库按「页签 + 筛选项」分桶，其它页签只有一份 */
function noiseScrollKey(tab: NoiseTab, filter: FilterId): string {
  return tab === 'library' ? `library:${filter}` : tab
}

const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
}

function readStoredTab(): NoiseTab {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY)
    if (raw && TABS.some((item) => item.value === raw)) return raw as NoiseTab
  } catch {
    // 存储被禁时退回默认分区
  }
  return 'library'
}

function readStoredFilter(): FilterId {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY)
    if (raw && FILTERS.some((item) => item.value === raw)) return raw as FilterId
  } catch {
    // 存储被禁时退回「全部」
  }
  return 'all'
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mime })
}

function fileStem(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : 'mp3'
}

export function NoisePage() {
  const noise = useNoiseStore()
  const [tab, setTab] = useState<NoiseTab>(readStoredTab)
  const [filter, setFilter] = useState<FilterId>(readStoredFilter)
  const [query, setQuery] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const [deleteCollection, setDeleteCollection] = useState<NoiseCollectionRecord | null>(null)
  const [deleteCustom, setDeleteCustom] = useState<NoiseTrack | null>(null)
  const [pending, setPending] = useState<{ blob: Blob } | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  const [customCategory, setCustomCategory] = useState<NoiseCategoryId>('nature')
  const [customVolume, setCustomVolume] = useState(80)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** 三个页签共用的内容滚动容器：位置按「页签 + 筛选项」分别记忆 */
  const contentRef = useRef<HTMLDivElement>(null)
  /** 跳转定位（平滑滚动）进行中：期间跳过滚动校正，免得把动画拽回原位 */
  const jumpingRef = useRef(false)

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, tab)
    } catch {
      // 存不住不影响使用
    }
  }, [tab])

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, filter)
    } catch {
      // 存不住不影响使用
    }
  }, [filter])

  /** 换页签：各页签的滚动位置分开记（见下面的恢复 effect），这里只切状态 */
  const changeTab = (next: NoiseTab) => {
    if (next === tab) return
    setTab(next)
  }

  /** 滚到哪记到哪：记的是「屏幕最上方是哪张卡 + 被滚掉多少像素」（只记内存，重启即丢） */
  const onContentScroll = (event: React.UIEvent<HTMLDivElement>) => {
    noisePageScroll[noiseScrollKey(tab, filter)] = readScrollAnchor(
      event.currentTarget,
      'data-noise-track',
    )
  }

  /**
   * 挂着 / 换页签 / 换筛选项 / 从别的页面回来：按锚点把视口对回上次看到的卡片。
   * layout 阶段先对一次（避免先画在顶部再跳），下一帧再校正一次 ——
   * 长列表可能晚一帧才排版完，期间也可能被焦点、浏览器自动滚动改掉。
   */
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const anchor = noisePageScroll[noiseScrollKey(tab, filter)] ?? null
    applyScrollAnchor(el, 'data-noise-track', anchor)
    const raf = requestAnimationFrame(() => {
      // 跳转定位正在平滑滚动时不要校正，否则会把滚动拽回原位
      if (jumpingRef.current) return
      applyScrollAnchor(el, 'data-noise-track', anchor)
    })
    return () => cancelAnimationFrame(raf)
  }, [tab, filter])

  /**
   * 取消喜欢时的滚动处理（只有「喜欢」筛选项里需要考虑：那张卡会立刻消失）。
   *  - 卡片整张在视口上方：它消失会让下面所有内容上移，所以把 scrollTop 同步减掉
   *    它占的高度，画面保持不动；
   *  - 卡片在视口内 / 下方：滚动不动，下方内容上移就是「删掉一行」的正常观感；
   *  - 删空了：内容塌成空状态，浏览器自己回顶，记忆位置随之归零。
   */
  const toggleTrackFavorite = (trackId: string) => {
    const el = contentRef.current
    const card =
      el && tab === 'library' && filter === 'favorites'
        ? el.querySelector<HTMLElement>(`[data-noise-track="${trackId}"]`)
        : null
    const before = el?.scrollTop ?? 0
    let compensate = 0
    if (el && card && favorites.has(trackId)) {
      const top = card.getBoundingClientRect().top - el.getBoundingClientRect().top + before
      if (top + card.offsetHeight <= before) compensate = card.offsetHeight + 8
    }
    toggleNoiseFavorite(trackId)
    if (compensate > 0 && el) {
      requestAnimationFrame(() => {
        el.scrollTop = Math.max(0, before - compensate)
      })
    }
  }

  /* ---------------- 从合集跳到声音库里的某段声音（参照专注页的跳转） ---------------- */  /**
   * 跳转目标：带发起时刻，连点同一个标签也算新请求（和专注页 focus-jump 的做法一致）。
   * 1 秒后自动清空 —— 高亮环只闪一下，不常驻。
   */
  const [jumpTrack, setJumpTrack] = useState<{ id: string; at: number } | null>(null)

  /** 点合集里的声音标签：清掉筛选与搜索保证目标一定渲染，再切到声音库并记下要定位的那张卡 */
  const jumpToTrack = (trackId: string) => {
    jumpingRef.current = true
    setFilter('all')
    setQuery('')
    changeTab('library')
    setJumpTrack({ id: trackId, at: Date.now() })
  }

  useEffect(() => {
    if (!jumpTrack) return
    // 等一帧：清筛选 + 切页签之后列表才重排完，这时才算得出目标卡的位置
    const raf = requestAnimationFrame(() => {
      const card = contentRef.current?.querySelector<HTMLElement>(
        `[data-noise-track="${jumpTrack.id}"]`,
      )
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    // 闪烁 1 秒：与专注页任务 / 习惯跳转的高亮时长一致
    const timer = window.setTimeout(() => {
      jumpingRef.current = false
      setJumpTrack(null)
    }, 1000)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      jumpingRef.current = false
    }
  }, [jumpTrack])

  const tracks = allNoiseTracks()
  const customTracks = tracks.filter((track) => !track.builtin)
  const favorites = useMemo(() => new Set(noise.favorites), [noise.favorites])
  const keyword = query.trim().toLowerCase()

  const matchedTracks = useMemo(() => {
    const source = tab === 'custom' ? customTracks : tracks
    const filtered = source.filter((track) => {
      if (tab === 'library') {
        if (filter === 'favorites' && !favorites.has(track.id)) return false
        if (filter !== 'all' && filter !== 'favorites' && track.category !== filter) return false
      }
      if (keyword && !track.title.toLowerCase().includes(keyword)) return false
      return true
    })
    return filtered
  }, [tab, tracks, customTracks, filter, favorites, keyword])

  const groups = useMemo(
    () =>
      NOISE_CATEGORIES.map((category) => ({
        category,
        tracks: matchedTracks.filter((track) => track.category === category.id),
      })).filter((group) => group.tracks.length > 0),
    [matchedTracks],
  )

  const prepareCustom = (blob: Blob, name: string) => {
    setPending({ blob })
    setCustomTitle(fileStem(name))
    setCustomCategory('nature')
    setCustomVolume(80)
  }

  const pickFile = async () => {
    if (busy) return
    if (!inTauri()) {
      fileInputRef.current?.click()
      return
    }
    setBusy(true)
    try {
      const picked = await openDialog({
        title: '选择音频文件',
        filters: [{ name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
      })
      const path = Array.isArray(picked) ? picked[0] : picked
      if (!path) return
      const base64 = await readFileBase64(path)
      const name = path.split(/[\\/]/).pop() ?? '自定义声音'
      prepareCustom(base64ToBlob(base64, AUDIO_MIME[extensionOf(name)] ?? 'audio/mpeg'), name)
    } catch {
      toast('读取音频失败，请换一个文件试试', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) prepareCustom(file, file.name)
  }

  const confirmCustom = async () => {
    if (!pending || busy) return
    const title = customTitle.trim()
    if (!title) {
      toast('请先给这段声音起个名字', 'error')
      return
    }
    // 重名检查兜底：界面上按钮已经禁用，这里再挡一次，避免并发/键盘回车绕过
    if (noise.custom.some((item) => item.title.trim().toLowerCase() === title.toLowerCase())) {
      toast('已有同名的自定义声音，请换个名字', 'error')
      return
    }
    setBusy(true)
    const id = await addCustomNoise({
      title,
      category: customCategory,
      volume: customVolume,
      blob: pending.blob,
    })
    setBusy(false)
    if (!id) return
    setPending(null)
    changeTab('custom')
    toast('自定义声音已添加')
  }

  const confirmSaveCollection = () => {
    if (!saveNoiseCollection(collectionName)) return
    setSaveOpen(false)
    setCollectionName('')
    toast('合集已保存')
  }

  const openSave = () => {
    setCollectionName('')
    setSaveOpen(true)
  }

  /**
   * 导入时的重名检查：只和「自定义声音」比。
   * 内置声音不参与比较 —— 从内置音频导一份当自定义是正常用法。
   * 同一个文件导两次时默认名字相同，因此也会被这里拦住，必须改名才能继续。
   */
  const customTitleTrimmed = customTitle.trim()
  const customTitleTaken =
    customTitleTrimmed.length > 0 &&
    noise.custom.some(
      (item) => item.title.trim().toLowerCase() === customTitleTrimmed.toLowerCase(),
    )

  return (
    <div className="flex h-full min-h-0 gap-4 px-7 pb-6">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-4">
          <h1 className="truncate pr-[2px] text-[19px] font-bold tracking-tight text-foreground">
            白噪音
          </h1>
          <SlidingSegmented
            options={TABS}
            value={tab}
            onValueChange={changeTab}
            ariaLabel="白噪音分区"
            className="shrink-0"
          />
        </header>

        {tab === 'library' ? (
          // 横向内边距与下面内容滚动容器一致（px-1.5）：搜索框、筛选条、
          // 重置按钮的左右缘才能和声音卡片的左右缘对齐成一条线
          <div className="scroll-thin shrink-0 overflow-y-auto px-1.5 pt-2 [scrollbar-gutter:stable]">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <SearchInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="搜索声音…"
                  className="h-8 min-w-0 flex-1"
                />
                {query ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="清空搜索"
                    title="清空搜索"
                    onClick={() => setQuery('')}
                  >
                    <X className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <SlidingSegmented
                  options={FILTERS}
                  value={filter}
                  onValueChange={setFilter}
                  ariaLabel="声音分类"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="重置声音"
                  title="重置声音"
                  className="ml-auto shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* 自定义页的导入卡与搜索框常驻在滚动区之上：列表再长也滚不走它们。
            scrollbar-gutter 与下面的滚动容器保持一致，右边才不会错开一条 */}
        {tab === 'custom' ? (
          <div className="scroll-thin flex shrink-0 flex-col gap-2 overflow-y-auto px-1.5 pt-2 [scrollbar-gutter:stable]">
            <section className="glass flex items-center gap-3 rounded-panel border border-[var(--card-edge)] px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Upload className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">导入本地音频</p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                  支持 mp3 / wav / ogg / m4a，文件只保存在本机。
                </p>
              </div>
              <Button size="sm" className="shrink-0" disabled={busy} onClick={() => void pickFile()}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />}
                导入声音
              </Button>
            </section>

            <div className="flex items-center gap-1">
              <SearchInput
                value={query}
                onValueChange={setQuery}
                placeholder="搜索自定义声音…"
                className="h-9 min-w-0 flex-1"
              />
              {query ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="清空搜索"
                  title="清空搜索"
                  onClick={() => setQuery('')}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          ref={contentRef}
          onScroll={onContentScroll}
          // 左右各留 6px：跳转高亮是「边框外侧 2px 环 + 3px 外发光」，
          // 不留出这点余量就会被滚动容器的裁剪边切掉左边那半圈
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 [scrollbar-gutter:stable] scroll-thin"
        >
          {tab === 'library' ? (
            <LibraryTab
              filter={filter}
              onFilterChange={setFilter}
              query={query}
              groups={groups}
              favorites={favorites}
              jumpTrackId={jumpTrack?.id ?? null}
              onToggleFavorite={toggleTrackFavorite}
            />
          ) : null}

          {tab === 'collections' ? (
            <CollectionsTab
              collections={noise.collections}
              onPlay={(id) => {
                void playNoiseCollection(id)
                toast('已开始播放合集')
              }}
              onJumpTrack={jumpToTrack}
              onDelete={setDeleteCollection}
            />
          ) : null}

          {tab === 'custom' ? (
            <CustomTab
              tracks={matchedTracks}
              searching={query.trim().length > 0}
              onDelete={setDeleteCustom}
            />
          ) : null}
        </div>
      </div>

      <aside className="flex w-[clamp(240px,24vw,280px)] shrink-0 flex-col">
        <NowPlayingPanel onSave={openSave} />
      </aside>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onFilePicked}
      />

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">保存为合集</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] leading-5 text-muted-foreground">
            当前正在播放的 {noise.playing.length} 段声音会一起保存，下次可以一键铺开。
          </p>
          <Input
            autoFocus
            value={collectionName}
            placeholder="给这个合集起个名字"
            onChange={(event) => setCollectionName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') confirmSaveCollection()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              取消
            </Button>
            <Button disabled={!collectionName.trim()} onClick={confirmSaveCollection}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">添加自定义声音</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-muted-foreground">声音名称</Label>
              <Input
                autoFocus
                value={customTitle}
                placeholder="例如：窗外的雨"
                aria-invalid={customTitleTaken || undefined}
                onChange={(event) => setCustomTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !customTitleTaken) void confirmCustom()
                }}
              />
              {customTitleTaken ? (
                <p className="text-[11.5px] leading-4 text-destructive">
                  已有同名的自定义声音，换个名字才能导入。
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-muted-foreground">归入分类</Label>
              <Select
                value={customCategory}
                onValueChange={(value) => setCustomCategory(value as NoiseCategoryId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOISE_CATEGORIES.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-[12px] text-muted-foreground">
                默认音量
                <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
                  {customVolume}%
                </span>
              </Label>
              <input
                type="range"
                min={0}
                max={100}
                value={customVolume}
                onChange={(event) => setCustomVolume(Number(event.target.value))}
                className="noise-range w-full"
                style={{ '--noise-progress': `${customVolume}%` } as CSSProperties}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              取消
            </Button>
            <Button
              disabled={busy || !customTitleTrimmed || customTitleTaken}
              onClick={() => void confirmCustom()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={resetOpen}
        title="重置声音"
        description="每段声音回到各自的默认音量，总音量回到 100%。喜欢、合集和你导入的自定义声音都不受影响。"
        confirmText="重置"
        confirmVariant="default"
        onConfirm={resetNoiseVolumes}
        onOpenChange={setResetOpen}
      />

      <ConfirmDialog
        open={deleteCustom !== null}
        title="删除自定义声音"
        description={
          deleteCustom
            ? `${deleteCustom.title} 会从声音库和引用它的合集里移除，删除后无法恢复。`
            : ''
        }
        confirmText="删除"
        onConfirm={() => {
          const target = deleteCustom
          if (!target) return
          setDeleteCustom(null)
          void removeCustomNoise(target.id).then((result) => {
            // 空了就会被顺手删掉的合集要说清楚，别让用户以为合集自己消失了
            toast(
              result.removedCollections > 0
                ? `已删除自定义声音，同时清掉了 ${result.removedCollections} 个只剩它的合集`
                : '已删除自定义声音',
            )
          })
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteCustom(null)
        }}
      />

      <ConfirmDialog
        open={deleteCollection !== null}
        title="删除播放合集"
        description={
          deleteCollection
            ? `${deleteCollection.name} 删除后无法恢复，声音本身不会受到影响。`
            : ''
        }
        confirmText="删除"
        onConfirm={() => {
          const target = deleteCollection
          if (!target) return
          setDeleteCollection(null)
          deleteNoiseCollection(target.id)
          toast('合集已删除')
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteCollection(null)
        }}
      />
    </div>
  )
}

function LibraryTab({
  filter,
  onFilterChange,
  query,
  groups,
  favorites,
  jumpTrackId,
  onToggleFavorite,
}: {
  filter: FilterId
  onFilterChange: (value: FilterId) => void
  query: string
  groups: { category: (typeof NOISE_CATEGORIES)[number]; tracks: NoiseTrack[] }[]
  favorites: Set<string>
  /** 刚从合集跳过来的目标：那一段声音的卡片闪一下（1 秒后由上层清空） */
  jumpTrackId: string | null
  /** 喜欢/取消喜欢：由上层处理「取消后卡片消失」时的滚动补偿 */
  onToggleFavorite: (trackId: string) => void
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-3 pt-2">
      {groups.length === 0 ? (
        <Empty
          icon={filter === 'favorites' ? Heart : Headphones}
          title={filter === 'favorites' ? '还没有喜欢的声音' : '没有找到匹配的声音'}
          description={
            filter === 'favorites'
              ? '在声音行右侧点爱心，它就收进这里。'
              : '换个关键词，或者切回「全部」看看。'
          }
          className="flex-1 py-16"
          action={
            filter !== 'all' && !query ? (
              <Button size="sm" variant="outline" onClick={() => onFilterChange('all')}>
                查看全部声音
              </Button>
            ) : null
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.category.id} className="flex flex-col gap-2">
            <div className="flex shrink-0 items-center gap-2 px-1">
              <SectionTitle>{group.category.label}</SectionTitle>
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground/70">
                {group.category.hint}
              </span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground/70">
                {group.tracks.length} 段
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {group.tracks.map((track) => (
                <SoundCard
                  key={track.id}
                  track={track}
                  favorite={favorites.has(track.id)}
                  flash={jumpTrackId === track.id}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function SoundCard({
  track,
  favorite,
  flash = false,
  onToggleFavorite,
  onDelete,
}: {
  track: NoiseTrack
  favorite: boolean
  /** 从合集跳转过来时的定位高亮：闪 1 秒（与专注页任务/习惯跳转同一套样式） */
  flash?: boolean
  /** 喜欢/取消喜欢：声音库那侧要顺带处理「取消后卡片消失」的滚动补偿 */
  onToggleFavorite?: (trackId: string) => void
  onDelete?: () => void
}) {
  const noise = useNoiseStore()
  const playing = noise.playing.some((item) => item.track.id === track.id)
  const volume = noiseTrackVolume(track)
  const Icon = track.icon

  return (
    <div
      data-noise-track={track.id}
      className={cn(
        'group glass flex flex-col gap-1.5 rounded-panel border border-[var(--card-edge)] px-3.5 py-2 transition-shadow',
        flash && 'ring-2 ring-primary/60 shadow-[0_0_0_3px_rgba(49,83,42,0.18)]',
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors',
            playing
              ? 'bg-primary/15 text-primary'
              : 'bg-foreground/[0.05] text-muted-foreground group-hover:text-primary',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="truncate text-[14px] font-medium leading-5 text-foreground">
            {track.title}
          </p>
          {playing ? <PlayingBars className="h-3.5 shrink-0" /> : null}
          {track.builtin ? null : (
            <span className="shrink-0 rounded border border-border/50 px-1.5 py-px text-[10px] text-muted-foreground">
              自定义
            </span>
          )}
        </div>

        {onDelete ? (
          <button
            type="button"
            aria-label={`删除 ${track.title}`}
            title="删除"
            onClick={onDelete}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}

        <button
          type="button"
          aria-label={favorite ? '取消喜欢' : '喜欢'}
          title={favorite ? '取消喜欢' : '喜欢'}
          onClick={() => (onToggleFavorite ?? toggleNoiseFavorite)(track.id)}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
            favorite
              ? 'text-primary hover:bg-primary/10'
              : 'text-muted-foreground/80 hover:bg-foreground/10 hover:text-primary',
          )}
        >
          <Heart className={cn('size-3.5', favorite && 'fill-current')} />
        </button>

        <button
          type="button"
          aria-label={playing ? '停止播放' : '播放'}
          title={playing ? '停止播放' : '播放'}
          onClick={() => toggleNoise(track.id)}
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150',
            playing
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border border-border/70 text-muted-foreground hover:border-primary/50 hover:text-primary',
          )}
        >
          {playing ? <Square className="size-3" /> : <Play className="ml-0.5 size-3.5" />}
        </button>
      </div>

      <div className="flex items-center gap-2 pl-0.5">
        <Volume2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          aria-label={`${track.title}音量`}
          onChange={(event) => setNoiseVolume(track.id, Number(event.target.value))}
          className="noise-range min-w-0 flex-1"
          style={{ '--noise-progress': `${volume}%` } as CSSProperties}
        />
        <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
          {volume}%
        </span>
      </div>
    </div>
  )
}

function NowPlayingPanel({ onSave }: { onSave: () => void }) {
  const noise = useNoiseStore()
  const count = noise.playing.length

  return (
    <section className="card-solid flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/40 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <Headphones className="size-4 text-primary" aria-hidden />
            正在播放
          </p>
          {count > 0 ? (
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              {count} 段声音
            </p>
          ) : null}
        </div>
        {count > 0 ? (
          <Button variant="ghost" size="xs" className="shrink-0" onClick={stopAllNoise}>
            <Square />
            全部停止
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-3 py-3">
        {count === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Empty size="sm" icon={Headphones} title="还没有声音在播放" className="py-0" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {noise.playing.map((item) => {
              const Icon = item.track.icon
              const volume = noiseTrackVolume(item.track)
              return (
                <div
                  key={item.track.id}
                  className="rounded-lg border border-[var(--card-edge)] bg-[var(--card-surface)] px-2.5 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Icon className="size-3" aria-hidden />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
                      {item.track.title}
                    </p>
                    <button
                      type="button"
                      aria-label={`停止 ${item.track.title}`}
                      title="停止"
                      onClick={() => stopNoise(item.track.id)}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 pl-8">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      aria-label={`${item.track.title}音量`}
                      onChange={(event) =>
                        setNoiseVolume(item.track.id, Number(event.target.value))
                      }
                      className="noise-range min-w-0 flex-1"
                      style={{ '--noise-progress': `${volume}%` } as CSSProperties}
                    />
                    <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {volume}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Volume2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="shrink-0 text-[11px] text-muted-foreground">总音量</span>
          <input
            type="range"
            min={0}
            max={100}
            value={noise.master}
            aria-label="总音量"
            onChange={(event) => setMasterVolume(Number(event.target.value))}
            className="noise-range min-w-0 flex-1"
            style={{ '--noise-progress': `${noise.master}%` } as CSSProperties}
          />
          <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {noise.master}%
          </span>
        </div>
        <Button size="sm" className="mt-3 w-full" disabled={count === 0} onClick={onSave}>
          <Plus />
          保存当前声音为合集
        </Button>
      </footer>
    </section>
  )
}

function CollectionsTab({
  collections,
  onPlay,
  onJumpTrack,
  onDelete,
}: {
  collections: NoiseCollectionRecord[]
  onPlay: (id: string) => void
  /** 点声音标签跳到声音库里的那一段 */
  onJumpTrack: (trackId: string) => void
  onDelete: (record: NoiseCollectionRecord) => void
}) {
  const ids = useMemo(() => collections.map((item) => item.id), [collections])
  const byId = useMemo(() => new Map(collections.map((item) => [item.id, item])), [collections])

  /* ---------------- 拖拽排序（做法与专注页的习惯列表一致） ---------------- */

  const [dragId, setDragId] = useState<string | null>(null)
  /** 拖动中的预览顺序：每跨过一格就真的把数组挪一下，其它卡片因此会「让位」 */
  const [preview, setPreview] = useState<string[] | null>(null)
  const previewRef = useRef<string[] | null>(null)
  previewRef.current = preview
  const dragIdRef = useRef<string | null>(null)
  dragIdRef.current = dragId

  const order = preview ?? ids
  const activeRecord = dragId ? (byId.get(dragId) ?? null) : null

  /**
   * 搜索＝筛选合集。
   * 筛选中整列禁止拖动：拖的只是筛后子集，落库会把完整顺序写乱（专注页习惯列表同理）。
   */
  const [keyword, setKeyword] = useState('')
  const kw = keyword.trim().toLowerCase()
  const filterActive = kw.length > 0
  const filterActiveRef = useRef(false)
  filterActiveRef.current = filterActive

  const visibleIds = useMemo(() => {
    if (!kw) return order
    return order.filter((id) => {
      const record = byId.get(id)
      return record ? record.name.toLowerCase().includes(kw) : false
    })
  }, [order, byId, kw])

  const listRef = useRef<HTMLDivElement>(null)
  /** 拖拽板块：拖出这块抹茶底就取消，判定与提示都挂在它身上 */
  const boardRef = useRef<HTMLDivElement>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  /** 被拖卡片原来的高度：它 display:none 后由外层壳占住这块空间，列表不会塌一格 */
  const [dragH, setDragH] = useState(0)

  /** 每张卡片的上一次顶部坐标：顺序一变就靠它算位移、做让位动画（FLIP） */
  const lastTopsRef = useRef<Map<string, number>>(new Map())
  const orderSigRef = useRef('')

  /** 帧内要用的值都放这里，回调才能保持稳定引用 */
  const metricsRef = useRef({ ids, order })
  metricsRef.current = { ids, order }

  /**
   * 滚轮滚动的时间戳与「滚停」定时器。
   * 滚轮滚动期间冻结落点：不然每滚过一格就重排一次，空隙会连续开合，非常晃眼。
   * 滚停 140ms 后再统一算一次落点，只让空隙动一下。
   */
  const lastWheelRef = useRef(0)
  const wheelSettleRef = useRef(0)

  /**
   * 拖拽状态全放 ref：指针每动一次都不进 React，只有「跨过一格」才 setState 重排。
   * 高频移动期间零 React 工作 —— 每帧只写一次浮层的 transform。
   */
  const dragRef = useRef<{
    id: string
    pointerId: number
    x: number
    y: number
    /** 落点中心的「内容坐标」：随指针位移与列表滚动一起推进 */
    contentY: number
    /** 上一次指针的 clientY：把位移累加进 contentY 用 */
    lastY: number
    /** 上一次列表的 scrollTop：算滚动增量用（滚轮与贴边滚动都走这里） */
    lastScrollTop: number
    grabX: number
    grabY: number
    w: number
    h: number
    slot: number
    raf: number
  } | null>(null)

  // 落库后 ids 会变成新顺序；等它追上预览顺序再丢掉预览，中间就不会闪回旧顺序
  useEffect(() => {
    if (!preview) return
    if (preview.length === ids.length && preview.every((id, index) => id === ids[index])) {
      setPreview(null)
    }
  }, [ids, preview])

  /**
   * 顺序变化的让位动画（FLIP）：
   * 提交前记住每张卡的旧位置，提交后量新位置，先把卡片反向挪回旧位置，
   * 下一帧再放开过渡移到位 —— 视觉上就是「其它卡给被拖的这张让路」。
   * 被拖的那张退为 invisible 占位，不参与动画，空间留着，下面的卡不会跳。
   */
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-collection-card]'))
    const sig = order.join('|')
    const oldTops = lastTopsRef.current
    const changed = sig !== orderSigRef.current
    orderSigRef.current = sig

    const newTops = new Map<string, number>()
    // 量的是「内容坐标」＝视口坐标 + 当前滚动量：
    //  - 只用 rect.top，拖动中贴边滚动会让新旧位置差出一整个滚动量，让位会歪；
    //  - 只用 offsetTop，卡片身上还没跑完的让位过渡（transform）就不被算进去，
    //    上一段动画没落地就被当成新起点，画面会跳（上一版就是这里改坏的）。
    const scrollTop = list.scrollTop
    for (const el of cards) {
      newTops.set(el.dataset.collectionCard!, el.getBoundingClientRect().top + scrollTop)
    }

    if (changed && dragIdRef.current !== null && oldTops.size > 0) {
      for (const el of cards) {
        const id = el.dataset.collectionCard!
        if (id === dragIdRef.current) continue
        const oldTop = oldTops.get(id)
        if (oldTop === undefined) continue
        const delta = oldTop - newTops.get(id)!
        if (delta === 0) continue
        el.style.transition = 'none'
        el.style.transform = `translateY(${delta}px)`
      }
      requestAnimationFrame(() => {
        for (const el of cards) {
          el.style.transition = 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'
          el.style.transform = ''
        }
      })
    }
    lastTopsRef.current = newTops
  })

  const placeFloat = useCallback(() => {
    const st = dragRef.current
    const float = floatRef.current
    if (!st || !float) return
    float.style.width = `${st.w}px`
    float.style.transform = `translate3d(${st.x - st.grabX}px, ${st.y - st.grabY}px, 0)`
  }, [])

  // 浮层刚出现时先摆回卡片原来的位置，避免闪一下左上角
  useLayoutEffect(() => {
    if (dragId) placeFloat()
  }, [dragId, placeFloat])

  /**
   * 按落点的文档坐标算出该落在第几格。
   * tick 与「松手」两处共用，避免两边算法漂移（滚轮刚停就松手时会用到）。
   * 返回的 cards 已排除被拖的那张，它的下标就是插入位置。
   */
  const measureTarget = useCallback((st: NonNullable<typeof dragRef.current>) => {
    const list = listRef.current
    if (!list) return { target: st.slot, cards: [] as HTMLElement[], scrollTop: 0 }
    const scrollTop = list.scrollTop
    const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-collection-card]')).filter(
      (el) => el.dataset.collectionCard !== st.id,
    )
    let target = 0
    for (const el of cards) {
      const rect = el.getBoundingClientRect()
      if (st.contentY > rect.top + scrollTop + rect.height / 2) target += 1
    }
    target = Math.min(metricsRef.current.ids.length - 1, Math.max(0, target))
    return { target, cards, scrollTop }
  }, [])

  /** 每帧只做三件事：挪浮层、贴边滚动、判断有没有跨格 —— 都不触发 React 渲染 */
  const tick = useCallback(() => {
    const st = dragRef.current
    if (!st) return
    st.raf = 0
    placeFloat()

    // 滚轮滚动期间只挪浮层，不重排：否则滚轮每滚过一格就开合一次空隙，很晃
    if (performance.now() - lastWheelRef.current < 140) return

    const board = boardRef.current
    if (board) {
      const rect = board.getBoundingClientRect()
      const inside =
        st.x >= rect.left && st.x <= rect.right && st.y >= rect.top && st.y <= rect.bottom
      // 指针在板块外：这一帧不重排，但也**不重置顺序**。
      // 以前的版本在这里把预览顺序清回原样，结果拖到底部边缘（贴边滚动的地方）
      // 指针一擦过边界，空位就瞬移回列表顶部，再拖回来又跳回去 —— 日志里那几次
      // 「0 → 16 / 0 → 19」的瞬移就是这么来的。取消只认松手那一刻的落点。
      if (!inside) return
      // 贴边滚动：滚的是卡片列表本身（它是板块里唯一的滚动容器）。
      // 滚了多少，落点也跟着前进多少 —— 这样停在上下边缘就能把卡片拖到很远的位置。
      // 用 scrollTop 的实际差值累加，滚到头（被夹住）时落点不会继续漂。
      const scroller = listRef.current
      if (scroller) {
        const edge = 56
        const sr = scroller.getBoundingClientRect()
        const before = scroller.scrollTop
        if (st.y < sr.top + edge) scroller.scrollBy({ top: -12 })
        else if (st.y > sr.bottom - edge) scroller.scrollBy({ top: 12 })
        const delta = scroller.scrollTop - before
        if (delta !== 0) {
          st.contentY += delta
          // 同步一下基准，避免随后的 scroll 事件把同一段滚动再加一次
          st.lastScrollTop = scroller.scrollTop
        }
      }
    }

    const list = listRef.current
    if (!list) return
    /**
     * 落点判断一律用「内容坐标」（文档位置），不用视口坐标：
     * contentY 由指针位移与滚动一起推进，卡片中线也换算成内容坐标，
     * 两边同一套坐标系，指针抖一下不会把落点甩到别处。
     */
    const centerY = st.contentY
    const { target, cards, scrollTop } = measureTarget(st)
    // 没跨格就到此为止：这一帧不会有任何 React 工作
    if (target === st.slot) return
    // 抖动死区：光跨过中线还不够，要再往里走 6px 才真的换位，避免在交界处来回重排
    const edge = target > st.slot ? cards[target - 1] : cards[target]
    if (edge) {
      const rect = edge.getBoundingClientRect()
      const mid = rect.top + scrollTop + rect.height / 2
      if (target > st.slot ? centerY < mid + 6 : centerY > mid - 6) return
    }
    st.slot = target

    setPreview((prev) => {
      const src = prev ?? metricsRef.current.ids
      const from = src.indexOf(st.id)
      if (from < 0 || from === target) return prev
      const next = [...src]
      const [moved] = next.splice(from, 1)
      next.splice(target, 0, moved!)
      // 记到 ref 上：松手那一刻要按最新的预览顺序落库，不等下一帧渲染
      previewRef.current = next
      return next
    })
  }, [placeFloat, measureTarget])

  /**
   * 整张卡片都能起拖（按钮除外）。
   * 按下时先只记一笔，移动超过 4px 才真正「拿起来」—— 否则单击卡片也会闪一下浮层。
   */
  const pendingRef = useRef<{
    id: string
    pointerId: number
    startX: number
    startY: number
    x: number
    y: number
    grabX: number
    grabY: number
    w: number
    h: number
    slot: number
  } | null>(null)

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, record: NoiseCollectionRecord) => {
      // 筛选状态下不许拖：拖动的只是筛后子集，落库会把完整顺序搅乱
      if (event.button !== 0 || filterActiveRef.current) return
      // 按钮（删除/播放/标签）自己处理点击；声音清单的滚动区也不能起拖，
      // 否则想拖滚动条 / 在里面滚一下就把整张卡「拿起来」了
      if (
        (event.target as HTMLElement).closest(
          'button, a, input, select, textarea, [data-drag-ignore]',
        )
      )
        return
      const card = event.currentTarget
      const list = listRef.current
      if (!card || !list) return
      event.preventDefault()
      const rect = card.getBoundingClientRect()
      pendingRef.current = {
        id: record.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        grabX: event.clientX - rect.left,
        grabY: event.clientY - rect.top,
        w: rect.width,
        h: rect.height,
        slot: metricsRef.current.order.indexOf(record.id),
      }
      // 捕获挂在列表容器上：它整场都在，卡片被让位动画挪走也不影响后续事件
      list.setPointerCapture(event.pointerId)
    },
    [],
  )

  const moveDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const st = dragRef.current
      if (st) {
        if (event.pointerId !== st.pointerId) return
        // 落点只跟着指针位移推进：滚轮把内容挪开不算拖动，所以这里累加的是指针的位移量
        st.contentY += event.clientY - st.lastY
        st.lastY = event.clientY
        st.x = event.clientX
        st.y = event.clientY
        if (!st.raf) st.raf = requestAnimationFrame(tick)
        return
      }
      // 还没进入拖拽：移动够远了才「拿起来」
      const pending = pendingRef.current
      if (!pending || event.pointerId !== pending.pointerId) return
      if (Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY) < 4) return
      pendingRef.current = null
      const list = listRef.current
      dragRef.current = {
        ...pending,
        x: event.clientX,
        y: event.clientY,
        // 落点的初始值＝卡片中心的文档坐标（视口位置 + 当前滚动量）
        contentY:
          pending.y - pending.grabY + (list?.scrollTop ?? 0) + pending.h / 2,
        lastY: event.clientY,
        lastScrollTop: list?.scrollTop ?? 0,
        raf: 0,
      }
      // 先记下原高度：卡片本体等下要 display:none，空格由外层壳按这个高度占住
      setDragH(pending.h)
      setDragId(pending.id)
      setPreview(metricsRef.current.ids)
    },
    [tick],
  )

  const finishDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // 按下后没拖动就松手了：一次普通点击，顺序不动
    const pending = pendingRef.current
    if (pending && event.pointerId === pending.pointerId) {
      pendingRef.current = null
      const list = listRef.current
      if (list?.hasPointerCapture(event.pointerId)) {
        list.releasePointerCapture(event.pointerId)
      }
      return
    }
    const st = dragRef.current
    if (!st || event.pointerId !== st.pointerId) return
    dragRef.current = null
    if (st.raf) cancelAnimationFrame(st.raf)
    const list = listRef.current
    if (list?.hasPointerCapture(event.pointerId)) {
      list.releasePointerCapture(event.pointerId)
    }
    setDragId(null)

    // 最终落点在板块外＝取消这次移动，不落库
    const rect = boardRef.current?.getBoundingClientRect()
    if (
      !rect ||
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      setPreview(null)
      return
    }

    /**
     * 松手落点左右两件事要对上：
     *  - 平时直接用预览顺序（拖动中每跨一格就更新过）；
     *  - 但滚轮刚停下就松手时，预览是冻结的（滚动期间不重排），
     *    这时按当前内容坐标补算一次，卡片才会落在浮层下面而不是滚之前的位置。
     */
    let next = previewRef.current
    if (performance.now() - lastWheelRef.current < 200) {
      const order = next ?? metricsRef.current.ids
      const at = order.indexOf(st.id)
      const { target } = measureTarget(st)
      if (at >= 0 && target !== at) {
        next = [...order]
        const [moved] = next.splice(at, 1)
        next.splice(target, 0, moved!)
      }
    }
    if (!next) return
    const from = metricsRef.current.ids.indexOf(st.id)
    const to = next.indexOf(st.id)
    // 顺序没变就清掉预览；变了就保留，等库里的数据追上（上面那个 effect 负责清）
    if (from < 0 || to < 0 || from === to) {
      setPreview(null)
      return
    }
    void reorderNoiseCollections(next)
  }, [measureTarget])

  const cancelDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pendingRef.current = null
    const st = dragRef.current
    if (!st || event.pointerId !== st.pointerId) return
    dragRef.current = null
    if (st.raf) cancelAnimationFrame(st.raf)
    const list = listRef.current
    if (list?.hasPointerCapture(event.pointerId)) {
      list.releasePointerCapture(event.pointerId)
    }
    setDragId(null)
    setPreview(null)
  }, [])

  /** 键盘排序：方向键挪一格，省得只能靠鼠标（筛选状态下同样禁用） */
  const moveCollection = useCallback(
    (record: NoiseCollectionRecord, delta: number) => {
      if (filterActiveRef.current) return
      const from = ids.indexOf(record.id)
      if (from < 0) return
      const to = Math.min(ids.length - 1, Math.max(0, from + delta))
      if (from === to) return
      const next = [...ids]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      void reorderNoiseCollections(next)
    },
    [ids],
  )

  // 板块内部的列表：按锚点恢复位置（合集被删掉时退回同序号的卡片），
  // 下一帧再对一次，避免这一帧列表还没排完版
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const anchor = noiseBoardScroll
    applyScrollAnchor(el, 'data-collection-card', anchor)
    const raf = requestAnimationFrame(() => {
      applyScrollAnchor(el, 'data-collection-card', anchor)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  /**
   * 拖动中的滚轮统一由列表接管：
   *  - 卡片里的标签带自己是滚动容器（还带 overscroll-contain），滚轮落在它上面时
   *    既不滚列表也不向上传递，拖动中会滚得时断时续，所以这里统一引导到列表；
   *  - 滚动期间落点冻结（不重排），滚停 140ms 后只收拢一次，
   *    免得每滚过一格就开合一次空隙、看着发晕。
   */
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if (!dragRef.current) return
      event.preventDefault()
      // deltaMode=1 时单位是行，换算成像素
      const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      el.scrollBy({ top: step })
      lastWheelRef.current = performance.now()
      // 滚停之后再统一算一次落点（期间 tick 会直接返回，不产生重排）
      window.clearTimeout(wheelSettleRef.current)
      wheelSettleRef.current = window.setTimeout(() => {
        if (!dragRef.current) return
        dragRef.current.raf = requestAnimationFrame(tick)
      }, 140)
    }
    // React 的 onWheel 是 passive 的，preventDefault 不生效，只能挂原生监听
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.clearTimeout(wheelSettleRef.current)
    }
  }, [collections.length > 0, tick])

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-3 pt-2">
      {/* 搜索＝筛选：输入即时过滤合集名；有筛选时整列禁止拖动 */}
      <div className="flex shrink-0 items-center gap-1 px-1">
        <SearchInput
          value={keyword}
          onValueChange={setKeyword}
          placeholder="搜索合集…"
          className="h-8 min-w-0 flex-1"
        />
        {keyword ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="清空搜索"
            title="清空搜索"
            onClick={() => setKeyword('')}
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        ) : null}
        <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
          {filterActive ? `找到 ${visibleIds.length} 个合集` : `共 ${collections.length} 个合集`}
        </span>
      </div>

      {collections.length === 0 ? (
        <Empty
          icon={ListMusic}
          title="还没有播放合集"
          description="常一起听的声音，值得留一个位置。"
          className="flex-1 py-16"
        />
      ) : (
        /* 拖拽板块：实色抹茶底，与专注页的习惯板块同一张卡。拖出这块＝取消本次排序 */
        <div
          ref={boardRef}
          className="card-solid flex min-h-0 flex-1 flex-col overflow-hidden p-2.5"
        >
          <div
            ref={listRef}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={cancelDrag}
            onScroll={(event) => {
              const el = event.currentTarget
              noiseBoardScroll = readScrollAnchor(el, 'data-collection-card')
              const st = dragRef.current
              if (!st) return
              // 拖动中滚动：落点跟着内容一起走，空位才会始终待在浮层下面；
              // 滚动增量按帧合并成一次重排，不会出现「滚一下跳好几格」
              const delta = el.scrollTop - st.lastScrollTop
              if (delta === 0) return
              st.lastScrollTop = el.scrollTop
              st.contentY += delta
              // 滚轮滚动期间不立刻重排：等滚停由 settle 定时器统一算一次；
              // 贴边自动滚动这种程序滚动不受影响，照常推进落点
              if (performance.now() - lastWheelRef.current > 140 && !st.raf) {
                st.raf = requestAnimationFrame(tick)
              }
            }}
            // 上下各留 4px：第一张卡片不紧贴裁剪边界，描边不会被切掉半像素。
            // [overflow-anchor:none]：拖动中重排时浏览器会把「被拖走的空位」
            // 当成内容高度变化去补偿 scrollTop，画面会整个跳一格，这里必须禁掉。
            className="flex min-h-0 flex-1 select-none flex-col gap-2 overflow-x-hidden overflow-y-auto px-0.5 py-1 scroll-thin [overflow-anchor:none]"
          >
            {filterActive && visibleIds.length === 0 ? (
              <Empty
                size="sm"
                icon={ListMusic}
                title="没有匹配的合集"
                description="换个关键词试试，或者清空搜索。"
                className="flex-1 py-16"
              />
            ) : null}
            {visibleIds.map((id) => {
              const record = byId.get(id)
              if (!record) return null
              const isDragging = id === dragId
              return (
                <div
                  key={id}
                  // shrink-0 不能省：这是 flex 列，列表一溢出（合集多的时候），
                  // 默认 flex-shrink:1 会把「占位壳」压扁 → 拖动时槽位瞬间消失、
                  // 下面卡片集体上移，看起来就是「一拿起来就乱跳」。
                  // 其它卡片内部有内容、min-height 拦着不会缩，所以问题只在被拖的那张上。
                  className="shrink-0"
                  // 被拖的卡片 display:none 之后，由这层壳按原高度占位。
                  // 不能用 invisible —— 卡里按钮带 transition-all，visibility 会跟着过渡，
                  // 卡片消失后「播放合集」还会在底色上残留一瞬（专注页踩过的坑）。
                  style={isDragging ? { height: dragH } : undefined}
                >
                  <CollectionCard
                    record={record}
                    dragging={isDragging}
                    draggable={!filterActive}
                    onCardDown={beginDrag}
                    onPlay={() => onPlay(id)}
                    onJumpTrack={onJumpTrack}
                    onDelete={() => onDelete(record)}
                    onMove={moveCollection}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 跟手的那张卡：fixed 定位，位置由桌面的 rAF 直接写 transform，不经过 React */}
      {activeRecord ? (
        <div
          ref={floatRef}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-30"
        >
          <CollectionCard
            record={activeRecord}
            presentational
            onPlay={() => onPlay(activeRecord.id)}
            onDelete={() => onDelete(activeRecord)}
          />        </div>
      ) : null}
    </div>
  )
}

function CollectionCard({
  record,
  dragging = false,
  presentational = false,
  draggable = true,
  onCardDown,
  onPlay,
  onJumpTrack,
  onDelete,
  onMove,
}: {
  record: NoiseCollectionRecord
  /** 正在被拖：本体退为不可见占位（空间留着），跟手的是浮层那张 */
  dragging?: boolean
  /** 浮层用的副本：长得一样，但不接任何手势 */
  presentational?: boolean
  /** 搜索筛选中禁止拖动：卡片不再接起拖手势，光标也回到普通箭头 */
  draggable?: boolean
  /** 整卡起拖：落在按钮上的按下会被拦掉，留给按钮自己的点击 */
  onCardDown?: (event: React.PointerEvent<HTMLElement>, record: NoiseCollectionRecord) => void
  onPlay: () => void
  /** 点声音标签跳到声音库里的那一段 */
  onJumpTrack?: (trackId: string) => void
  onDelete: () => void
  onMove?: (record: NoiseCollectionRecord, delta: number) => void
}) {
  const items = record.trackIds
    .map((id) => findNoiseTrack(id))
    .filter((track): track is NoiseTrack => Boolean(track))
  // 声音清单不再限量：这块自己有滚动，全部平铺即可
  // 浮层副本不接手势；搜索筛选中也不接（筛选状态下不许拖）
  const canDrag = draggable && !presentational

  return (
    <article
      data-collection-card={record.id}
      // 整卡可拖：落在按钮上的按下会由 beginDrag 拦掉，留给按钮自己的点击
      onPointerDown={canDrag ? (event) => onCardDown?.(event, record) : undefined}
      tabIndex={canDrag ? 0 : undefined}
      aria-label={canDrag ? `${record.name}，可拖动排序` : record.name}
      onKeyDown={
        canDrag
          ? (event) => {
              const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
              if (!delta) return
              event.preventDefault()
              onMove?.(record, delta)
            }
          : undefined
      }
      className={cn(
        // 实色卡面（与专注页的习惯卡片同一支抹茶）：整屏多张卡片不再各自背一层
        // backdrop-filter 玻璃，WebView 不用每帧重算模糊
        'flex flex-col gap-2 rounded-panel border border-[var(--card-edge)] bg-[var(--card-surface)] px-3.5 py-2.5 shadow-sm outline-none transition-shadow',
        presentational
          ? // 浮层那张多一层投影，强化「被拿起来」的手感
            'shadow-e3'
          : canDrag
            ? 'cursor-grab touch-none active:cursor-grabbing focus-visible:ring-[3px] focus-visible:ring-ring/40'
            : // 筛选时不能拖：普通箭头光标，也不需要 touch-none 占掉触摸滚动
              'cursor-default',
        // 被拖的这张原地隐藏：跟手的是浮层里的同一张卡。
        // 必须 display:none —— 卡片里的按钮带 transition-all，visibility 会跟着过渡，
        // 卡片本体消失后「播放合集」还会在底色上残留一瞬（专注页踩过的坑）。
        dragging && 'hidden',
      )}
    >
      {/* 第一行：名称/元信息 + 动作。整张卡片就是拖拽面，不再放图标和把手占位置 */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium leading-5 text-foreground">
            {record.name}
          </h3>
          <p className="truncate text-[10.5px] leading-4 text-muted-foreground">
            {items.length} 段声音 · {dayjs(record.createdAt).format('M月D日')}
          </p>
        </div>

        <button
          type="button"
          aria-label={`删除 ${record.name}`}
          title="删除合集"
          onClick={onDelete}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <Trash2 className="size-3.5" />
        </button>

        <Button
          size="sm"
          className="shrink-0 cursor-pointer"
          disabled={items.length === 0}
          onClick={onPlay}
        >
          <Play className="size-3.5" aria-hidden />
          播放合集
        </Button>
      </div>

      {/* 声音清单：至少完整容下两行（标签 22px = 16 行高 + 4 内边距 + 2 描边，
          两行加 6px 行距是 50px，再留 2px 余量），所以两行不会出滚动条；
          三行起才在这块内部滚动。每张卡片高度因此完全一致。
          data-drag-ignore：这一块要能滚轮/拖滚动条，不能当成整卡拖拽的起手区 */}
      <div
        data-drag-ignore
        className="flex h-[52px] shrink-0 flex-wrap content-start items-start gap-1.5 overflow-y-auto overscroll-contain scroll-thin"
      >
        {items.map((track) => (
          <button
            key={track.id}
            type="button"
            title={`跳到声音库里的 ${track.title}`}
            onClick={() => onJumpTrack?.(track.id)}
            className="max-w-[180px] cursor-pointer truncate rounded-full border border-border/55 bg-background/50 px-2 py-0.5 text-[10.5px] leading-4 text-muted-foreground outline-none transition-colors hover:border-primary/45 hover:bg-primary/10 hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {track.title}
          </button>
        ))}
      </div>
    </article>
  )
}

function CustomTab({
  tracks,
  searching,
  onDelete,
}: {
  tracks: NoiseTrack[]
  /** 搜索中：列表为空时用「没匹配」而不是「还没有自定义声音」 */
  searching: boolean
  onDelete: (track: NoiseTrack) => void
}) {
  const favorites = useNoiseStore().favorites

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-2 pt-2">
      {tracks.length === 0 ? (
        <Empty
          icon={searching ? SearchX : Disc3}
          title={searching ? '没有匹配的自定义声音' : '还没有自定义声音'}
          description={
            searching
              ? '换个关键词试试，或者清空搜索。'
              : '导入自己的雨声、风扇声或现场录音，和内置声音一起混放。'
          }
          className="flex-1 py-16"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {tracks.map((track) => (
            <SoundCard
              key={track.id}
              track={track}
              favorite={favorites.includes(track.id)}
              onDelete={() => onDelete(track)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
