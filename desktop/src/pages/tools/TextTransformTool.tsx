import { useMemo, useState } from 'react'
import { Check, Copy, Eraser, Loader2, Replace, Sparkles, WandSparkles } from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { runTool } from '@/lib/tool-core'

type TransformMode = 'dedupe' | 'replace'

interface TransformOutput {
  text: string
  inputLines: number
  outputLines: number
  removedLines: number
  replacements: number
}

interface Snapshot {
  text: string
  mode: TransformMode
  trimLines: boolean
  keepEmptyLines: boolean
  search: string
  replacement: string
  useRegex: boolean
  caseSensitive: boolean
}

const EXAMPLE = `抹茶泡芙
抹茶泡芙
版本 1.0.0
内置多种工具

版本 1.0.0
支持桌面端`

/**
 * 文本去重与批量替换（专属界面）
 *
 * 两种模式共用左下角的执行按钮；替换模式的参数区在去重时隐藏，
 * 避免把两套无关选项同时摊在界面上。
 */
export function TextTransformTool() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<TransformMode>('dedupe')
  const [trimLines, setTrimLines] = useState(false)
  const [keepEmptyLines, setKeepEmptyLines] = useState(true)
  const [search, setSearch] = useState('')
  const [replacement, setReplacement] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult<TransformOutput> | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [copied, setCopied] = useState(false)

  const output = result?.ok ? result.data : null
  const dirty =
    !!snapshot &&
    (snapshot.text !== text ||
      snapshot.mode !== mode ||
      snapshot.trimLines !== trimLines ||
      snapshot.keepEmptyLines !== keepEmptyLines ||
      snapshot.search !== search ||
      snapshot.replacement !== replacement ||
      snapshot.useRegex !== useRegex ||
      snapshot.caseSensitive !== caseSensitive)
  const missingSearch = mode === 'replace' && search.length === 0

  const counts = useMemo(() => {
    if (!text) return { lines: 0, chars: 0 }
    return { lines: text.split('\n').length, chars: text.length }
  }, [text])

  const run = async () => {
    if (!text || loading || missingSearch) return
    setLoading(true)
    try {
      const next = await runTool<TransformOutput>('text-transform', {
        text,
        mode,
        trimLines,
        keepEmptyLines,
        search,
        replacement,
        useRegex,
        caseSensitive,
      })
      setResult(next)
      setSnapshot({
        text,
        mode,
        trimLines,
        keepEmptyLines,
        search,
        replacement,
        useRegex,
        caseSensitive,
      })
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!output) return
    try {
      await copyText(output.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const clearAll = () => {
    setText('')
    setResult(null)
    setSnapshot(null)
    setCopied(false)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5">
      <p className="flex shrink-0 items-center gap-2 text-[12px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        按行去重，或对整段文本做字面 / 正则批量替换；统计随结果一起给出。
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        {/* ── 输入 ─────────────────────────────────────────────── */}
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Replace className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">输入</h2>
            <span className="rounded-full bg-foreground/[0.05] px-2 py-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {counts.lines} 行 · {counts.chars} 字符
            </span>
            <div className="ml-auto flex items-center gap-0.5">
              <Tip label="填入示例">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="填入示例"
                  onClick={() => {
                    setText(EXAMPLE)
                    setMode('dedupe')
                  }}
                >
                  <WandSparkles />
                </Button>
              </Tip>
              <Tip label="清空输入与结果">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="清空"
                  disabled={!text && !result}
                  onClick={clearAll}
                >
                  <Eraser />
                </Button>
              </Tip>
            </div>
          </header>

          <div className="mt-1.5 flex shrink-0 items-center gap-2">
            <SlidingSegmented
              options={[
                { value: 'dedupe' as const, label: '按行去重' },
                { value: 'replace' as const, label: '批量替换' },
              ]}
              value={mode}
              onValueChange={setMode}
              size="sm"
              motion="spring"
              bare
              ariaLabel="处理方式"
            />
          </div>

          {mode === 'dedupe' ? (
            <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
              <label
                htmlFor="tt-trim"
                className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground"
              >
                <Switch
                  id="tt-trim"
                  size="sm"
                  checked={trimLines}
                  onCheckedChange={setTrimLines}
                />
                忽略行首尾空白
              </label>
              <label
                htmlFor="tt-empty"
                className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground"
              >
                <Switch
                  id="tt-empty"
                  size="sm"
                  checked={keepEmptyLines}
                  onCheckedChange={setKeepEmptyLines}
                />
                保留空行
              </label>
            </div>
          ) : (
            <div className="mt-2 flex shrink-0 flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">查找内容</span>
                  <Input
                    value={search}
                    spellCheck={false}
                    placeholder="要替换的内容"
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-8 font-mono text-[12px]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">替换为</span>
                  <Input
                    value={replacement}
                    spellCheck={false}
                    placeholder="$& 代表匹配原文"
                    onChange={(event) => setReplacement(event.target.value)}
                    className="h-8 font-mono text-[12px]"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label
                  htmlFor="tt-regex"
                  className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground"
                >
                  <Switch id="tt-regex" size="sm" checked={useRegex} onCheckedChange={setUseRegex} />
                  按正则解析
                </label>
                <label
                  htmlFor="tt-case"
                  className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground"
                >
                  <Switch
                    id="tt-case"
                    size="sm"
                    checked={caseSensitive}
                    onCheckedChange={setCaseSensitive}
                  />
                  区分大小写
                </label>
                {missingSearch ? (
                  <span className="text-[11px] text-warning">替换模式需要填写查找内容</span>
                ) : null}
              </div>
            </div>
          )}

          <textarea
            value={text}
            spellCheck={false}
            placeholder={mode === 'dedupe' ? '粘贴需要去重的文本，每行一条' : '粘贴需要替换的文本'}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault()
                void run()
              }
            }}
            className="mt-2 min-h-0 flex-1 resize-none rounded-md bg-transparent p-2 font-mono text-[12.5px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:bg-foreground/[0.025] scroll-thin"
          />

          <div className="mt-2 flex shrink-0 items-center justify-end border-t border-border/50 pt-2.5">
            <span className="mr-auto hidden font-mono text-[10px] text-muted-foreground/70 sm:block">
              Ctrl+Enter
            </span>
            <Button
              size="sm"
              disabled={!text || loading || missingSearch}
              onClick={() => void run()}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {loading ? '处理中…' : mode === 'dedupe' ? '去重' : '替换'}
            </Button>
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
                {(snapshot?.mode ?? mode) === 'dedupe' ? '已去重' : '已替换'}
              </span>
            )}
            <div className="ml-auto">
              {output ? (
                <Tip label={copied ? '已复制' : '复制结果'}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="复制结果"
                    onClick={() => void copy()}
                  >
                    {copied ? <Check className="text-success" /> : <Copy />}
                  </Button>
                </Tip>
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
                  icon={Replace}
                  title="等待处理"
                  description="左侧填入文本与规则，点击执行。"
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
                <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 pb-1.5 text-[11px] text-muted-foreground">
                  {snapshot?.mode === 'dedupe' ? (
                    <>
                      <span>
                        {output.inputLines} 行 → {output.outputLines} 行
                      </span>
                      <span>移除 {output.removedLines} 行</span>
                    </>
                  ) : (
                    <>
                      <span>替换 {output.replacements} 次</span>
                      <span>
                        {output.inputLines} 行 → {output.outputLines} 行
                      </span>
                    </>
                  )}
                </div>
                <pre className="min-h-0 flex-1 overflow-auto rounded-md bg-foreground/[0.03] p-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-all text-foreground/90 selection:bg-primary/20 scroll-thin">
                  {output.text || '（空结果）'}
                </pre>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
