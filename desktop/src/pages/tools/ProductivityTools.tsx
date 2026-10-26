import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold,
  Check,
  Code2,
  Eye,
  Heading1,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Quote,
  Strikethrough,
  Table2,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ 便签 */

interface Note {
  id: string
  title: string
  content: string
  color: string
  createdAt: number
  updatedAt: number
}

interface NotesOutput {
  action: string
  total: number
  notes: Note[]
}

const NOTE_COLORS = [
  { value: 'yellow', label: '黄', className: 'bg-amber-200/70 dark:bg-amber-300/25' },
  { value: 'green', label: '绿', className: 'bg-emerald-200/70 dark:bg-emerald-300/25' },
  { value: 'blue', label: '蓝', className: 'bg-sky-200/70 dark:bg-sky-300/25' },
  { value: 'pink', label: '粉', className: 'bg-pink-200/70 dark:bg-pink-300/25' },
  { value: 'gray', label: '灰', className: 'bg-foreground/[0.08]' },
]

const colorClass = (color: string): string =>
  NOTE_COLORS.find((item) => item.value === color)?.className ?? NOTE_COLORS[0]!.className

const formatTime = (value: number): string => {
  const date = new Date(value)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** 便签：左边列表，右边编辑 */
export function NotesTool() {
  const Icon = pluginIcon('notes')
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState('yellow')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState('')
  const [headings, setHeadings] = useState<{ level: number; text: string }[]>([])
  const [view, setView] = useState<'edit' | 'split' | 'preview'>('split')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!content.trim()) {
      setHtml('')
      setHeadings([])
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      void runTool<{ html: string; headings: { level: number; text: string }[] }>('markdown-converter', {
        markdown: content,
        gfm: true,
        breaks: false,
        sanitize: true,
      }).then((result) => {
        if (!active || !result.ok) return
        const doc = new DOMParser().parseFromString(result.data.html, 'text/html')
        doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((element, index) => {
          element.id = `note-h-${index}`
        })
        setHtml(doc.body.innerHTML)
        setHeadings(result.data.headings)
      })
    }, 280)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [content])

  const insert = (before: string, after = '', placeholder = '') => {
    const element = textareaRef.current
    if (!element) return
    const start = element.selectionStart
    const end = element.selectionEnd
    const selected = content.slice(start, end) || placeholder
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`
    setContent(next)
    window.requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  const apply = (result: ToolResult<NotesOutput>) => {
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setError(null)
    setNotes(result.data.notes)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      apply(await runTool<NotesOutput>('notes', { action: 'list', color: 'yellow' }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pick = (note: Note) => {
    setSelected(note.id)
    setTitle(note.title)
    setContent(note.content)
    setColor(note.color)
  }

  const reset = () => {
    setSelected(null)
    setTitle('')
    setContent('')
    setColor('yellow')
  }

  const save = async () => {
    if (!title.trim() && !content.trim()) {
      toast('标题和内容不能都为空', 'error')
      return
    }
    const heading = /^#{1,6}\s+(.+)$/m.exec(content)
    const nextTitle =
      title.trim() || heading?.[1]?.trim() || content.split('\n').find((line) => line.trim())?.slice(0, 60) || ''
    setTitle(nextTitle)
    setLoading(true)
    try {
      const result = await runTool<NotesOutput>('notes', {
        action: 'save',
        ...(selected ? { id: selected } : {}),
        title: nextTitle,
        content,
        color,
      })
      apply(result)
      if (result.ok) {
        const saved = result.data.notes.find(
          (note) => note.title === nextTitle && note.color === color,
        )
        if (saved) setSelected(saved.id)
      }
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('确定删除这张便签吗？删除后无法恢复。')) return
    setLoading(true)
    try {
      apply(await runTool<NotesOutput>('notes', { action: 'delete', id, color: 'yellow' }))
      if (selected === id) reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        便签存在本机，关掉应用也还在。
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-2.5">
          <header className="flex h-8 shrink-0 items-center gap-2 px-0.5">
            <Icon className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">全部便签</h2>
            <span className="text-[10.5px] text-muted-foreground">{notes.length}</span>
            <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label="新建便签" onClick={reset}>
              <Plus />
            </Button>
          </header>
          <div className="mt-1 min-h-0 flex-1 space-y-1.5 overflow-auto pr-0.5 scroll-thin">
            {loading && !notes.length ? (
              <p className="py-8 text-center text-[11.5px] text-muted-foreground">正在读取…</p>
            ) : notes.length === 0 ? (
              <p className="py-8 text-center text-[11.5px] text-muted-foreground">
                还没有便签，点右上角 + 新建。
              </p>
            ) : (
              notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => pick(note)}
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-md border px-2.5 py-2 text-left transition-colors',
                    selected === note.id
                      ? 'border-primary/60 bg-primary/[0.07]'
                      : 'border-border/50 hover:bg-foreground/[0.03]',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={cn('size-2 rounded-full', colorClass(note.color))} />
                    <span className="truncate text-[12px] text-foreground">
                      {note.title || '（无标题）'}
                    </span>
                  </span>
                  <span className="truncate text-[10.5px] text-muted-foreground">
                    {note.content || '空内容'}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">{formatTime(note.updatedAt)}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">{selected ? '编辑便签' : '新建便签'}</h2>
            {selected ? (
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto text-muted-foreground hover:text-destructive"
                aria-label="删除这张便签"
                onClick={() => void remove(selected)}
              >
                <Trash2 />
              </Button>
            ) : null}
          </header>

          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="标题（留空则自动取正文第一行）"
            className="mt-1 h-9 shrink-0"
            spellCheck={false}
          />

          <div className="mt-2 flex shrink-0 flex-wrap items-center gap-0.5 rounded-md border border-border/50 bg-foreground/[0.02] p-1">
            {[
              { label: '一级标题', icon: Heading1, run: () => insert('# ', '', '标题') },
              { label: '二级标题', icon: Heading2, run: () => insert('## ', '', '标题') },
              { label: '加粗', icon: Bold, run: () => insert('**', '**', '加粗文字') },
              { label: '斜体', icon: Italic, run: () => insert('*', '*', '斜体文字') },
              { label: '删除线', icon: Strikethrough, run: () => insert('~~', '~~', '删除线') },
              { label: '引用', icon: Quote, run: () => insert('> ', '', '引用内容') },
              { label: '无序列表', icon: List, run: () => insert('- ', '', '列表项') },
              { label: '有序列表', icon: ListOrdered, run: () => insert('1. ', '', '列表项') },
              { label: '表格', icon: Table2, run: () => insert('\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |\n', '', '') },
              { label: '分割线', icon: Minus, run: () => insert('\n---\n', '', '') },
              { label: '链接', icon: Link, run: () => insert('[', '](https://)', '链接文字') },
              { label: '图片', icon: Image, run: () => insert('![', '](https://)', '图片描述') },
              { label: '代码块', icon: Code2, run: () => insert('\n```\n', '\n```\n', '代码') },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={item.run}
                className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <item.icon className="size-3.5" aria-hidden />
              </button>
            ))}
            <div className="ml-auto flex items-center gap-0.5">
              {[
                { value: 'edit', label: '编辑', icon: Pencil },
                { value: 'split', label: '分栏', icon: Table2 },
                { value: 'preview', label: '预览', icon: Eye },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setView(item.value as typeof view)}
                  className={cn(
                    'grid size-7 place-items-center rounded transition-colors',
                    view === item.value
                      ? 'bg-primary/12 text-primary'
                      : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
                  )}
                >
                  <item.icon className="size-3.5" aria-hidden />
                </button>
              ))}
            </div>
          </div>

          <div
            className={cn(
              'mt-2 grid min-h-0 flex-1 gap-2',
              view === 'split' ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            {view !== 'preview' ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="随手记点什么…支持 Markdown，右侧即时预览。"
                spellCheck={false}
                className={cn(
                  'min-h-0 resize-none rounded-md border border-input bg-transparent p-2.5',
                  'text-[12.5px] leading-6 text-foreground outline-none placeholder:text-muted-foreground',
                  'transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 scroll-thin',
                )}
              />
            ) : null}

            {view !== 'edit' ? (
              <div className="flex min-h-0 flex-col rounded-md border border-border/50 bg-foreground/[0.015]">
                {headings.length > 0 ? (
                  <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/40 px-2 py-1 scroll-thin">
                    {headings.map((heading, index) => (
                      <button
                        key={`${heading.text}-${index}`}
                        type="button"
                        onClick={() => previewRef.current?.querySelector(`#note-h-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                        style={{ paddingLeft: 6 + (heading.level - 1) * 6 }}
                      >
                        {heading.text}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div ref={previewRef} className="markdown-preview min-h-0 flex-1 overflow-auto p-3 scroll-thin">
                  {html ? (
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                  ) : (
                    <p className="py-10 text-center text-[11px] text-muted-foreground">左侧输入 Markdown，这里会实时预览。</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-2 flex shrink-0 items-center gap-1.5">
            {NOTE_COLORS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-label={`颜色 ${item.label}`}
                onClick={() => setColor(item.value)}
                className={cn(
                  'size-5 rounded-full border transition-transform',
                  item.className,
                  color === item.value ? 'border-primary ring-2 ring-primary/40' : 'border-border/60',
                )}
              />
            ))}
            <Button className="ml-auto" size="sm" disabled={loading} onClick={() => void save()}>
              {loading ? <Loader2 className="animate-spin" /> : <Check />}
              保存
            </Button>
          </div>

          {error ? (
            <p className="mt-2 shrink-0 text-[10.5px] leading-4 text-destructive/90">{error}</p>
          ) : null}
        </section>
      </div>
    </main>
  )
}

