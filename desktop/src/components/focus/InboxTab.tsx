import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, CircleDot, Clock, Inbox, Trash2, X } from 'lucide-react'
import type { InboxRecord } from '@matcha-puff/pomodoro-core'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { SearchInput } from '@/components/ui/search-input'
import { Tip } from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/focus/ConfirmDialog'
import { toDateInput } from '@/components/ui/date-field'
import { highlightTerms, matchesText, matchTerms } from '@/lib/highlight'
import {
  clearInbox,
  loadFocusData,
  removeInboxRecord,
  useFocusData,
} from '@/lib/focus-data'

/**
 * 收件箱同样是虚拟滚动：记录只有几百字节，但一百条以上时整棵渲染会明显卡顿。
 *
 * 卡片高度是固定的（简介 truncate 单行、标题 truncate 单行），所以能照任务列表那套
 * 按索引算区间，不需要量 DOM：
 * - 卡片 66px = 上下内边距 14×2 + 第一行 20 + 行距 2 + 第二行 16
 * - 每条再多 12px 卡片间距（ROW_HEIGHT 78）
 */
const CARD_HEIGHT = 66
const ROW_HEIGHT = CARD_HEIGHT + 12
const OVERSCAN = 4

export function InboxTab() {
  const { inbox, ready } = useFocusData()
  const [confirm, setConfirm] = useState<{
    title: string
    description: string
    action: () => void
  } | null>(null)

  useEffect(() => {
    void loadFocusData()
  }, [])

  const total = useMemo(() => inbox.reduce((sum, item) => sum + (item.count || 0), 0), [inbox])

  /**
   * 搜索：收件箱是**平铺列表**，不用像任务树那样补祖链，直接筛就行。
   * 口径和任务页完全一致（空格分词、全部命中、标题+简介），实现复用 lib/highlight。
   */
  const [query, setQuery] = useState('')
  const terms = useMemo(() => matchTerms(query), [query])
  const filtering = terms.length > 0
  const records = useMemo(
    () =>
      filtering
        ? inbox.filter((record) => matchesText(`${record.title}\n${record.desc}`, terms))
        : inbox,
    [inbox, filtering, terms],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(480)
  const hasRecords = records.length > 0
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const sync = () => setViewportH(el.clientHeight)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasRecords])

  // 删除记录或搜索后内容变短，把旧的滚动位置夹回去，避免渲染窗口落到列表之外
  const maxTop = Math.max(0, records.length * ROW_HEIGHT - 12 - viewportH)
  const topOffset = Math.min(scrollTop, maxTop)
  const visibleStart = Math.max(0, Math.floor(topOffset / ROW_HEIGHT) - OVERSCAN)
  const visibleEnd = Math.min(records.length, Math.ceil((topOffset + viewportH) / ROW_HEIGHT) + OVERSCAN)

  if (!ready) {
    return <p className="mx-auto w-full max-w-4xl px-1 pt-4 text-xs text-muted-foreground">正在读取收件箱…</p>
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 pt-2">
      {inbox.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2 px-1 text-[11.5px] text-muted-foreground">
          {/* 搜索时数字换成「命中 X / 共 N」，和任务页同一个说法 */}
          <span className="shrink-0">
            {filtering
              ? `命中 ${records.length} / ${inbox.length} 个已完成任务`
              : `${inbox.length} 个已完成任务 · 共 ${total} 个番茄`}
          </span>
          <div className="ml-auto flex min-w-0 max-w-[300px] flex-1 items-center justify-end gap-1">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="搜索标题或简介…"
              className="h-8"
            />
            {filtering ? (
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
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() =>
              setConfirm({
                title: '清空收件箱',
                description: '收件箱内的全部完成记录将被永久删除，无法恢复。',
                action: () => void clearInbox(),
              })
            }
          >
            <Trash2 className="size-3.5" aria-hidden />
            清空
          </Button>
        </div>
      ) : null}

      {/* 始终有一张实色卡片：空状态也在这张卡里居中，不是直接浮在背景上 */}
      <section className="card-solid flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {inbox.length === 0 ? (
          <Empty
            icon={Inbox}
            title="收件箱是空的"
            description="在任务卡片上点「归档」，即可把已完成的任务收进这里。"
            size="sm"
            className="flex-1 py-16"
          />
        ) : records.length === 0 ? (
          <Empty
            icon={Inbox}
            title="没有匹配的记录"
            description="换个关键字试试，或清空搜索看全部记录。"
            size="sm"
            className="flex-1 py-16"
            action={
              <Button size="sm" variant="outline" onClick={() => setQuery('')}>
                清空搜索
              </Button>
            }
          />
        ) : (
          <div
            ref={scrollRef}
            // 上留 4px：同上，第一张卡片别贴着滚动容器上边缘，否则上边框会被裁细
            className="min-h-0 flex-1 overflow-y-auto px-0.5 pt-1 scroll-thin"
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            {/* 虚拟滚动：只渲染视口内的记录（上下各多 4 条防闪烁） */}
            <div
              className="relative"
              style={{ height: records.length * ROW_HEIGHT - 12 }}
            >
              {records.slice(visibleStart, visibleEnd).map((record, offset) => {
                const index = visibleStart + offset
                return (
                  <div key={record.id} className="absolute inset-x-0" style={{ top: index * ROW_HEIGHT }}>
                    <InboxCard
                      record={record}
                      terms={terms}
                      onRemove={() =>
                        setConfirm({
                          title: `删除 ${record.title}`,
                          description: '该完成记录将被永久删除，无法恢复。',
                          action: () => void removeInboxRecord(record.id),
                        })
                      }
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        onOpenChange={(open) => !open && setConfirm(null)}
        onConfirm={() => confirm?.action()}
      />
    </div>
  )
}

function InboxCard({
  record,
  terms,
  onRemove,
}: {
  record: InboxRecord
  /** 当前搜索词：空数组＝没在搜索，文本原样返回 */
  terms: readonly string[]
  onRemove: () => void
}) {
  // 与任务卡片同一种排法：第 1 行标题 + 行末的起止日期 / 番茄数，第 2 行简介。
  // 图标、字号、颜色全部照任务卡片那套，两处看起来是一家人
  const from = toDateInput(record.start) || '不定'
  const to = toDateInput(record.end) || '不定'
  return (
    <section className="rounded-panel border border-[var(--card-edge)] bg-[var(--card-surface)] p-3.5 shadow-sm">
      {/* items-center：删除按钮跟着整卡垂直居中，不再贴在第一行 */}
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          {/* 第 1 行：标题 + 起止日期 / 番茄数 */}
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[15px] font-medium leading-[20px] text-foreground">
              {highlightTerms(record.title, terms)}
            </h3>
            <span className="ml-auto flex shrink-0 items-center gap-2 text-[11px] leading-[16px] tabular-nums text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3" aria-hidden />
                <span>{`${from} ~ ${to}`}</span>
              </span>
              <span className="flex items-center gap-1">
                <CircleDot className="size-3" aria-hidden />
                <span>{record.count} 番茄</span>
              </span>
            </span>
          </div>

          {/* 第 2 行：简介（没有就空着，仍占一行保持两行高度）；归档日期跟在末尾 */}
          <div className="flex min-h-4 min-w-0 items-center gap-1 text-[11px] leading-[16px] text-muted-foreground/80">
            {record.desc ? (
              <span className="min-w-0 flex-1 truncate">{highlightTerms(record.desc, terms)}</span>
            ) : (
              <span className="flex-1" aria-hidden />
            )}
            <span className="shrink-0 tabular-nums text-muted-foreground/60">
              {new Date(record.time).toLocaleDateString('zh-CN')} 归档
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tip label="删除记录">
            <Button size="icon-sm" variant="ghost" aria-label="删除记录" onClick={onRemove}>
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </Tip>
        </div>
      </div>
    </section>
  )
}
