import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Copy,
  GitCompare,
  Loader2,
  Minus,
  Plus,
  WandSparkles,
} from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { NumberField } from '@/components/ui/number-field'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { runTool } from '@/lib/tool-core'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

type DiffMode = 'lines' | 'words' | 'chars'

interface DiffLine {
  type: 'equal' | 'add' | 'del'
  text: string
  oldNumber: number | null
  newNumber: number | null
}

interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

interface DiffOutput {
  identical: boolean
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

const EXAMPLE_LEFT = `抹茶泡芙
版本 1.0.0
内置多种工具
支持桌面端`

const EXAMPLE_RIGHT = `抹茶泡芙
版本 1.0.1
内置多种工具
支持桌面端与离线`

const MODE_LABEL: Record<DiffMode, string> = {
  lines: '按行',
  words: '按词',
  chars: '按字符',
}

function diffToText(hunks: DiffHunk[]): string {
  return hunks
    .map(
      (hunk) =>
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n` +
        hunk.lines
          .map((line) => `${line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}${line.text}`)
          .join('\n'),
    )
    .join('\n\n')
}

/** 懒加载 Monaco：用本地打包的 monaco-editor 配置 loader，避免走 CDN */
const MonacoDiffEditor = lazy(async () => {
  const [{ DiffEditor, loader }, monaco] = await Promise.all([
    import('@monaco-editor/react'),
    import('monaco-editor'),
  ])

  ;(self as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === 'json') return new JsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
      if (label === 'typescript' || label === 'javascript') return new TsWorker()
      return new EditorWorker()
    },
  }
  loader.config({ monaco })
  return { default: DiffEditor }
})

function useMonacoTheme(): 'vs' | 'vs-dark' {
  const read = () =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'vs-dark'
      : 'vs'
  const [theme, setTheme] = useState<'vs' | 'vs-dark'>(read)

  useEffect(() => {
    const update = () => setTheme(read())
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return theme
}

/**
 * 文本差异比较（专属界面）
 *
 * Monaco DiffEditor 双栏：两侧都可编辑、实时比较、自动换行、同步滚动。
 * 外围的按词/按字符与忽略空白继续由内核统计，显示增删数量。
 */
export function TextDiffTool() {
  const [left, setLeft] = useState(EXAMPLE_LEFT)
  const [right, setRight] = useState(EXAMPLE_RIGHT)
  const [mode, setMode] = useState<DiffMode>('lines')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [context, setContext] = useState('3')
  const [stats, setStats] = useState<ToolResult<DiffOutput> | null>(null)
  const [computing, setComputing] = useState(false)
  const [copied, setCopied] = useState(false)
  const theme = useMonacoTheme()

  const output = stats?.ok ? stats.data : null
  const oversized =
    !!output && !output.identical && output.additions === 0 && output.deletions === 0 && output.hunks.length === 0

  useEffect(() => {
    if (!left && !right) {
      setStats(null)
      return
    }
    let alive = true
    setComputing(true)
    const timer = window.setTimeout(() => {
      void runTool<DiffOutput>('text-diff', {
        left,
        right,
        mode,
        ignoreWhitespace,
        context: Math.min(50, Math.max(0, Number(context) || 0)),
      }).then((next) => {
        if (!alive) return
        setStats(next)
        setComputing(false)
      })
    }, 280)
    return () => {
      alive = false
      window.clearTimeout(timer)
      setComputing(false)
    }
  }, [left, right, mode, ignoreWhitespace, context])

  const copy = async () => {
    if (!output || output.hunks.length === 0) return
    try {
      await copyText(diffToText(output.hunks))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const editorOptions = useMemo(
    () => ({
      automaticLayout: true,
      wordWrap: 'on' as const,
      renderSideBySide: true,
      originalEditable: true,
      readOnly: false,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      fontSize: 12.5,
      lineHeight: 20,
      fontFamily: 'ui-monospace, Consolas, monospace',
      ignoreTrimWhitespace: ignoreWhitespace,
      renderOverviewRuler: false,
      diffWordWrap: 'on' as const,
      smoothScrolling: true,
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    }),
    [ignoreWhitespace],
  )

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
          左右双栏均可编辑；Monaco 实时高亮行级差异，自动换行并同步滚动。
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-muted-foreground">统计粒度</span>
            <SlidingSegmented
              options={[
                { value: 'lines' as const, label: '按行' },
                { value: 'words' as const, label: '按词' },
                { value: 'chars' as const, label: '按字符' },
              ]}
              value={mode}
              onValueChange={setMode}
              size="sm"
              motion="spring"
              bare
              ariaLabel="统计粒度"
            />
          </div>
          <label
            htmlFor="diff-ignore-ws"
            className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground"
          >
            <Switch
              id="diff-ignore-ws"
              size="sm"
              checked={ignoreWhitespace}
              onCheckedChange={setIgnoreWhitespace}
            />
            忽略空白
          </label>
          <label htmlFor="diff-context" className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            上下文
            <NumberField
              id="diff-context"
              min={0}
              max={50}
              value={Number(context)}
              onChange={(next) => setContext(String(next))}
              className="h-7 w-16 px-2 text-center font-mono text-[12px]"
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLeft(EXAMPLE_LEFT)
              setRight(EXAMPLE_RIGHT)
            }}
          >
            <WandSparkles />
            示例
          </Button>
          <Button size="sm" variant="outline" disabled={!output?.hunks.length} onClick={() => void copy()}>
            {copied ? <Check className="text-success" /> : <Copy />}
            复制差异
          </Button>
        </div>
      </div>

      <section className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel">
        <header className="flex h-8 shrink-0 items-center gap-2 border-b border-border/40 px-3">
          <GitCompare className="size-4 text-primary" />
          <h2 className="text-[13px] font-medium text-foreground">差异</h2>
          {computing ? (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              统计中
            </span>
          ) : !stats ? (
            <span className="text-[11px] text-muted-foreground">待比较</span>
          ) : !stats.ok ? (
            <span className="text-[11px] font-medium text-destructive">执行失败</span>
          ) : output?.identical ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-success">
              <Check className="size-3" />
              完全一致
            </span>
          ) : oversized ? (
            <span className="text-[11px] font-medium text-warning">超出统计上限</span>
          ) : (
            <span className="flex items-center gap-2 text-[11px] font-medium tabular-nums">
              <span className="flex items-center gap-0.5 text-success">
                <Plus className="size-3" />
                {output?.additions}
              </span>
              <span className="flex items-center gap-0.5 text-destructive">
                <Minus className="size-3" />
                {output?.deletions}
              </span>
              <span className="font-normal text-muted-foreground">{MODE_LABEL[mode]}</span>
            </span>
          )}
          <span className="ml-auto text-[10.5px] text-muted-foreground/70">
            左：原始 · 右：对比
          </span>
        </header>

        <div className="min-h-0 flex-1">
          <Suspense
            fallback={
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-md border border-dashed border-border/60">
                <Empty
                  size="sm"
                  icon={GitCompare}
                  title="正在加载编辑器"
                  description="Monaco 使用本地 worker，不依赖 CDN。"
                />
              </div>
            }
          >
            <MonacoDiffEditor
              original={left}
              modified={right}
              language="plaintext"
              theme={theme}
              onMount={(editor) => {
                editor.getOriginalEditor().updateOptions({ readOnly: false })
                editor.getModifiedEditor().updateOptions({ readOnly: false })
                editor.getOriginalEditor().onDidChangeModelContent(() => {
                  setLeft(editor.getOriginalEditor().getValue())
                })
                editor.getModifiedEditor().onDidChangeModelContent(() => {
                  setRight(editor.getModifiedEditor().getValue())
                })
              }}
              options={editorOptions}
              loading={
                <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
                  正在加载 Monaco…
                </div>
              }
            />
          </Suspense>
        </div>
      </section>
    </main>
  )
}