/* ---------------------------------------------------------- 反应速度测试 */

interface ReactionOutput {
  count: number
  best: number
  worst: number
  average: number
  median: number
  consistency: number
  rating: string
  score: number
  advice: string
}

type ReactionPhase = 'idle' | 'waiting' | 'ready' | 'done' | 'failed'

/** 反应速度测试：1–10 秒随机延迟，背景变色后按空格；抢按进入失败页 */
export function ReactionTestTool() {
  const Icon = pluginIcon('reaction-test')
  const [phase, setPhase] = useState<ReactionPhase>('idle')
  const [latest, setLatest] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [stats, setStats] = useState<ReactionOutput | null>(null)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const statsRequestRef = useRef(0)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => () => clearTimer(), [])

  const start = () => {
    clearTimer()
    statsRequestRef.current += 1
    setLatest(null)
    setStats(null)
    setPhase('waiting')

    const delay = 1000 + Math.floor(Math.random() * 10) * 1000
    timerRef.current = window.setTimeout(() => {
      startedAtRef.current = performance.now()
      setPhase('ready')
    }, delay)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || (phase !== 'waiting' && phase !== 'ready')) return
      event.preventDefault()
      clearTimer()
      if (phase === 'waiting') {
        setPhase('failed')
        return
      }
      const elapsed = Math.max(1, Math.round(performance.now() - startedAtRef.current))
      setLatest(elapsed)
      setPhase('done')
      const next = [...history, elapsed]
      setHistory(next)
      const request = statsRequestRef.current + 1
      statsRequestRef.current = request
      void runTool<ReactionOutput>('reaction-test', { trials: next }).then((result) => {
        if (request !== statsRequestRef.current) return
        if (result.ok) setStats(result.data)
        else toast(result.error.message, 'error')
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, history])

  const retest = () => {
    clearTimer()
    start()
  }

  const background =
    phase === 'ready'
      ? 'border-emerald-500/60 bg-emerald-500/15'
      : phase === 'waiting'
        ? 'border-rose-500/40 bg-rose-500/10'
        : phase === 'failed'
          ? 'border-destructive/50 bg-destructive/[0.08]'
          : phase === 'done'
            ? 'border-primary/40 bg-primary/[0.06]'
            : 'border-border/60 bg-background/40'

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        点击开始测试，等待背景变色（1–10 秒随机）后立即按空格键；抢按会进入「测试失败」。
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_250px] gap-3">
        <section
          className={cn(
            'flex min-h-0 flex-col items-center justify-center rounded-panel border p-6 text-center transition-colors',
            background,
          )}
        >
          {phase === 'idle' ? (
            <>
              <Zap className="size-8 text-primary" />
              <h2 className="mt-3 text-[20px] font-semibold text-foreground">反应速度测试</h2>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                点击开始，等待背景颜色改变时按下空格键。
              </p>
              <Button className="mt-5 min-w-28" onClick={start}>
                开始测试
              </Button>
            </>
          ) : phase === 'waiting' ? (
            <>
              <Zap className="size-8 animate-pulse text-rose-500" />
              <h2 className="mt-3 text-[20px] font-semibold text-foreground">正在测试中</h2>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                背景颜色改变时请按下空格键。
              </p>
              <p className="mt-2 text-[10.5px] text-muted-foreground/70">现在按下空格会进入测试失败</p>
            </>
          ) : phase === 'ready' ? (
            <>
              <Zap className="size-8 text-emerald-600 dark:text-emerald-400" />
              <h2 className="mt-3 text-[24px] font-semibold text-foreground">颜色变了，快按空格！</h2>
              <p className="mt-1.5 text-[11.5px] text-emerald-700/80 dark:text-emerald-300/80">
                以背景刚发生变化的一刻开始计时。
              </p>
            </>
          ) : phase === 'done' ? (
            <>
              <Check className="size-8 text-primary" />
              <h2 className="mt-3 text-[20px] font-semibold text-foreground">测试完成</h2>
              <p className="mt-3 font-mono text-[44px] leading-none tabular-nums text-primary">
                {latest === null ? '—' : (latest / 1000).toFixed(3)}
                <span className="ml-1 text-[15px] text-muted-foreground">秒</span>
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                您的反应时间是 {latest ?? '—'} 毫秒{stats ? ` · ${stats.rating}` : ''}
              </p>
              <Button className="mt-5 min-w-28" onClick={retest}>
                再次测试
              </Button>
            </>
          ) : (
            <>
              <X className="size-8 text-destructive" />
              <h2 className="mt-3 text-[20px] font-semibold text-foreground">测试失败</h2>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                您按得太快了，颜色还未改变呢！
              </p>
              <Button className="mt-5 min-w-28" onClick={retest}>
                再次测试
              </Button>
            </>
          )}

          <p className="mt-6 text-[10.5px] text-muted-foreground/70">
            {phase === 'waiting' || phase === 'ready' ? '按 Space 键回应' : '单次测试，可反复重测'}
          </p>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-2.5">
          <header className="flex h-7 shrink-0 items-center gap-2">
            <Icon className="size-3.5 text-primary" />
            <h2 className="text-[12px] font-medium text-foreground">历史记录</h2>
            <span className="ml-auto text-[10px] text-muted-foreground">{history.length} 次</span>
          </header>
          <div className="mt-1 min-h-0 flex-1 space-y-1 overflow-auto pr-0.5 scroll-thin">
            {history.length === 0 ? (
              <p className="py-6 text-center text-[10.5px] text-muted-foreground/70">还没开始</p>
            ) : (
              history.map((value, index) => (
                <div
                  key={`${index}-${value}`}
                  className="flex items-baseline justify-between rounded border border-border/40 px-2 py-1"
                >
                  <span className="text-[10.5px] text-muted-foreground">第 {index + 1} 次</span>
                  <span className="font-mono text-[12px] text-foreground">{(value / 1000).toFixed(3)} 秒</span>
                </div>
              ))
            )}
          </div>
          {stats ? (
            <div className="mt-2 shrink-0 space-y-1 border-t border-border/50 pt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10.5px] text-muted-foreground">平均</span>
                <span className="font-mono text-[13px] text-primary">{stats.average} ms</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10.5px] text-muted-foreground">最快 / 最慢</span>
                <span className="font-mono text-[11px] text-foreground">
                  {stats.best} / {stats.worst}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10.5px] text-muted-foreground">评级</span>
                <span className="text-[11.5px] text-foreground">
                  {stats.rating}（{stats.score} 分）
                </span>
              </div>
              <p className="pt-1 text-[10px] leading-4 text-muted-foreground/80">{stats.advice}</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
