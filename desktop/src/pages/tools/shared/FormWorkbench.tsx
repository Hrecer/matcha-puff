import { useMemo, useState, type ReactNode } from 'react'
import {
  Check,
  Copy,
  Eraser,
  Loader2,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

export interface FormOption {
  value: string
  label: string
}

export interface FormField {
  key: string
  label: string
  type: 'number' | 'text' | 'textarea' | 'password' | 'date' | 'datetime' | 'select' | 'switch'
  placeholder?: string
  /** 字段下方的说明文字 */
  hint?: string
  options?: FormOption[]
  defaultValue?: string
  step?: string
  min?: string
  max?: string
  /** 输入框右侧的单位标记，例如「元」「公里」 */
  suffix?: string
  /** textarea 的默认行数 */
  rows?: number
  /** 占满整行（默认两列栅格） */
  wide?: boolean
  /** 允许留空（不参与必填校验） */
  optional?: boolean
}

export type FormValues = Record<string, string>

export interface FormWorkbenchProps<T> {
  toolId: string
  /** 顶部说明；留空则不显示 */
  hint?: string
  fields: FormField[]
  runLabel?: string
  /** 顶部说明上方的标题，留空则不显示 */
  formTitle?: string
  /** 结果区的默认提示 */
  emptyTitle?: string
  emptyDescription?: string
  /** 一键填入的示例值 */
  example?: FormValues
  /** 结果渲染：拿到 execute 的 data（已校验） */
  renderResult: (data: T) => ReactNode
  /** 结果可复制为纯文本 */
  toText?: (data: T) => string
  /** 计算执行器；应用内功能可注入本地实现，默认走插件运行时 */
  runner?: (toolId: string, input: unknown) => Promise<ToolResult<T>>
  /** 参数区图标，默认按工具 ID 取插件图标 */
  icon?: LucideIcon
}

const initialValues = (fields: FormField[]): FormValues =>
  Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.defaultValue ??
        (field.type === 'select' ? (field.options?.[0]?.value ?? '') : field.type === 'switch' ? 'false' : ''),
    ]),
  )

const isBlank = (field: FormField, value: string): boolean => {
  if (field.type === 'switch' || field.optional) return false
  return field.type === 'select' ? value === '' : value.trim() === ''
}

