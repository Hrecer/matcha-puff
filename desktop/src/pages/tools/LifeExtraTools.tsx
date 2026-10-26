import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { AlignCenter, AlignLeft, AlignRight, Bold, Cake, Clock3, Download, ImagePlus, Italic, Loader2, Pause, Pencil, Play, RotateCcw, Sparkles, Underline } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateField, fromDateInput } from '@/components/ui/date-field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberField } from '@/components/ui/number-field'
import { SelectField } from '@/components/ui/select-field'
import { SlidingSegmented } from '@/components/ui/sliding'
import { toast } from '@/components/ui/toast'
import { saveDialog, writeFileBytes } from '@/ipc/bridge'
import { parseBirthday, saveLifeProfile, useLifeProfile } from '@/lib/life-profile'
import { useSessionState } from '@/lib/session-state'
import { copyText } from '@/lib/clipboard'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { lunarToSolar, solarToLunar } from '@/lib/time-tools/lunar'
import { runTimeToolSync } from '@/lib/time-tools/runs'
import { cn } from '@/lib/utils'

interface RestOfLifeOutput {
  birthday: string
  today: string
  age: number
  lifeExpectancy: number
  yearsLived: number
  monthsLived: number
  weeksLived: number
  daysLived: number
  hoursLived: number
  minutesLived: number
  daysLeft: number
  weeksLeft: number
  percentLived: number
  percentLeft: number
  nextBirthday: { date: string; days: number }
  weekendsLived: number
}

const EDIT_CONFIRM_TEXT = '确认修改'

const toDateInput = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const formatNumber = (value: number): string => value.toLocaleString('zh-CN')

const WEEKDAY_TEXT = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const zodiacOf = (month: number, day: number): string => {
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return '水瓶座'
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return '双鱼座'
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return '白羊座'
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return '金牛座'
  if ((month === 5 && day >= 21) || (month === 6 && day <= 21)) return '双子座'
  if ((month === 6 && day >= 22) || (month === 7 && day <= 22)) return '巨蟹座'
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return '狮子座'
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return '处女座'
  if ((month === 9 && day >= 23) || (month === 10 && day <= 23)) return '天秤座'
  if ((month === 10 && day >= 24) || (month === 11 && day <= 22)) return '天蝎座'
  if ((month === 11 && day >= 23) || (month === 12 && day <= 21)) return '射手座'
  return '摩羯座'
}

const BIRTHDAY_FESTIVALS: { name: string; month: number; day: number; lunar?: boolean }[] = [
  { name: '元旦', month: 1, day: 1 },
  { name: '情人节', month: 2, day: 14 },
  { name: '春节', month: 1, day: 1, lunar: true },
  { name: '元宵节', month: 1, day: 15, lunar: true },
  { name: '端午节', month: 5, day: 5, lunar: true },
  { name: '七夕', month: 7, day: 7, lunar: true },
  { name: '中秋节', month: 8, day: 15, lunar: true },
  { name: '国庆节', month: 10, day: 1 },
  { name: '圣诞节', month: 12, day: 25 },
]

const festivalOn = (year: number, month: number, day: number): string | null => {
  for (const item of BIRTHDAY_FESTIVALS) {
    if (item.lunar) {
      const solar = lunarToSolar(year, item.month, item.day)
      if (solar && solar.month === month && solar.day === day) return item.name
    } else if (item.month === month && item.day === day) {
      return item.name
    }
  }
  return null
}

