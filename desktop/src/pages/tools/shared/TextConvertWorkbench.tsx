import { useState } from 'react'
import { Check, Copy, Loader2, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

export interface ConvertControl {
  key: string
  label: string
  type: 'number' | 'text' | 'select' | 'switch'
  defaultValue?: string
  options?: { value: string; label: string }[]
  optional?: boolean
}

export interface TextConvertProps<T> {
  toolId: string
  /** 输入框对应的字段名（text / sql …） */
  inputKey: string
  hint: string
  placeholder: string
  controls: ConvertControl[]
  sample: string
  runLabel: string
  /** 结果文本（也用于复制） */
  outputOf: (data: T) => string
  /** 结果区附加信息 */
  metaOf?: (data: T) => React.ReactNode
}

/** 文本进、文本出类工具的共用工作台（XML 互转、SQL 格式化等） */
export function TextConvertWorkbench<T>({
  toolId,
  inputKey,
  hint,
  placeholder,
  controls,
  sample,
  runLabel,
  outputOf,
  metaOf,
}: TextConvertProps<T>) {
  const Icon = pluginIcon(toolId)
  const [input, setInput] = useState(sample)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(controls.map((control) => [control.key, control.defaultValue ?? ''])),
  )
  const [output, setOutput] = useState('')
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const setField = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  const run = async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {}
      for (const control of controls) {
        const raw = values[control.key] ?? ''
        payload[control.key] = control.type === 'number' ? Number(raw) : control.type === 'switch' ? raw === 'true' : raw
      }
      const result = await runTool<T>(toolId, { ...payload, [inputKey]: input })
      if (result.ok) {
        setData(result.data)
        setOutput(outputOf(result.data))
        setError(null)
      } else {
        setData(null)
        setOutput('')
        setError(result.error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!output) return
    try {
      await copyText(output)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <p className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
          {hint}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          {controls.map((control) =>
            control.type === 'select' ? (
              <SelectField
                key={control.key}
                value={values[control.key] ?? ''}
                onValueChange={(value) => setField(control.key, value)}
                options={control.options ?? []}
                ariaLabel={control.label}
                size="sm"
                className="h-8 px-2 text-[11.5px]"
              />
            ) : control.type === 'switch' ? (
              <button
                key={control.key}
                type="button"
                onClick={() => setField(control.key, values[control.key] === 'true' ? 'false' : 'true')}
                aria-pressed={values[control.key] === 'true'}
                className={cn(
                  'h-8 rounded-md border px-2.5 text-[11.5px] transition-colors',
                  values[control.key] === 'true'
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground',
                )}
              >
                {control.label}
              </button>
            ) : (
              <Input
                key={control.key}
                value={values[control.key] ?? ''}
                onChange={(event) => setField(control.key, event.target.value)}
                aria-label={control.label}
                type={control.type === 'number' ? 'number' : 'text'}
                className="h-8 w-20 text-[11.5px]"
              />
            ),
          )}
          <Button size="sm" disabled={loading || !input.trim()} onClick={() => void run()}>
            {loading ? <Loader2 className="animate-spin" /> : <Play />}
            {loading ? '处理中…' : runLabel}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Icon className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">输入</h2>
            <Tip label="清空">
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto"
                aria-label="清空"
                onClick={() => {
                  setInput('')
                  setOutput('')
                  setData(null)
                  setError(null)
                }}
              >
                <Trash2 />
              </Button>
            </Tip>
          </header>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            className="mt-2 min-h-0 flex-1 resize-none rounded-md border border-input bg-transparent p-2.5 font-mono text-[12px] leading-5 text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 scroll-thin"
          />
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">结果</h2>
            {data && metaOf ? <span className="text-[11px] text-muted-foreground">{metaOf(data)}</span> : null}
            {output ? (
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
          <div className="mt-1.5 min-h-0 flex-1 overflow-auto pr-0.5 scroll-thin">
            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-[11.5px] leading-5 text-destructive">{error}</p>
            ) : output ? (
              <pre className="whitespace-pre-wrap break-words rounded-md border border-border/50 bg-background/40 p-2.5 font-mono text-[12px] leading-5 text-foreground">
                {output}
              </pre>
            ) : (
              <div className="flex h-full min-h-[140px] items-center justify-center rounded-md border border-dashed border-border/60 text-[11.5px] text-muted-foreground">
                结果会显示在这里
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
