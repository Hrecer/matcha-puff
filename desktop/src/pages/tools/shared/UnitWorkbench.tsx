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
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

export interface UnitGroupView {
  label: string
  units: { value: string; label: string; symbol: string; factor: number }[]
}

interface UnitResult {
  unit: string
  label: string
  symbol: string
  group: string
  value: number
}

interface UnitOutput {
  results: UnitResult[]
}

interface Snapshot {
  value: string
  unit: string
}

export interface UnitWorkbenchProps {
  toolId: string
  hint: string
  groups: UnitGroupView[]
  defaultUnit: string
  example?: string
}

const formatValue = (value: number): string => {
  if (Object.is(value, -0)) return '0'
  if (value !== 0 && Math.abs(value) < 1e-6) return value.toExponential(4)
  return String(value)
}

/** 单位换算类工具的共用工作台：一个数值、一个源单位，右侧按分组列出全部结果 */
export function UnitWorkbench({
  toolId,
  hint,
  groups,
  defaultUnit,
  example = '1',
}: UnitWorkbenchProps) {
  const Icon = pluginIcon(toolId)
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState(defaultUnit)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult<UnitOutput> | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const output = result?.ok ? result.data : null
  const trimmed = value.trim()
  const numeric = Number(trimmed)
  const valid = trimmed !== '' && Number.isFinite(numeric)
  const malformed = trimmed !== '' && !valid
  const canRun = valid && !loading
  const dirty = !!snapshot && (snapshot.value !== value || snapshot.unit !== unit)
  const selected = useMemo(
    () =>
      groups.flatMap((group) => group.units).find((item) => item.value === unit) ??
      groups[0]?.units[0],
    [groups, unit],
  )

  const run = async () => {
    if (!canRun) return
    setLoading(true)
    try {
      const next = await runTool<UnitOutput>(toolId, { value: numeric, unit })
      setResult(next)
      setSnapshot({ value, unit })
    } finally {
      setLoading(false)
    }
  }

  const copy = async (key: string, text: string) => {
    try {
      await copyText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const copyAll = () => {
    if (!output) return
    const text = output.results
      .map((item) => `${item.group} · ${item.label}：${formatValue(item.value)} ${item.symbol}`)
      .join('\n')
    void copy('all', text)
  }

  const clearAll = () => {
    setValue('')
    setResult(null)
    setSnapshot(null)
    setCopiedKey(null)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        {hint}
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[290px_minmax(0,1fr)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Icon className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">输入</h2>
            <div className="ml-auto flex items-center gap-0.5">
              <Tip label="填入数值 1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="填入示例"
                  onClick={() => setValue(example)}
                >
                  <WandSparkles />
                </Button>
              </Tip>
              <Tip label="清空输入与结果">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="清空"
                  disabled={!value && !result}
                  onClick={clearAll}
                >
                  <Eraser />
                </Button>
              </Tip>
            </div>
          </header>

          <label className="mt-2 flex shrink-0 flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground">数值</span>
            <Input
              value={value}
              inputMode="decimal"
              spellCheck={false}
              placeholder="例如 1"
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void run()
                }
              }}
              aria-invalid={malformed}
              className={cn(
                'h-11 font-mono text-[18px] tabular-nums',
                malformed && 'border-destructive/60 focus-visible:ring-destructive/20',
              )}
            />
            <span className="h-4 text-[10.5px] leading-4 text-destructive/90">
              {malformed ? '请输入有效数字，例如 1、0.5 或 1e3' : ''}
            </span>
          </label>

          <label className="mt-1 flex shrink-0 flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              输入单位{selected ? ` · ${selected.label}（${selected.symbol}）` : ''}
            </span>
            <SelectField
              value={unit}
              onValueChange={setUnit}
              ariaLabel="输入单位"
              groups={groups.map((group) => ({
                label: group.label,
                options: group.units.map((item) => ({
                  value: item.value,
                  label: `${item.label}（${item.symbol}）`,
                })),
              }))}
              className="h-9 w-full text-[12.5px]"
            />
          </label>

          <p className="mt-3 shrink-0 text-[10.5px] leading-4 text-muted-foreground/80">
            支持负数与科学计数法；按 Enter 直接换算。
          </p>

          <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-border/50 pt-2.5">
            <span className="hidden font-mono text-[10px] text-muted-foreground/70 sm:block">
              Enter
            </span>
            <Button size="sm" className="ml-auto" disabled={!canRun} onClick={() => void run()}>
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {loading ? '换算中…' : '换算'}
            </Button>
          </div>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">结果</h2>
            {!result ? (
              <span className="text-[11px] text-muted-foreground">待换算</span>
            ) : !result.ok ? (
              <span className="text-[11px] font-medium text-destructive">执行失败</span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                <Check className="size-3" />
                已换算
              </span>
            )}
            {output ? (
              <Tip label="复制全部结果">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label="复制全部结果"
                  onClick={copyAll}
                >
                  {copiedKey === 'all' ? <Check className="text-success" /> : <Copy />}
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
                  title="等待换算"
                  description="输入数值并选择单位，点击换算。"
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
              <div className="min-h-0 flex-1 overflow-auto pr-0.5 scroll-thin">
                {output.results.map((item, index) => {
                  const showGroup = index === 0 || output.results[index - 1]?.group !== item.group
                  const source = snapshot?.unit === item.unit
                  return (
                    <div key={item.unit}>
                      {showGroup ? (
                        <p className="px-1 pb-1 pt-2 text-[10px] font-medium text-muted-foreground first:pt-0">
                          {item.group}
                        </p>
                      ) : null}
                      <div
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5',
                          source ? 'bg-primary/[0.07]' : 'hover:bg-foreground/[0.03]',
                        )}
                      >
                        <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">
                          {item.label}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[13px] tabular-nums text-foreground">
                          {formatValue(item.value)}
                          <span className="ml-1 text-[10.5px] text-muted-foreground">
                            {item.symbol}
                          </span>
                        </span>
                        {source ? (
                          <span className="shrink-0 rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[9.5px] text-muted-foreground">
                            输入单位
                          </span>
                        ) : null}
                        <Tip label={`复制${item.label}`}>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="shrink-0"
                            aria-label={`复制${item.label}`}
                            onClick={() =>
                              void copy(item.unit, `${formatValue(item.value)} ${item.symbol}`)
                            }
                          >
                            {copiedKey === item.unit ? (
                              <Check className="text-success" />
                            ) : (
                              <Copy />
                            )}
                          </Button>
                        </Tip>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
