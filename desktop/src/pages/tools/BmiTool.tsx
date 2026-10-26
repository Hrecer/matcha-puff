import { useState } from 'react'
import { HeartPulse, Loader2, Sparkles } from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

interface BmiOutput {
  bmi: number
  category: '偏瘦' | '正常' | '过重' | '肥胖'
}

const CATEGORY_STYLE: Record<BmiOutput['category'], string> = {
  偏瘦: 'text-warning bg-warning/10',
  正常: 'text-success bg-success/10',
  过重: 'text-warning bg-warning/10',
  肥胖: 'text-destructive bg-destructive/10',
}

/** BMI 计算器：大号结果 + 四段区间标尺 */
export function BmiTool() {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult<BmiOutput> | null>(null)
  const [snapshot, setSnapshot] = useState('')

  const output = result?.ok ? result.data : null
  const heightValue = Number(height)
  const weightValue = Number(weight)
  const valid =
    height.trim() !== '' &&
    weight.trim() !== '' &&
    Number.isFinite(heightValue) &&
    Number.isFinite(weightValue) &&
    heightValue > 0 &&
    weightValue > 0
  const malformed = (height.trim() !== '' || weight.trim() !== '') && !valid
  const canRun = valid && !loading
  const dirty = !!snapshot && snapshot !== `${height}|${weight}`
  const marker = output ? Math.min(100, Math.max(0, ((output.bmi - 15) / 20) * 100)) : 0

  const run = async () => {
    if (!canRun) return
    setLoading(true)
    try {
      const next = await runTool<BmiOutput>('bmi-calculator', {
        heightCm: heightValue,
        weightKg: weightValue,
      })
      setResult(next)
      setSnapshot(`${height}|${weight}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        按身高体重计算 BMI，并按中国成人参考区间给出判断。
      </p>

      <section className="glass shrink-0 rounded-panel p-3">
        <header className="flex h-8 items-center gap-2">
          <HeartPulse className="size-4 text-primary" />
          <h2 className="text-[13px] font-medium text-foreground">身体数据</h2>
        </header>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground">身高（cm）</span>
            <Input
              value={height}
              inputMode="decimal"
              placeholder="例如 170"
              onChange={(event) => setHeight(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void run()
                }
              }}
              aria-invalid={malformed}
              className={cn(
                'h-10 font-mono text-[15px] tabular-nums',
                malformed && 'border-destructive/60 focus-visible:ring-destructive/20',
              )}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground">体重（kg）</span>
            <Input
              value={weight}
              inputMode="decimal"
              placeholder="例如 65"
              onChange={(event) => setWeight(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void run()
                }
              }}
              aria-invalid={malformed}
              className={cn(
                'h-10 font-mono text-[15px] tabular-nums',
                malformed && 'border-destructive/60 focus-visible:ring-destructive/20',
              )}
            />
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <p className="flex-1 text-[10.5px] text-muted-foreground/80">
            {malformed ? '身高和体重必须为正数。' : '成人参考区间：18.5 / 24 / 28'}
          </p>
          <Button size="sm" disabled={!canRun} onClick={() => void run()}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? '计算中…' : '计算 BMI'}
          </Button>
        </div>
      </section>

      <section className="glass flex min-h-0 flex-1 flex-col rounded-panel p-4">
        {!result ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-border/60">
            <Empty
              size="sm"
              icon={HeartPulse}
              title="等待计算"
              description="输入身高与体重，计算 BMI。"
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
            {dirty ? (
              <p className="mb-2 shrink-0 rounded-md bg-primary/[0.07] px-2.5 py-1.5 text-[11px] leading-4 text-foreground/70">
                身体数据已修改，结果为上次执行
              </p>
            ) : null}
            <div className="flex flex-1 flex-col items-center justify-center">
              <p className="text-[11px] text-muted-foreground">你的 BMI</p>
              <p className="mt-1 font-mono text-[52px] leading-[60px] font-semibold tabular-nums text-foreground">
                {output.bmi.toFixed(2)}
              </p>
              <span
                className={cn(
                  'mt-2 rounded-full px-3 py-1 text-[12px] font-medium',
                  CATEGORY_STYLE[output.category],
                )}
              >
                {output.category}
              </span>
            </div>

            <div className="mt-5 shrink-0">
              <div className="relative">
                <div className="flex h-2.5 overflow-hidden rounded-full">
                  <span className="w-[17.5%] bg-warning/35" />
                  <span className="w-[27.5%] bg-success/55" />
                  <span className="w-[20%] bg-warning/60" />
                  <span className="flex-1 bg-destructive/45" />
                </div>
                <span
                  aria-hidden
                  className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm transition-[left] duration-300"
                  style={{ left: `${marker}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[9.5px] text-muted-foreground">
                <span>偏瘦 18.5</span>
                <span>正常 24</span>
                <span>过重 28</span>
                <span>肥胖</span>
              </div>
              <p className="mt-3 text-center text-[10px] text-muted-foreground/70">
                BMI 只作健康管理参考，不替代医生诊断。
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
