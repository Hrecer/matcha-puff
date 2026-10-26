import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bold,
  Check,
  Copy,
  Eraser,
  FileDown,
  FileText,
  Heading1,
  Heading2,
  Italic,
  Link,
  List,
  Loader2,
  Quote,
  Sparkles,
  Table2,
  WandSparkles,
} from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { copyText } from '@/lib/clipboard'
import { saveDialog, writeFileBytes } from '@/ipc/bridge'
import { runTool } from '@/lib/tool-core'
import { toast } from '@/components/ui/toast'

interface MarkdownOutput {
  html: string
  headings: { level: number; text: string }[]
  wordCount: number
  charCount: number
}

interface Snapshot {
  markdown: string
  gfm: boolean
  breaks: boolean
  sanitize: boolean
}

const EXAMPLE = `# 抹茶泡芙

把 **Markdown** 转成 HTML，排版保持干净。

## 支持的写法

- GFM 表格与任务列表
- 代码块与引用

\`\`\`ts
const tool = 'markdown-converter'
\`\`\`

> 预览只在开启净化时可用。`

/**
 * Markdown 文本转换（专属界面）
 *
 * 左侧编辑、右侧源码/预览双视图；标题大纲与字数统计随结果一起给出。
 * 关闭「净化脚本」时禁用 HTML 预览，只允许查看源码，避免直接渲染未净化内容。
 */