/** 人生面板：全局生日 + 预期寿命/参照日期 + 生日倒计时 + 档案与累计 */
export function RestOfLifeTool() {
  const profile = useLifeProfile()
  const birthday = profile?.birthday ?? ''
  const birthdayParts = useMemo(() => parseBirthday(birthday), [birthday])
  const [referenceDate, setReferenceDate] = useSessionState('life/reference-date', '')
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [draftBirthday, setDraftBirthday] = useState('')
  const [draftLife, setDraftLife] = useState('80')
  const [confirmText, setConfirmText] = useState('')
  const [saving, setSaving] = useState(false)

  const lifeExpectancy = profile?.lifeExpectancy ?? 80
  const lifeValid = Number.isFinite(lifeExpectancy) && lifeExpectancy >= 1 && lifeExpectancy <= 150

  const diff = useMemo(() => {
    if (!birthday || !lifeValid) return null
    return runTimeToolSync<RestOfLifeOutput>('rest-of-life', {
      birthday,
      lifeExpectancy,
      ...(referenceDate ? { from: referenceDate } : {}),
    })
  }, [birthday, lifeExpectancy, lifeValid, referenceDate])

  const data = diff?.ok ? diff.data : null
  const error = !birthday
    ? null
    : !lifeValid
      ? '预期寿命需在 1–150 之间'
      : diff && !diff.ok
        ? diff.error.message
        : null

  const birthdayLunar = useMemo(
    () =>
      birthdayParts
        ? solarToLunar(birthdayParts.year, birthdayParts.month, birthdayParts.day)
        : null,
    [birthdayParts],
  )

  const countdown = useMemo(() => {
    if (!data) return null
    const [ny, nm, nd] = data.nextBirthday.date.split('-').map(Number)
    const next = new Date(ny, nm - 1, nd)
    const prev = new Date(ny - 1, nm - 1, nd)
    // 2 月 29 日在平年回落到 2 月 28
    if (prev.getMonth() !== nm - 1) prev.setDate(0)
    const [ty, tm, td] = data.today.split('-').map(Number)
    const todayMs = new Date(ty, tm - 1, td).getTime()
    const span = next.getTime() - prev.getTime()
    const percent =
      span > 0
        ? Math.min(100, Math.max(0, ((todayMs - prev.getTime()) / span) * 100))
        : 100
    return { percent }
  }, [data])

  const nextBirthdayMeta = useMemo(() => {
    if (!data) return null
    const [year, month, day] = data.nextBirthday.date.split('-').map(Number)
    return {
      weekday: WEEKDAY_TEXT[new Date(year, month - 1, day).getDay()],
      lunar: solarToLunar(year, month, day)?.text ?? '',
    }
  }, [data])

  const festival =
    data && birthdayParts
      ? festivalOn(
          Number(data.nextBirthday.date.slice(0, 4)),
          birthdayParts.month,
          birthdayParts.day,
        )
      : null
  const isBirthdayToday = Boolean(data && birthday && data.today.slice(5) === birthday.slice(5))
  const greeting = isBirthdayToday
    ? festival
      ? `${festival}快乐，生日快乐！`
      : '生日快乐！'
    : null
  const zodiac = birthdayParts ? zodiacOf(birthdayParts.month, birthdayParts.day) : '—'
  const birthdayWeekday = birthdayParts
    ? WEEKDAY_TEXT[
        new Date(birthdayParts.year, birthdayParts.month - 1, birthdayParts.day).getDay()
      ]
    : '—'

  const openEditor = () => {
    setDraftBirthday(birthday)
    setDraftLife(String(lifeExpectancy))
    setConfirmText('')
    setConfirmOpen(false)
    setEditOpen(true)
  }

  const draftLifeValid =
    Number.isFinite(Number(draftLife)) && Number(draftLife) >= 1 && Number(draftLife) <= 150
  const draftBirthdayValid = Boolean(parseBirthday(draftBirthday))
  const fieldsValid = Boolean(profile) && draftBirthdayValid && draftLifeValid
  const canConfirm = fieldsValid && confirmText.trim() === EDIT_CONFIRM_TEXT && !saving

  const openConfirm = () => {
    if (!fieldsValid) return
    setConfirmText('')
    setConfirmOpen(true)
  }

  const saveProfile = async () => {
    if (!canConfirm) return
    setSaving(true)
    try {
      await saveLifeProfile({ birthday: draftBirthday, lifeExpectancy: Number(draftLife) })
      setConfirmOpen(false)
      setEditOpen(false)
      toast('人生档案已更新')
    } catch {
      toast('保存失败，请检查存储权限', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 scroll-thin">
      <section className="glass flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2.5 rounded-panel px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Cake className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tabular-nums text-foreground">
              {profile === null ? '正在读取生日…' : birthday || '还没有设置生日'}
            </p>
            <p className="text-[11px] text-muted-foreground">人生档案</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rounded-full bg-background/40 px-2.5 py-1 text-[11.5px] text-muted-foreground">
            预期寿命{' '}
            <strong className="font-mono font-medium tabular-nums text-foreground">
              {profile === null ? '—' : lifeExpectancy}
            </strong>{' '}
            岁
          </span>
          <label className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            参照
            <DateField
              value={fromDateInput(referenceDate)}
              onChange={(ms) => setReferenceDate(ms > 0 ? toDateInput(ms) : '')}
              min={birthday ? fromDateInput(birthday) : undefined}
              placeholder="今天"
              ariaLabel="参照日期"
              className="h-7 w-[112px] rounded-full border-0 bg-background/40 px-2 text-[11.5px] text-foreground hover:bg-background/60 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </label>
          <Button variant="outline" size="sm" onClick={openEditor} disabled={!profile}>
            <Pencil className="size-3.5" aria-hidden />
            编辑
          </Button>
        </div>
      </section>

      {profile === null ? (
        <p className="py-12 text-center text-[12px] text-muted-foreground">正在读取生日…</p>
      ) : !birthday ? (
        <section className="glass flex min-h-[320px] flex-1 items-center justify-center rounded-panel">
          <Empty
            icon={Cake}
            title="还没有设置生日"
            description="先告诉我你来到世界的那一天，往后的日子，我们一起慢慢数。"
            action={
              <Button size="sm" onClick={openEditor}>
                设置生日
              </Button>
            }
          />
        </section>
      ) : error ? (
        <section className="glass flex min-h-[320px] flex-1 items-center justify-center rounded-panel">
          <Empty icon={Cake} title="暂时算不出来" description={error} />
        </section>
      ) : data ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {greeting ? (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-[13px] font-medium text-primary">
              <Sparkles className="size-4" aria-hidden />
              {greeting}
            </div>
          ) : null}

          <section className="glass rounded-panel p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11.5px] text-muted-foreground">人生进度</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-[44px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                    {data.percentLived}%
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">
                    已度过 · 剩余 {data.percentLeft}%
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11.5px] text-muted-foreground">周岁</p>
                <p className="mt-1 font-mono text-[28px] font-semibold leading-none tabular-nums text-foreground">
                  {data.age}
                  <span className="ml-1 text-[12.5px] font-normal text-muted-foreground">岁</span>
                </p>
              </div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, data.percentLived)}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
              <div className="rounded-md bg-background/40 px-2.5 py-1.5">
                <p className="text-[10.5px] text-muted-foreground">剩余</p>
                <p className="mt-0.5 font-mono tabular-nums text-foreground">
                  {formatNumber(data.daysLeft)} 天
                </p>
              </div>
              <div className="rounded-md bg-background/40 px-2.5 py-1.5">
                <p className="text-[10.5px] text-muted-foreground">剩余周数</p>
                <p className="mt-0.5 font-mono tabular-nums text-foreground">
                  {formatNumber(data.weeksLeft)} 周
                </p>
              </div>
              <div className="rounded-md bg-background/40 px-2.5 py-1.5">
                <p className="text-[10.5px] text-muted-foreground">已过周末</p>
                <p className="mt-0.5 font-mono tabular-nums text-foreground">
                  约 {formatNumber(data.weekendsLived)} 天
                </p>
              </div>
            </div>
          </section>

          <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-3">
            <section className="glass flex min-w-0 flex-col rounded-panel p-4">
              <header className="flex items-center gap-2">
                <Cake className="size-4 shrink-0 text-primary" aria-hidden />
                <h2 className="text-[13.5px] font-medium text-foreground">下一个生日</h2>
                <span className="ml-auto whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                  {data.nextBirthday.date}
                </span>
              </header>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-mono text-[38px] font-semibold leading-none tabular-nums text-foreground">
                  {data.nextBirthday.days === 0 ? '今天' : formatNumber(data.nextBirthday.days)}
                </span>
                {data.nextBirthday.days > 0 ? (
                  <span className="text-[13px] text-muted-foreground">天后</span>
                ) : null}
              </div>
              {nextBirthdayMeta ? (
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  {nextBirthdayMeta.weekday}
                  {nextBirthdayMeta.lunar ? ` · 农历${nextBirthdayMeta.lunar}` : ''}
                </p>
              ) : null}
              <div className="mt-auto pt-4">
                <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${countdown?.percent ?? 0}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                  {data.nextBirthday.days === 0
                    ? '今天生日'
                    : `本岁已过 ${Math.round(countdown?.percent ?? 0)}%`}
                  {festival ? ` · 这次生日恰逢${festival}` : ''}
                </p>
              </div>
            </section>

            <section className="glass flex min-w-0 flex-col rounded-panel p-4">
              <header className="flex items-center gap-2">
                <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
                <h2 className="text-[13.5px] font-medium text-foreground">生日档案</h2>
              </header>
              <dl className="mt-2 flex flex-1 flex-col justify-center gap-1 text-[12px]">
                {[
                  { label: '公历', value: birthday || '—' },
                  { label: '农历', value: birthdayLunar ? `农历${birthdayLunar.fullText}` : '—' },
                  { label: '生肖', value: birthdayLunar?.animal ?? '—' },
                  { label: '星座', value: zodiac },
                  { label: '出生星期', value: birthdayWeekday },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1 last:border-0"
                  >
                    <dt className="shrink-0 text-[10.5px] text-muted-foreground">{item.label}</dt>
                    <dd
                      className={cn(
                        'min-w-0 truncate text-right text-foreground',
                        item.label === '公历' && 'font-mono tabular-nums',
                      )}
                      title={item.value}
                    >
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="glass flex min-w-0 flex-col rounded-panel p-4">
              <header className="flex items-center gap-2">
                <Clock3 className="size-4 shrink-0 text-primary" aria-hidden />
                <h2 className="text-[13.5px] font-medium text-foreground">已经度过</h2>
                <span className="ml-auto whitespace-nowrap text-[10px] text-muted-foreground">
                  从出生日累计
                </span>
              </header>
              <dl className="mt-2 flex flex-1 flex-col justify-center gap-1 text-[12px]">
                {[
                  { label: '年', value: data.yearsLived },
                  { label: '月', value: data.monthsLived },
                  { label: '周', value: data.weeksLived },
                  { label: '日', value: data.daysLived },
                  { label: '时', value: data.hoursLived },
                  { label: '分', value: data.minutesLived },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1 last:border-0"
                  >
                    <dt className="shrink-0 text-[10.5px] text-muted-foreground">{item.label}</dt>
                    <dd
                      className="min-w-0 truncate font-mono text-[14px] tabular-nums text-foreground"
                      title={formatNumber(item.value)}
                    >
                      {formatNumber(item.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      ) : (
        <p className="py-12 text-center text-[12px] text-muted-foreground">正在计算…</p>
      )}

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditOpen(false)
            setConfirmOpen(false)
            setConfirmText('')
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto scroll-thin">
          <DialogHeader>
            <DialogTitle>编辑人生档案</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="life-birthday">生日</Label>
              <DateField
                id="life-birthday"
                value={fromDateInput(draftBirthday)}
                onChange={(ms) => setDraftBirthday(ms > 0 ? toDateInput(ms) : '')}
                max={Date.now()}
                inline
                ariaLabel="生日"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="life-expectancy">预期寿命（周岁）</Label>
              <NumberField
                id="life-expectancy"
                min={1}
                max={150}
                value={Number(draftLife)}
                onChange={(next) => setDraftLife(String(next))}
                className="font-mono tabular-nums"
              />
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              保存后会写入全局档案；日历与人生进度会随之更新。
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false)
                setConfirmOpen(false)
              }}
            >
              取消
            </Button>
            <Button disabled={!fieldsValid} onClick={openConfirm}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmOpen(false)
            setConfirmText('')
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认修改人生档案</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-background/40 px-3 py-2 text-[12px] leading-5">
              <p>
                生日：
                <span className="font-mono tabular-nums text-foreground">{draftBirthday}</span>
              </p>
              <p>
                预期寿命：
                <span className="font-mono tabular-nums text-foreground">{draftLife} 岁</span>
              </p>
            </div>
            <div className="rounded-lg bg-warning-bg px-3 py-2 text-[11.5px] leading-5 text-warning">
              生日和预期寿命会写入全局档案，并影响日历与人生进度。
            </div>
            <p className="text-[12.5px] font-medium text-foreground">
              请输入「{EDIT_CONFIRM_TEXT}」确认修改：
            </p>
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={EDIT_CONFIRM_TEXT}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmOpen(false)
                setConfirmText('')
              }}
            >
              取消
            </Button>
            <Button disabled={!canConfirm} onClick={() => void saveProfile()}>
              {saving ? '保存中…' : '确认保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

interface StrokeOrderOutput {
  total: number
  totalStrokes: number
  skipped: string
  chars: {
    char: string
    strokes: number
    names: string[]
    shapes: string[]
    text: string
  }[]
}

type StrokeMode = 'step' | 'animation' | 'describe'

interface StrokeWriter {
  pauseAnimation: () => void
  resumeAnimation: () => void
  restartAnimation: () => void
  startAnimation: () => boolean
}

const STROKE_MODES = [
  { value: 'step', label: '笔顺步骤' },
  { value: 'animation', label: '笔顺动画' },
  { value: 'describe', label: '笔顺描写' },
]

/** 汉字笔顺：三种 cnchar.draw 模式 + 笔顺名称列表 */
export function CharStrokeOrderTool() {
  const Icon = pluginIcon('char-stroke-order')
  const [text, setText] = useState('')
  const [mode, setMode] = useState<StrokeMode>('step')
  const [data, setData] = useState<StrokeOrderOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [testStatus, setTestStatus] = useState('')
  const [redrawKey, setRedrawKey] = useState(0)
  const drawRef = useRef<HTMLDivElement | null>(null)
  const writerRef = useRef<StrokeWriter | null>(null)

  useEffect(() => {
    const value = text.trim()
    if (!value) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      void runTool<StrokeOrderOutput>('char-stroke-order', { text: value }).then((result) => {
        if (!alive) return
        setLoading(false)
        if (result.ok) {
          setData(result.data)
          setError(null)
        } else {
          setData(null)
          setError(result.error.message)
        }
      })
    }, 280)
    return () => {
      alive = false
      setLoading(false)
      window.clearTimeout(timer)
    }
  }, [text])

  useEffect(() => {
    const el = drawRef.current
    const chars = data?.chars.map((item) => item.char).join('') ?? ''
    if (!el || !chars) return
    let alive = true
    setTestStatus(mode === 'describe' ? '按笔顺在字上描写，写错会有提示' : '')
    setPlaying(mode === 'animation')

    void (async () => {
      try {
        const [{ default: cnchar }, { default: drawPlugin }] = await Promise.all([
          import('cnchar'),
          import('cnchar-draw'),
        ])
        if (!alive || !drawRef.current) return
        if (!cnchar.hasPlugin('draw')) cnchar.use(drawPlugin)
        drawRef.current.innerHTML = ''

        const style = {
          length: 120,
          padding: 10,
          backgroundColor: 'transparent',
          strokeColor: '#5f9e78',
          outlineColor: '#c9d6ce',
          currentColor: '#5f9e78',
        }

        const writer =
          mode === 'animation'
            ? cnchar.draw(chars, {
                el: drawRef.current,
                type: cnchar.draw.TYPE.ANIMATION,
                clear: true,
                style,
                animation: {
                  loopAnimate: true,
                  strokeAnimationSpeed: 1,
                  delayBetweenStrokes: 500,
                  delayBetweenLoops: 1200,
                },
              })
            : mode === 'describe'
              ? cnchar.draw(chars, {
                  el: drawRef.current,
                  type: cnchar.draw.TYPE.TEST,
                  clear: true,
                  style: { ...style, showOutline: true },
                  test: {
                    drawingColor: '#4f7a63',
                    highlightColor: '#a7c4b2',
                    showHintAfterMisses: 2,
                    onTestStatus: (status) => {
                      if (status.status === 'complete') setTestStatus('描写完成，可以点「重新描写」再来一次')
                      else if (status.status === 'mistake') setTestStatus('笔顺或方向不对，再试一次')
                      else setTestStatus('继续按笔顺描写')
                    },
                  },
                })
              : cnchar.draw(chars, {
                  el: drawRef.current,
                  type: cnchar.draw.TYPE.STROKE,
                  clear: true,
                  style,
                })

        if (!alive) return
        writerRef.current = (writer as StrokeWriter | null) ?? null
      } catch {
        setPlaying(false)
        setError('当前环境不支持绘制笔顺，请升级桌面端后重试')
      }
    })()

    return () => {
      alive = false
      // 只有 animation 模式写入了动画控制器，step/test 调 pause 会抛错
      if (mode === 'animation') writerRef.current?.pauseAnimation()
      writerRef.current = null
    }
  }, [data, mode, redrawKey])

  const togglePlay = () => {
    const writer = writerRef.current
    if (!writer) return
    if (playing) {
      writer.pauseAnimation()
      setPlaying(false)
    } else {
      writer.resumeAnimation()
      setPlaying(true)
    }
  }

  const replay = () => {
    if (mode === 'animation' && writerRef.current) {
      writerRef.current.restartAnimation()
      setPlaying(true)
      return
    }
    setRedrawKey((value) => value + 1)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <section className="glass flex shrink-0 flex-wrap items-center gap-2 rounded-panel p-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="text-[10.5px] text-muted-foreground">汉字（可输入多字）</span>
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="例如：抹茶泡芙"
            spellCheck={false}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] text-muted-foreground">展示方式</span>
          <SlidingSegmented
            options={STROKE_MODES}
            value={mode}
            onValueChange={(value) => setMode(value as StrokeMode)}
            size="sm"
            ariaLabel="笔顺展示方式"
          />
        </div>
        <span className="ml-auto flex items-center gap-1 text-[10.5px] text-muted-foreground">
          {loading ? <Loader2 className="size-3 animate-spin" /> : null}
          {data ? `${data.total} 个字 · 共 ${data.totalStrokes} 画` : '仅支持汉字'}
        </span>
      </section>

      {error ? (
        <p className="shrink-0 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] leading-5 text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_290px] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Icon className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">
              {mode === 'step' ? '笔顺步骤' : mode === 'animation' ? '笔顺动画（循环）' : '笔顺描写'}
            </h2>
            {mode === 'describe' && testStatus ? (
              <span className="truncate text-[10.5px] text-muted-foreground">{testStatus}</span>
            ) : null}
            <span className="ml-auto flex items-center gap-1">
              {mode === 'animation' ? (
                <Button variant="secondary" size="sm" onClick={togglePlay} disabled={!data}>
                  {playing ? <Pause /> : <Play />}
                  {playing ? '暂停' : '播放'}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={replay} disabled={!data}>
                <RotateCcw />
                {mode === 'describe' ? '重新描写' : '重播'}
              </Button>
            </span>
          </header>

          <div className="mt-2 flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md border border-dashed border-border/60 p-3 scroll-thin">
            {data ? (
              <div ref={drawRef} className="flex min-h-[280px] w-full flex-wrap items-center justify-center gap-2" />
            ) : (
              <Empty
                size="sm"
                icon={Icon}
                title={loading ? '正在查询…' : '等待输入'}
                description={
                  loading ? '查笔顺后会直接画在这里。' : '输入汉字，选择笔顺步骤、循环动画或描写练习。'
                }
              />
            )}
          </div>
          {mode === 'describe' && data ? (
            <p className="mt-2 shrink-0 text-[10.5px] text-muted-foreground">
              描写模式会显示字形轮廓，按正确笔顺书写即可；写错时会有高亮提示。
            </p>
          ) : null}
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">笔画名称</h2>
            {data?.skipped ? (
              <span className="ml-auto truncate text-[10px] text-muted-foreground">跳过 {data.skipped}</span>
            ) : null}
          </header>
          <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1 scroll-thin">
            {!data ? (
              <p className="py-8 text-center text-[11px] text-muted-foreground">查询后逐字列出笔顺</p>
            ) : (
              data.chars.map((item, index) => (
                <article
                  key={`${item.char}-${index}`}
                  className="mb-2 rounded-md border border-border/50 bg-background/40 px-2.5 py-2 last:mb-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[22px] leading-7 text-foreground">{item.char}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{item.strokes} 画</span>
                    <button
                      type="button"
                      onClick={() => {
                        void copyText(`${item.char}：${item.text}`).then(
                          () => toast('已复制作业笔顺'),
                          () => toast('复制失败', 'error'),
                        )
                      }}
                      className="ml-auto text-[10.5px] text-primary hover:underline"
                    >
                      复制
                    </button>
                  </div>
                  <p className="mt-1 font-mono text-[15px] leading-7 tracking-[0.28em] text-foreground">
                    {item.shapes.join('')}
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-5 text-muted-foreground">{item.text}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export function Text2ImageTool() {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [hasContent, setHasContent] = useState(true)

  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.innerHTML = '<div style="font-weight:500">抹茶泡芙</div><div>当前文字图片由 <span style="color:#2563eb">抹茶泡芙</span> 生成</div>'
  }, [])

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
  }

  const insertImage = (dataUrl: string) => {
    editorRef.current?.focus()
    document.execCommand('insertImage', false, dataUrl)
    setHasContent(true)
  }

  const readImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => insertImage(String(reader.result ?? ''))
    reader.onerror = () => toast('读取图片失败', 'error')
    reader.readAsDataURL(file)
  }

  const save = async () => {
    const editor = editorRef.current
    if (!editor || busy) return
    if (!editor.innerText.trim() && !editor.querySelector('img')) {
      toast('先输入文字或粘贴图片', 'error')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await toPng(editor, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      })
      const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
      const bytes = Array.from({ length: binary.length }, (_, index) => binary.charCodeAt(index))
      const path = await saveDialog({
        defaultPath: '文字图片.png',
        filters: [{ name: '图片', extensions: ['png'] }],
      })
      if (!path) return
      await writeFileBytes(path, bytes)
      toast('图片已保存')
    } catch (error) {
      toast(error instanceof Error ? `保存失败：${error.message}` : '保存失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="shrink-0 text-[11.5px] leading-5 text-muted-foreground">
        富文本编辑：可加粗、改字号/颜色、插图，也支持直接粘贴图片；点「保存 PNG」按编辑区实际内容截图。
      </p>

      <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-md border border-border/60 bg-card/40 p-1.5">
        {[
          { label: '加粗', icon: Bold, run: () => exec('bold') },
          { label: '斜体', icon: Italic, run: () => exec('italic') },
          { label: '下划线', icon: Underline, run: () => exec('underline') },
          { label: '左对齐', icon: AlignLeft, run: () => exec('justifyLeft') },
          { label: '居中', icon: AlignCenter, run: () => exec('justifyCenter') },
          { label: '右对齐', icon: AlignRight, run: () => exec('justifyRight') },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            aria-label={item.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={item.run}
            className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <item.icon className="size-3.5" aria-hidden />
          </button>
        ))}
        <SelectField
          defaultValue="3"
          onValueChange={(value) => exec('fontSize', value)}
          options={[1, 2, 3, 4, 5, 6, 7].map((size) => ({ value: String(size), label: `${size} 号` }))}
          ariaLabel="字号"
          size="sm"
          className="h-7 px-1.5 text-[11px]"
        />
        <label className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
          颜色
          <input type="color" defaultValue="#111111" onChange={(event) => exec('foreColor', event.target.value)} className="h-6 w-7 cursor-pointer rounded border border-border/60 bg-transparent p-0" />
        </label>
        <button
          type="button"
          title="插入图片"
          aria-label="插入图片"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <ImagePlus className="size-3.5" aria-hidden />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) readImage(file)
            event.target.value = ''
          }}
        />
        <Button size="sm" className="ml-auto gap-1.5" disabled={busy} onClick={() => void save()}>
          {busy ? <Loader2 className="animate-spin" /> : <Download className="size-3.5" aria-hidden />}
          保存 PNG
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border border-border/60 bg-white p-1 scroll-thin">
        {!hasContent ? (
          <p className="pointer-events-none absolute left-6 top-6 text-sm text-zinc-400">
            在此输入需要生成图片的文字，或直接 Ctrl+V 粘贴图片…
          </p>
        ) : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setHasContent(Boolean(editorRef.current?.innerText.trim() || editorRef.current?.querySelector('img')))}
          onPaste={(event) => {
            const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith('image/'))
            const file = item?.getAsFile()
            if (file) {
              event.preventDefault()
              readImage(file)
            }
          }}
          className="min-h-full w-full rounded-md bg-white p-6 text-[16px] leading-relaxed text-zinc-900 outline-none [&_img]:max-w-full [&_img]:rounded"
        />
      </div>
    </main>
  )
}
