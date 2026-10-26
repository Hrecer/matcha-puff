import { useMemo, useState } from 'react'
import {
  Check,
  Copy,
  Eraser,
  Loader2,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

export interface CodecAction {
  value: string
  label: string
}

export interface CodecOption {
  key: string
  label: string
  defaultValue: boolean
}

export interface CodecOutput {
  text: string
  operation: string
  inputLength: number
  outputLength: number
  matches?: string[]
  count?: number
}

export interface CodecWorkbenchProps {
  toolId: string
  hint: string
  actions: CodecAction[]
  defaultAction: string
  example: string
  inputTitle?: string
  outputTitle?: string
  placeholder?: string
  options?: CodecOption[]
}

interface Snapshot {
  text: string
  action: string
  options: Record<string, boolean>
}

/** 文本编解码类工具的共用工作台：左输入、右结果，操作方式与附加选项由各工具配置 */
export function CodecWorkbench({
  toolId,
  hint,
  actions,
  defaultAction,
  example,
  inputTitle = '输入',
  outputTitle = '结果',
  placeholder = '粘贴或输入需要处理的文本',
  options = [],
}: CodecWorkbenchProps) {
  const Icon = pluginIcon(toolId)
  const [text, setText] = useState('')
  const [action, setAction] = useState(defaultAction)
  const [optionValues, setOptionValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(options.map((option) => [option.key, option.defaultValue])),
  )
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult<CodecOutput> | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [copied, setCopied] = useState(false)

  const output = result?.ok ? result.data : null
  const dirty =
    !!snapshot &&
    (snapshot.text !== text ||
      snapshot.action !== action ||
      JSON.stringify(snapshot.options) !== JSON.stringify(optionValues))
  const canRun = text.length > 0 && !loading
  const stats = useMemo(() => {
    if (!text) return { lines: 0, chars: 0 }
    return { lines: text.split('\n').length, chars: text.length }
  }, [text])

  const run = async () => {
    if (!canRun) return
    setLoading(true)
    try {
      const next = await runTool<CodecOutput>(toolId, {
        text,
        operation: action,
        ...optionValues,
      })
      setResult(next)
      setSnapshot({ text, action, options: optionValues })
    } finally {
      setLoading(false)
    }
  }

  const clearAll = () => {
    setText('')
    setResult(null)
    setSnapshot(null)
    setCopied(false)
  }

  const copy = async () => {
    if (!output || output.text === '') return
    try {
      await copyText(output.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        {hint}
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Icon className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">{inputTitle}</h2>
            <span className="rounded-full bg-foreground/[0.05] px-2 py-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {stats.lines} 行 · {stats.chars} 字符
            </span>
            <div className="ml-auto flex items-center gap-0.5">
              <Tip label="填入示例">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="填入示例"
                  onClick={() => setText(example)}
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

          <div className="mt-2 shrink-0">
            {actions.length <= 4 ? (
              <SlidingSegmented
                options={actions.map((item) => ({ value: item.value, label: item.label }))}
                value={action}
                onValueChange={setAction}
                size="sm"
                motion="spring"
                bare
                ariaLabel="处理方式"
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {actions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setAction(item.value)}
                    className={cn(
                      'cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40',
                      action === item.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-foreground/[0.05] text-muted-foreground hover:bg-foreground/[0.09] hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <textarea
            value={text}
            spellCheck={false}
            placeholder={placeholder}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault()
                void run()
              }
            }}
            className="mt-2 min-h-0 flex-1 resize-none rounded-md bg-transparent p-2 font-mono text-[12.5px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:bg-foreground/[0.025] scroll-thin"
          />

          <div className="mt-2 flex shrink-0 items-center gap-3 border-t border-border/50 pt-2.5">
            {options.map((option) => (
              <label
                key={option.key}
                htmlFor={`${toolId}-${option.key}`}
                className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground"
              >
                <Switch
                  id={`${toolId}-${option.key}`}
                  size="sm"
                  checked={optionValues[option.key] ?? option.defaultValue}
                  onCheckedChange={(checked) =>
                    setOptionValues((current) => ({ ...current, [option.key]: checked }))
                  }
                />
                {option.label}
              </label>
            ))}
            <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground/70 sm:block">
              Ctrl+Enter
            </span>
            <Button size="sm" disabled={!canRun} onClick={() => void run()}>
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {loading ? '处理中…' : '执行'}
            </Button>
          </div>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">{outputTitle}</h2>
            {!result ? (
              <span className="text-[11px] text-muted-foreground">待处理</span>
            ) : !result.ok ? (
              <span className="text-[11px] font-medium text-destructive">执行失败</span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                <Check className="size-3" />
                已处理
              </span>
            )}
            {output && output.text !== '' ? (
              <Tip label="复制结果">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label="复制结果"
                  onClick={() => void copy()}
                >
                  {copied ? <Check className="text-success" /> : <Copy />}
                </Button>
              </Tip>
            ) : null}
          </header>

          {dirty && result ? (
            <p className="mt-1 shrink-0 rounded-md bg-primary/[0.07] px-2.5 py-1.5 text-[11px] leading-4 text-foreground/70">
              参数已修改，结果为上次执行
            </p>
          ) : null}

          <div className="mt-1.5 flex min-h-0 flex-1 flex-col">
            {!result ? (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-border/60">
                <Empty
                  size="sm"
                  icon={Icon}
                  title="等待处理"
                  description="输入文本、选择方式，点击执行。"
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
              <>
                {output.text === '' ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-border/60">
                    <Empty
                      size="sm"
                      icon={Icon}
                      title="没有可显示的内容"
                      description={
                        typeof output.count === 'number'
                          ? `匹配到 ${output.count} 项，换个提取类型试试。`
                          : '处理后的结果为空。'
                      }
                    />
                  </div>
                ) : (
                  <textarea
                    readOnly
                    value={output.text}
                    spellCheck={false}
                    aria-label="处理结果"
                    className="min-h-0 flex-1 resize-none rounded-md bg-foreground/[0.025] p-2 font-mono text-[12.5px] leading-relaxed text-foreground outline-none scroll-thin"
                  />
                )}
                <p className="mt-2 shrink-0 px-1 text-[10.5px] tabular-nums text-muted-foreground">
                  {output.inputLength} 字符 → {output.outputLength} 字符
                  {typeof output.count === 'number' ? ` · 匹配 ${output.count} 项` : ''}
                </p>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