export function MarkdownConverterTool() {
  const [markdown, setMarkdown] = useState('')
  const [gfm, setGfm] = useState(true)
  const [breaks, setBreaks] = useState(false)
  const [sanitize, setSanitize] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult<MarkdownOutput> | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [view, setView] = useState<'html' | 'preview'>('html')
  const [copied, setCopied] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const output = result?.ok ? result.data : null

  const previewHtml = useMemo(() => {
    if (!output?.html) return ''
    const doc = new DOMParser().parseFromString(output.html, 'text/html')
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((element, index) => {
      element.id = `md-heading-${index}`
    })
    return doc.body.innerHTML
  }, [output?.html])

  const insert = (before: string, after = '', placeholder = '') => {
    const element = areaRef.current
    if (!element) return
    const start = element.selectionStart
    const end = element.selectionEnd
    const selected = markdown.slice(start, end) || placeholder
    const next = `${markdown.slice(0, start)}${before}${selected}${after}${markdown.slice(end)}`
    setMarkdown(next)
    window.requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }
  const dirty =
    !!snapshot &&
    (snapshot.markdown !== markdown ||
      snapshot.gfm !== gfm ||
      snapshot.breaks !== breaks ||
      snapshot.sanitize !== sanitize)

  const stats = useMemo(() => {
    const lines = markdown ? markdown.split('\n').length : 0
    return { lines, chars: markdown.length }
  }, [markdown])

  const run = useCallback(async () => {
    if (!markdown.trim()) return
    setLoading(true)
    try {
      const next = await runTool<MarkdownOutput>('markdown-converter', {
        markdown,
        gfm,
        breaks,
        sanitize,
      })
      setResult(next)
      setSnapshot({ markdown, gfm, breaks, sanitize })
      setView(next.ok && sanitize ? 'preview' : 'html')
    } finally {
      setLoading(false)
    }
  }, [markdown, gfm, breaks, sanitize])


  useEffect(() => {
    if (!markdown.trim()) return
    const timer = window.setTimeout(() => void run(), 500)
    return () => window.clearTimeout(timer)
  }, [markdown, gfm, breaks, sanitize, run])

  const saveFile = async (kind: 'md' | 'html') => {
    if (!markdown.trim()) return
    try {
      let content = markdown
      if (kind === 'html') {
        const converted = await runTool<MarkdownOutput>('markdown-converter', {
          markdown,
          gfm,
          breaks,
          sanitize,
        })
        if (!converted.ok) {
          toast(converted.error.message, 'error')
          return
        }
        content = `<html><head><meta charset="utf-8"></head><body>${converted.data.html}</body></html>`
      }
      const path = await saveDialog({
        defaultPath: kind === 'md' ? '笔记.md' : '笔记.html',
        filters: [
          {
            name: kind === 'md' ? 'Markdown' : 'HTML',
            extensions: kind === 'md' ? ['md'] : ['html'],
          },
        ],
      })
      if (!path) return
      await writeFileBytes(path, Array.from(new TextEncoder().encode(content)))
      toast('已保存')
    } catch (saveError) {
      toast(saveError instanceof Error ? `保存失败：${saveError.message}` : '保存失败', 'error')
    }
  }

  const clearAll = () => {
    setMarkdown('')
    setResult(null)
    setSnapshot(null)
    setCopied(false)
    areaRef.current?.focus()
  }

  const copy = async () => {
    if (!output) return
    try {
      await copyText(output.html)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  // 只预览“本次结果确实经过净化”的 HTML；结果过期时改回净化开关也不能绕过
  const previewAllowed = sanitize && snapshot?.sanitize === true

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5">
      <p className="flex shrink-0 items-center gap-2 text-[12px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        左侧编写，右侧自动预览；可保存为 .md 或 .html，标题大纲与字数随结果统计。
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        {/* ── 输入 ─────────────────────────────────────────────── */}
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">Markdown</h2>
            <span className="rounded-full bg-foreground/[0.05] px-2 py-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {stats.lines} 行 · {stats.chars} 字符
            </span>
            <div className="ml-auto flex items-center gap-0.5">
              <Tip label="保存为 Markdown">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="保存为 Markdown"
                  disabled={!markdown.trim()}
                  onClick={() => void saveFile('md')}
                >
                  <FileDown />
                </Button>
              </Tip>
              <Tip label="保存为 HTML">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="保存为 HTML"
                  disabled={!markdown.trim()}
                  onClick={() => void saveFile('html')}
                >
                  <FileText />
                </Button>
              </Tip>
              <Tip label="填入示例">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="填入示例"
                  onClick={() => setMarkdown(EXAMPLE)}
                >
                  <WandSparkles />
                </Button>
              </Tip>
              <Tip label="清空输入与结果">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="清空"
                  disabled={!markdown && !result}
                  onClick={clearAll}
                >
                  <Eraser />
                </Button>
              </Tip>
            </div>
          </header>

          <div className="mt-1 flex shrink-0 flex-wrap items-center gap-0.5 rounded-md border border-border/50 bg-foreground/[0.02] p-1">
            {[
              { label: '一级标题', icon: Heading1, run: () => insert('# ', '', '标题') },
              { label: '二级标题', icon: Heading2, run: () => insert('## ', '', '标题') },
              { label: '加粗', icon: Bold, run: () => insert('**', '**', '加粗文字') },
              { label: '斜体', icon: Italic, run: () => insert('*', '*', '斜体文字') },
              { label: '引用', icon: Quote, run: () => insert('> ', '', '引用内容') },
              { label: '列表', icon: List, run: () => insert('- ', '', '列表项') },
              { label: '表格', icon: Table2, run: () => insert('\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |\n', '', '') },
              { label: '链接', icon: Link, run: () => insert('[', '](https://)', '链接文字') },
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
          </div>

          <textarea
            ref={areaRef}
            value={markdown}
            spellCheck={false}
            placeholder="# 在这里写 Markdown"
            onChange={(event) => setMarkdown(event.target.value)}
            onKeyDown={(event) => {
              if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault()
                void run()
              }
            }}
            className="mt-1 min-h-0 flex-1 resize-none rounded-md bg-transparent p-2 font-mono text-[12.5px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:bg-foreground/[0.025] scroll-thin"
          />

          <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/50 pt-2.5">
            <label
              htmlFor="md-gfm"
              className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground"
            >
              <Switch id="md-gfm" size="sm" checked={gfm} onCheckedChange={setGfm} />
              GFM
            </label>
            <label
              htmlFor="md-breaks"
              className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground"
            >
              <Switch id="md-breaks" size="sm" checked={breaks} onCheckedChange={setBreaks} />
              单换行
            </label>
            <label
              htmlFor="md-sanitize"
              className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground"
            >
              <Switch
                id="md-sanitize"
                size="sm"
                checked={sanitize}
                onCheckedChange={(checked) => {
                  setSanitize(checked)
                  if (!checked) setView('html')
                }}
              />
              净化脚本
            </label>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden font-mono text-[10px] text-muted-foreground/70 sm:block">
                Ctrl+Enter
              </span>
              <Button size="sm" disabled={!markdown.trim() || loading} onClick={() => void run()}>
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {loading ? '转换中…' : '转换'}
              </Button>
            </div>
          </div>
        </section>

        {/* ── 结果 ─────────────────────────────────────────────── */}
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">结果</h2>
            {!result ? (
              <span className="text-[11px] text-muted-foreground">待执行</span>
            ) : !result.ok ? (
              <span className="text-[11px] font-medium text-destructive">执行失败</span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                <Check className="size-3" />
                已转换
              </span>
            )}
            <div className="ml-auto flex items-center gap-0.5">
              {output ? (
                <>
                  <SlidingSegmented
                    options={[
                      { value: 'html' as const, label: 'HTML' },
                      { value: 'preview' as const, label: '预览', disabled: !previewAllowed },
                    ]}
                    value={view}
                    onValueChange={setView}
                    size="sm"
                    motion="spring"
                    bare
                    ariaLabel="结果视图"
                  />
                  <Tip label={copied ? '已复制' : '复制 HTML'}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="复制 HTML"
                      onClick={() => void copy()}
                    >
                      {copied ? <Check className="text-success" /> : <Copy />}
                    </Button>
                  </Tip>
                </>
              ) : null}
            </div>
          </header>

          {dirty && result ? (
            <p className="mt-1 shrink-0 rounded-md bg-primary/[0.07] px-2.5 py-1.5 text-[11px] leading-4 text-foreground/70">
              参数已修改，结果为上次执行
            </p>
          ) : null}

          <div className="mt-1 flex min-h-0 flex-1 flex-col">
            {!result ? (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-border/60">
                <Empty
                  size="sm"
                  icon={FileText}
                  title="等待转换"
                  description="左侧写入 Markdown，停顿后自动预览。"
                />
              </div>
            ) : !result.ok ? (
              <ErrorState
                compact
                code={result.error.code}
                message={result.error.message}
                className="min-h-0 overflow-auto"
              />
            ) : output ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {view === 'preview' ? (
                  <div ref={previewRef} className="markdown-preview min-h-0 flex-1 overflow-auto rounded-md bg-foreground/[0.02] p-3 scroll-thin">
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                ) : (
                  <pre className="min-h-0 flex-1 overflow-auto rounded-md bg-foreground/[0.03] p-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-foreground/90 selection:bg-primary/20 scroll-thin">
                    {output.html}
                  </pre>
                )}

                <div className="mt-2 shrink-0 border-t border-border/50 pt-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span>字数 {output.wordCount}</span>
                    <span>字符 {output.charCount}</span>
                    <span>标题 {output.headings.length}</span>
                    {!previewAllowed ? (
                      <span className="text-warning">关闭净化后仅显示源码</span>
                    ) : null}
                  </div>
                  {output.headings.length > 0 ? (
                    <div className="mt-1.5 max-h-16 overflow-auto scroll-thin">
                      {output.headings.map((heading, index) => (
                        <button
                          key={`${heading.level}-${heading.text}-${index}`}
                          type="button"
                          onClick={() => {
                            if (view === 'html') setView('preview')
                            window.requestAnimationFrame(() => {
                              previewRef.current?.querySelector(`#md-heading-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            })
                          }}
                          className="block w-full truncate py-0.5 text-left text-[11px] text-foreground/70 transition-colors hover:text-primary"
                          style={{ paddingLeft: (heading.level - 1) * 10 }}
                        >
                          <span className="mr-1.5 font-mono text-[10px] text-muted-foreground/70">
                            H{heading.level}
                          </span>
                          {heading.text}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
