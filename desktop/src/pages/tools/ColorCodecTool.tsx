import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, Palette, Sparkles, WandSparkles } from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

type ColorMode = 'hex' | 'rgb'

interface ColorOutput {
  hex: string
  r: number
  g: number
  b: number
  rgb: string
}

const HEX_PATTERN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** RGB 与十六进制色值双向转换，顶部大色块实时预览 */
export function ColorCodecTool() {
  const [mode, setMode] = useState<ColorMode>('hex')
  const [hex, setHex] = useState('#4986CE')
  const [r, setR] = useState('73')
  const [g, setG] = useState('132')
  const [b, setB] = useState('206')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult<ColorOutput> | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const output = result?.ok ? result.data : null
  const rgbValues = [r, g, b].map((item) => Number(item))
  const rgbValid = rgbValues.every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 255,
  )
  const hexValid = HEX_PATTERN.test(hex.trim())
  const valid = mode === 'hex' ? hexValid : rgbValid
  const canRun = valid && !loading
  const signature =
    mode === 'hex'
      ? hex
      : `${r},${g},${b}`
  const dirty = !!snapshot && snapshot !== signature
  const preview =
    mode === 'hex'
      ? hexValid
        ? hex.startsWith('#')
          ? hex
          : `#${hex}`
        : 'transparent'
      : rgbValid
        ? `rgb(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]})`
        : 'transparent'

  const run = async () => {
    if (!canRun) return
    setLoading(true)
    try {
      const input =
        mode === 'hex'
          ? { from: 'hex' as const, hex }
          : {
              from: 'rgb' as const,
              r: rgbValues[0] ?? 0,
              g: rgbValues[1] ?? 0,
              b: rgbValues[2] ?? 0,
            }
      const next = await runTool<ColorOutput>('color-codec', input)
      setResult(next)
      setSnapshot(signature)
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    if (!valid) return
    const timer = window.setTimeout(() => void run(), 160)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex, r, g, b, mode])

  const copy = async (key: string, text: string) => {
    try {
      await copyText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const runExample = () => {
    setMode('hex')
    setHex('#4986CE')
    setR('73')
    setG('132')
    setB('206')
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        RGB 与 #RRGGBB 双向转换，支持三位缩写；色块随输入实时预览。
      </p>

      <section className="glass shrink-0 rounded-panel p-3">
        <header className="flex h-8 items-center gap-2">
          <Palette className="size-4 text-primary" />
          <h2 className="text-[13px] font-medium text-foreground">颜色</h2>
          <Tip label="填入示例">
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              aria-label="填入示例"
              onClick={runExample}
            >
              <WandSparkles />
            </Button>
          </Tip>
        </header>

        <div className="mt-2 flex items-center gap-2">
          <SlidingSegmented
            options={[
              { value: 'hex' as const, label: 'HEX → RGB' },
              { value: 'rgb' as const, label: 'RGB → HEX' },
            ]}
            value={mode}
            onValueChange={setMode}
            size="sm"
            motion="spring"
            bare
            ariaLabel="转换方向"
          />
          {mode === 'hex' ? (
            <Input
              value={hex}
              spellCheck={false}
              placeholder="#4986CE"
              onChange={(event) => setHex(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void run()
                }
              }}
              aria-invalid={!hexValid}
              className={cn(
                'h-9 flex-1 font-mono text-[14px] uppercase',
                !hexValid && 'border-destructive/60 focus-visible:ring-destructive/20',
              )}
            />
          ) : (
            <div className="flex flex-1 gap-1.5">
              {[
                { label: 'R', value: r, set: setR },
                { label: 'G', value: g, set: setG },
                { label: 'B', value: b, set: setB },
              ].map((channel) => (
                <div key={channel.label} className="relative flex-1">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    {channel.label}
                  </span>
                  <Input
                    value={channel.value}
                    inputMode="numeric"
                    onChange={(event) => channel.set(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void run()
                      }
                    }}
                    className="h-9 pl-6 font-mono text-[12.5px] tabular-nums"
                  />
                </div>
              ))}
            </div>
          )}
          <Button size="sm" disabled={!canRun} onClick={() => void run()}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? '转换中…' : '转换'}
          </Button>
        </div>
        {mode === 'rgb' ? (
          <div className="mt-2 grid gap-1">
            {[
              { label: 'R', value: r, set: setR, color: 'accent-red-500' },
              { label: 'G', value: g, set: setG, color: 'accent-green-600' },
              { label: 'B', value: b, set: setB, color: 'accent-blue-600' },
            ].map((channel) => (
              <label key={channel.label} className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                <span className="w-3 shrink-0 font-mono">{channel.label}</span>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={Number(channel.value) || 0}
                  onChange={(event) => channel.set(event.target.value)}
                  className={cn('h-2 flex-1 cursor-pointer', channel.color)}
                  aria-label={`${channel.label} 通道`}
                />
                <span className="w-8 shrink-0 text-right font-mono tabular-nums">{channel.value}</span>
              </label>
            ))}
          </div>
        ) : null}
        {!valid ? (
          <p className="mt-1.5 text-[10.5px] text-destructive/90">
            {mode === 'hex' ? '请输入 3 位或 6 位十六进制颜色' : 'RGB 每个通道需为 0–255 的整数'}
          </p>
        ) : null}
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[190px_minmax(0,1fr)] gap-3">
        <section className="glass flex min-h-0 flex-col overflow-hidden rounded-panel">
          <div
            aria-label="颜色预览"
            className="min-h-0 flex-1 border-b border-border/40 transition-colors"
            style={{ backgroundColor: preview }}
          />
          <div className="shrink-0 px-3 py-2.5">
            <p className="text-[10px] text-muted-foreground">当前预览</p>
            <p className="mt-0.5 font-mono text-[12px] uppercase text-foreground">
              {mode === 'hex' ? preview : valid ? `rgb(${rgbValues.join(', ')})` : '无效颜色'}
            </p>
          </div>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">转换结果</h2>
            {!result ? (
              <span className="text-[11px] text-muted-foreground">待转换</span>
            ) : !result.ok ? (
              <span className="text-[11px] font-medium text-destructive">执行失败</span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                <Check className="size-3" />
                已转换
              </span>
            )}
          </header>

          {dirty && result ? (
            <p className="mt-1 shrink-0 rounded-md bg-primary/[0.07] px-2.5 py-1.5 text-[11px] leading-4 text-foreground/70">
              颜色已修改，结果为上次执行
            </p>
          ) : null}

          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            {!result ? (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-border/60">
                <Empty
                  size="sm"
                  icon={Palette}
                  title="等待转换"
                  description="选择方向，输入色值后转换。"
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
              <div className="flex flex-col gap-2">
                {[
                  { key: 'hex', label: '十六进制', value: output.hex },
                  { key: 'rgb', label: 'RGB', value: output.rgb },
                  {
                    key: 'channels',
                    label: '通道',
                    value: `R ${output.r} · G ${output.g} · B ${output.b}`,
                  },
                ].map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center gap-3 rounded-md bg-foreground/[0.03] px-3 py-2.5"
                  >
                    <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                      {row.label}
                    </span>
                    <span className="min-w-0 flex-1 break-all font-mono text-[15px] tabular-nums text-foreground">
                      {row.value}
                    </span>
                    <Tip label={`复制${row.label}`}>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0"
                        aria-label={`复制${row.label}`}
                        onClick={() => void copy(row.key, row.value)}
                      >
                        {copiedKey === row.key ? <Check className="text-success" /> : <Copy />}
                      </Button>
                    </Tip>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
