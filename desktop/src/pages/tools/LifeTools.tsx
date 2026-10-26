import { useEffect, useState } from 'react'
import { Check, CircleAlert, KeyRound, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateField, fromDateInput, toDateInput } from '@/components/ui/date-field'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

interface PasswordData {
  level: 'weak' | 'medium' | 'strong'
  label: string
  length: number
  hasUpper: boolean
  hasLower: boolean
  hasDigit: boolean
  hasSymbol: boolean
  suggestions: string[]
}

const LEVEL_STYLE: Record<PasswordData['level'], { text: string; bg: string; bar: string; width: string }> = {
  weak: { text: 'text-destructive', bg: 'bg-destructive/10', bar: 'bg-destructive', width: 'w-1/3' },
  medium: { text: 'text-amber-500', bg: 'bg-amber-500/10', bar: 'bg-amber-500', width: 'w-2/3' },
  strong: { text: 'text-success', bg: 'bg-success/10', bar: 'bg-success', width: 'w-full' },
}

export function PasswordStrengthTool() {
  const Icon = pluginIcon('password-strength')
  const [password, setPassword] = useState('')
  const [data, setData] = useState<PasswordData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!password) {
      setData(null)
      setError(null)
      return
    }
    let alive = true
    const timer = window.setTimeout(() => {
      void runTool<PasswordData>('password-strength', { password }).then((result) => {
        if (!alive) return
        if (result.ok) {
          setData(result.data)
          setError(null)
        } else {
          setData(null)
          setError(result.error.message)
        }
      })
    }, 100)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [password])

  const style = data ? LEVEL_STYLE[data.level] : null
  const checks = data
    ? [
        { label: '大写字母', ok: data.hasUpper },
        { label: '小写字母', ok: data.hasLower },
        { label: '数字', ok: data.hasDigit },
        { label: '符号', ok: data.hasSymbol },
        { label: '8 位以上', ok: data.length >= 8 },
      ]
    : []

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <section className="glass shrink-0 rounded-panel p-3">
        <header className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h2 className="text-[13px] font-medium text-foreground">待检测密码</h2>
          <span className="ml-auto text-[10.5px] text-muted-foreground">输入即检测，不上传、不保存</span>
        </header>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="输入要检测的密码"
          autoComplete="new-password"
          spellCheck={false}
          className="mt-2 font-mono"
        />
      </section>

      {error ? (
        <p className="shrink-0 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] leading-5 text-destructive">
          {error}
        </p>
      ) : null}

      <section className="glass flex min-h-0 flex-1 flex-col rounded-panel p-4">
        {!data || !style ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Empty
              icon={KeyRound}
              title="等待检测"
              description="输入密码后会即时显示低 / 中 / 高强度与改进建议。"
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
            <div className={cn('rounded-panel px-4 py-4 text-center', style.bg)}>
              <p className="text-[11px] text-muted-foreground">密码强度</p>
              <p className={cn('mt-0.5 text-[30px] font-semibold leading-none', style.text)}>
                {data.label}
              </p>
              <div className="mx-auto mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-foreground/10">
                <div className={cn('h-full rounded-full transition-[width]', style.bar, style.width)} />
              </div>
              <p className="mt-2 text-[10.5px] text-muted-foreground">{data.length} 位字符</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {checks.map((item) => (
                <span
                  key={item.label}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                    item.ok
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-border/60 bg-background/40 text-muted-foreground',
                  )}
                >
                  {item.ok ? <Check className="size-3" /> : <X className="size-3" />}
                  {item.label}
                </span>
              ))}
            </div>
            <ul className="mx-auto w-full max-w-[460px] space-y-1">
              {data.suggestions.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                  <CircleAlert className="mt-0.5 size-3 shrink-0 text-primary/70" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  )
}

interface SignItem {
  sign: string
  english: string
  emoji: string
  start: string
  end: string
}

interface SignData extends SignItem {
  dateText: string
  signs: SignItem[]
}

const dateValue = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function ConstellationTool() {
  const [date, setDate] = useState(() => dateValue(new Date()))
  const [signs, setSigns] = useState<SignItem[]>([])
  const [selected, setSelected] = useState<SignItem | null>(null)
  const [dateText, setDateText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = async (value: string) => {
    setLoading(true)
    try {
      const result = await runTool<SignData>('constellation', { date: value })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setError(null)
      setSigns(result.data.signs)
      const matched =
        result.data.signs.find((item) => item.sign === result.data.sign) ?? result.data
      setSelected(matched)
      setDateText(result.data.dateText)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void query(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = (item: SignItem) => {
    setSelected(item)
    setDateText('')
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-2">
          <header className="flex h-7 shrink-0 items-center gap-2 px-1">
            <h2 className="text-[12.5px] font-medium text-foreground">十二星座</h2>
            <span className="ml-auto text-[10px] text-muted-foreground">点击直接查看</span>
          </header>
          <div className="mt-1.5 min-h-0 flex-1 space-y-1 overflow-auto pr-0.5 scroll-thin">
            {signs.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-muted-foreground">
                {loading ? '正在加载…' : '暂无星座数据'}
              </p>
            ) : (
              signs.map((item) => (
                <button
                  key={item.sign}
                  type="button"
                  onClick={() => pick(item)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
                    selected?.sign === item.sign
                      ? 'border-primary/60 bg-primary/[0.08]'
                      : 'border-transparent hover:bg-foreground/[0.04]',
                  )}
                >
                  <span className="w-7 shrink-0 text-center text-[21px] leading-6 text-primary">
                    {`${item.emoji}\uFE0E`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-foreground">{item.sign}</span>
                    <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">
                      {item.start} — {item.end}
                    </span>
                  </span>
                  <span className="shrink-0 text-[9.5px] text-muted-foreground/60">{item.english}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex shrink-0 flex-wrap items-end gap-2">
            <label className="flex min-w-[180px] flex-1 flex-col gap-1">
              <span className="text-[10.5px] text-muted-foreground">按出生日期查询</span>
              <DateField
                value={fromDateInput(date)}
                onChange={(ms) => setDate(toDateInput(ms))}
              />
            </label>
            <Button size="sm" className="h-9" disabled={loading || !date} onClick={() => void query(date)}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              查星座
            </Button>
          </header>

          {error ? (
            <p className="mt-2 shrink-0 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] leading-5 text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
            {!selected ? (
              <p className="text-[11.5px] text-muted-foreground">从左侧点一个星座，或选择日期查询。</p>
            ) : (
              <>
                <p className="text-[76px] leading-none text-primary">{`${selected.emoji}\uFE0E`}</p>
                <p className="text-[26px] font-semibold text-foreground">{selected.sign}</p>
                <p className="text-[11.5px] text-muted-foreground">{selected.english}</p>
                <p className="mt-1 rounded-full bg-primary/10 px-3 py-1 font-mono text-[11.5px] tabular-nums text-primary">
                  {selected.start} — {selected.end}
                </p>
                {dateText ? (
                  <p className="text-[10.5px] text-muted-foreground">查询日期 {dateText}</p>
                ) : (
                  <p className="text-[10.5px] text-muted-foreground">分界按传统口径，如 3 月 21 日起为白羊座</p>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