/** 计算类工具的共用工作台：上方参数表单、下方/右侧结果，视觉与单位换算工作台同源 */
export function FormWorkbench<T>({
  toolId,
  hint,
  fields,
  runLabel = '开始计算',
  formTitle = '参数',
  emptyTitle = '等待计算',
  emptyDescription = '填写参数后开始计算。',
  example,
  renderResult,
  toText,
  runner = runTool,
  icon,
}: FormWorkbenchProps<T>) {
  const Icon = icon ?? pluginIcon(toolId)
  const [values, setValues] = useState<FormValues>(() => initialValues(fields))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult<T> | null>(null)
  const [snapshot, setSnapshot] = useState<FormValues | null>(null)
  const [copied, setCopied] = useState(false)

  const output = result?.ok ? result.data : null
  const missing = fields.filter((field) => isBlank(field, values[field.key] ?? ''))
  const malformed = fields.filter((field) => {
    if (field.type !== 'number') return false
    const raw = (values[field.key] ?? '').trim()
    return raw !== '' && !Number.isFinite(Number(raw))
  })
  const canRun = missing.length === 0 && malformed.length === 0 && !loading
  const dirty =
    !!snapshot &&
    fields.some((field) => (snapshot[field.key] ?? '') !== (values[field.key] ?? '')) &&
    !!result

  const payload = useMemo(() => {
    const next: Record<string, string | number | boolean> = {}
    for (const field of fields) {
      const raw = values[field.key] ?? ''
      if (field.type === 'number') next[field.key] = Number(raw)
      else if (field.type === 'switch') next[field.key] = raw === 'true'
      else next[field.key] = raw
    }
    return next
  }, [fields, values])

  const setField = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  const run = async () => {
    if (!canRun) return
    setLoading(true)
    try {
      const next = await runner(toolId, payload)
      setResult(next)
      setSnapshot(values)
    } finally {
      setLoading(false)
    }
  }

  const clearAll = () => {
    setValues(initialValues(fields))
    setResult(null)
    setSnapshot(null)
    setCopied(false)
  }

  const copy = async () => {
    if (!output || !toText) return
    try {
      await copyText(toText(output))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      {hint ? (
        <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
          {hint}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Icon className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">{formTitle}</h2>
            <div className="ml-auto flex items-center gap-0.5">
              {example ? (
                <Tip label="填入示例值">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="填入示例值"
                    onClick={() => setValues({ ...initialValues(fields), ...example })}
                  >
                    <WandSparkles />
                  </Button>
                </Tip>
              ) : null}
              <Tip label="清空参数与结果">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="清空"
                  disabled={!result && fields.every((field) => isBlank(field, values[field.key] ?? ''))}
                  onClick={clearAll}
                >
                  <Eraser />
                </Button>
              </Tip>
            </div>
          </header>

          <div className="mt-1 min-h-0 flex-1 space-y-2.5 overflow-auto px-1 scroll-thin">
            {fields.map((field) => (
              <label
                key={field.key}
                className={cn('flex flex-col gap-1.5', field.wide && 'col-span-2')}
              >
                <span className="text-[11px] text-muted-foreground">{field.label}</span>
                {field.type === 'switch' ? (
                  <span className="flex h-9 items-center justify-between rounded-md border border-border/60 bg-background/40 px-3">
                    <span className="text-[12px] text-foreground">
                      {values[field.key] === 'true' ? '已开启' : '已关闭'}
                    </span>
                    <Switch
                      checked={values[field.key] === 'true'}
                      onCheckedChange={(checked) => setField(field.key, checked ? 'true' : 'false')}
                      aria-label={field.label}
                    />
                  </span>
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={values[field.key] ?? ''}
                    onChange={(event) => setField(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    spellCheck={false}
                    rows={field.rows ?? 3}
                    className={cn(
                      'min-h-[64px] w-full resize-y rounded-md border border-input bg-transparent p-2 font-mono text-[12px] leading-5 text-foreground outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 scroll-thin',
                      field.wide && 'col-span-2',
                    )}
                  />
                ) : field.type === 'select' ? (
                  <SelectField
                    value={values[field.key] ?? ''}
                    onValueChange={(value) => setField(field.key, value)}
                    options={field.options ?? []}
                    ariaLabel={field.label}
                    className="h-9 w-full text-[12.5px]"
                  />
                ) : (
                  <span className="relative block">
                    <Input
                      type={
                        field.type === 'datetime'
                          ? 'datetime-local'
                          : field.type === 'date'
                            ? 'date'
                            : field.type === 'password'
                              ? 'password'
                              : 'text'
                      }
                      value={values[field.key] ?? ''}
                      inputMode={field.type === 'number' ? 'decimal' : undefined}
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      spellCheck={false}
                      placeholder={field.placeholder}
                      onChange={(event) => setField(field.key, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void run()
                        }
                      }}
                      className={cn(
                        'h-9',
                        field.type === 'number' && 'font-mono tabular-nums',
                        field.suffix && 'pr-12',
                      )}
                    />
                    {field.suffix ? (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                        {field.suffix}
                      </span>
                    ) : null}
                  </span>
                )}
                {field.hint ? (
                  <span className="text-[10.5px] leading-4 text-muted-foreground/80">
                    {field.hint}
                  </span>
                ) : null}
              </label>
            ))}
          </div>

          <div className="mt-2 shrink-0 border-t border-border/50 pt-2.5">
            <p className="mb-2 min-h-4 text-[10.5px] leading-4 text-destructive/90">
              {malformed.length
                ? `${malformed[0]?.label}需要填写有效数字`
                : missing.length && snapshot
                  ? `${missing[0]?.label}不能为空`
                  : ''}
            </p>
            <Button size="sm" className="w-full" disabled={!canRun} onClick={() => void run()}>
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {loading ? '计算中…' : runLabel}
            </Button>
          </div>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">结果</h2>
            {!result ? (
              <span className="text-[11px] text-muted-foreground">待计算</span>
            ) : !result.ok ? (
              <span className="text-[11px] font-medium text-destructive">执行失败</span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                <Check className="size-3" />
                已完成
              </span>
            )}
            {output && toText ? (
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

          {dirty ? (
            <p className="mt-1 shrink-0 rounded-md bg-primary/[0.07] px-2.5 py-1.5 text-[11px] leading-4 text-foreground/70">
              参数已修改，结果为上次执行
            </p>
          ) : null}

          <div className="mt-1.5 min-h-0 flex-1 overflow-auto pr-0.5 scroll-thin">
            {!result ? (
              <div className="flex h-full min-h-[180px] items-center justify-center rounded-md border border-dashed border-border/60">
                <Empty size="sm" icon={Icon} title={emptyTitle} description={emptyDescription} />
              </div>
            ) : !result.ok ? (
              <ErrorState
                compact
                code={result.error.code}
                message={result.error.message}
                className="min-h-0"
              />
            ) : result.ok ? (
              renderResult(result.data)
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
