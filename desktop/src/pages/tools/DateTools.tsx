import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Globe,
  History,
  Hourglass,
  RotateCcw,
  RotateCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateField, toDateInput } from '@/components/ui/date-field'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import {
  diffBetween,
  type DateTimeParts,
} from '@matcha-puff/tools'
import { solarToLunar } from '@/lib/time-tools/lunar'
import { runTimeTool, runTimeToolSync } from '@/lib/time-tools/runs'
import { shiftDateTime } from '@/lib/time-tools/timeCalc'
import { cn } from '@/lib/utils'

interface DiffRow {
  unit: string
  label: string
  value: number
  text: string
}

interface LunarDetail {
  text: string
  fullText: string
  animal: string
  ganZhiYear: string
  ganZhiMonth: string
  ganZhiDay: string
  isLeap: boolean
  monthDays: number
  term: string | null
}

interface TimeDiffData {
  rows: DiffRow[]
  humanized: string
  direction: 'future' | 'past' | 'same'
  startText: string
  endText: string
  startLunar: LunarDetail | null
  endLunar: LunarDetail | null
}

type TimeCalcUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'

const TIME_CALC_UNITS: { value: TimeCalcUnit; label: string }[] = [
  { value: 'year', label: '年' },
  { value: 'month', label: '月' },
  { value: 'day', label: '天' },
  { value: 'hour', label: '小时' },
  { value: 'minute', label: '分钟' },
  { value: 'second', label: '秒' },
]

const UNIT_LABELS: Record<TimeCalcUnit, string> = {
  year: '年',
  month: '月',
  day: '天',
  hour: '小时',
  minute: '分钟',
  second: '秒',
}

const pad = (value: number): string => String(value).padStart(2, '0')

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const
const NUMBER_FORMAT = new Intl.NumberFormat('zh-CN')
const formatNumber = (value: number): string => NUMBER_FORMAT.format(value)

/** 起止时刻精确到秒：三段时间都能直接改，计算结果也按秒走 */
interface MomentValue {
  /** 本地零点时间戳，只承载年月日 */
  date: number
  hour: number
  minute: number
  second: number
}

const startOfLocalDay = (ms: number): number => {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const momentFromDate = (date: Date): MomentValue => ({
  date: startOfLocalDay(date.getTime()),
  hour: date.getHours(),
  minute: date.getMinutes(),
  second: date.getSeconds(),
})

const momentNow = (offsetDays = 0): MomentValue => {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return momentFromDate(date)
}

/** 起点与终点共用同一个「现在」基准，默认差值不会带上一两秒的漂移 */
const momentsFromNow = (): { start: MomentValue; end: MomentValue } => {
  const start = new Date()
  const end = new Date(start)
  end.setDate(end.getDate() + 2)
  return { start: momentFromDate(start), end: momentFromDate(end) }
}

/** 会话级草稿：A/B 两个固定日期 + 谁是起点；离开时间页再回来还在，重启回默认 */
interface TimeDiffDraft {
  a: MomentValue
  b: MomentValue
  startIsA: boolean
}

let timeDiffDraft: TimeDiffDraft | null = null

const ensureTimeDiffDraft = (): TimeDiffDraft => {
  if (!timeDiffDraft || !timeDiffDraft.a || !timeDiffDraft.b) {
    const next = momentsFromNow()
    timeDiffDraft = { a: next.start, b: next.end, startIsA: true }
  }
  return timeDiffDraft
}

const momentText = (moment: MomentValue): string =>
  `${toDateInput(moment.date)} ${pad(moment.hour)}:${pad(moment.minute)}:${pad(moment.second)}`

const momentWeekday = (moment: MomentValue): string =>
  WEEKDAY_NAMES[new Date(moment.date).getDay()]

const momentTime = (moment: MomentValue): number => {
  const date = new Date(moment.date)
  date.setHours(moment.hour, moment.minute, moment.second, 0)
  return date.getTime()
}

const momentParts = (moment: MomentValue): DateTimeParts => {
  const date = new Date(moment.date)
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: moment.hour,
    minute: moment.minute,
    second: moment.second,
  }
}

const lunarDetailOf = (moment: MomentValue): LunarDetail | null => {
  const parts = momentParts(moment)
  const lunar = solarToLunar(parts.year, parts.month, parts.day)
  if (!lunar) return null
  return {
    text: lunar.text,
    fullText: lunar.fullText,
    animal: lunar.animal,
    ganZhiYear: lunar.ganZhiYear,
    ganZhiMonth: lunar.ganZhiMonth,
    ganZhiDay: lunar.ganZhiDay,
    isLeap: lunar.isLeap,
    monthDays: lunar.monthDays,
    term: lunar.term,
  }
}

/** 间隔改完后按量级挑一个读起来最自然的单位；年、月仍可手动选 */
const bestUnitOf = (start: MomentValue, end: MomentValue): TimeCalcUnit => {
  const seconds = Math.abs(momentTime(end) - momentTime(start)) / 1000
  if (seconds >= 86_400) return 'day'
  if (seconds >= 3_600) return 'hour'
  if (seconds >= 60) return 'minute'
  return 'second'
}

/** 时、分、秒三个小输入框：失焦或回车提交，方向键微调，避免原生时间面板的样式割裂 */
function TimeTuner({
  hour,
  minute,
  second,
  label,
  disabled = false,
  onChange,
}: {
  hour: number
  minute: number
  second: number
  label: string
  disabled?: boolean
  onChange: (hour: number, minute: number, second: number) => void
}) {
  const [hourText, setHourText] = useState(() => pad(hour))
  const [minuteText, setMinuteText] = useState(() => pad(minute))
  const [secondText, setSecondText] = useState(() => pad(second))

  useEffect(() => setHourText(pad(hour)), [hour])
  useEffect(() => setMinuteText(pad(minute)), [minute])
  useEffect(() => setSecondText(pad(second)), [second])

  const clampPart = (text: string, max: number): number =>
    Math.min(max, Math.max(0, Number(text) || 0))

  const commit = () => {
    const nextHour = clampPart(hourText, 23)
    const nextMinute = clampPart(minuteText, 59)
    const nextSecond = clampPart(secondText, 59)
    setHourText(pad(nextHour))
    setMinuteText(pad(nextMinute))
    setSecondText(pad(nextSecond))
    onChange(nextHour, nextMinute, nextSecond)
  }

  const nudge = (part: 'hour' | 'minute' | 'second', delta: number) => {
    // 用输入框里的文本做基准：还没失焦的数字也要参与方向键微调
    let nextHour = clampPart(hourText, 23)
    let nextMinute = clampPart(minuteText, 59)
    let nextSecond = clampPart(secondText, 59)
    if (part === 'hour') nextHour = (nextHour + delta + 24) % 24
    else if (part === 'minute') nextMinute = (nextMinute + delta + 60) % 60
    else nextSecond = (nextSecond + delta + 60) % 60
    setHourText(pad(nextHour))
    setMinuteText(pad(nextMinute))
    setSecondText(pad(nextSecond))
    onChange(nextHour, nextMinute, nextSecond)
  }

  const inputClass =
    'h-8 w-[2.4ch] rounded-[5px] bg-transparent px-0 text-center outline-none transition-colors selection:bg-primary selection:text-primary-foreground focus:bg-primary/[0.08]'

  const renderPart = (
    part: 'hour' | 'minute' | 'second',
    aria: string,
    text: string,
    setText: (value: string) => void,
  ) => (
    <input
      aria-label={`${label}${aria}`}
      inputMode="numeric"
      disabled={disabled}
      value={text}
      onChange={(event) => setText(event.target.value.replace(/\D/g, '').slice(0, 2))}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          nudge(part, 1)
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          nudge(part, -1)
        }
      }}
      className={inputClass}
    />
  )

  return (
    <span
      className={cn(
        'flex items-center rounded-lg bg-foreground/[0.045] px-2 py-0.5 font-mono text-[20px] leading-none tabular-nums text-foreground transition-colors hover:bg-foreground/[0.07]',
        disabled && 'opacity-50',
      )}
    >
      {renderPart('hour', '小时', hourText, setHourText)}
      <span className="px-0.5 text-muted-foreground/70">:</span>
      {renderPart('minute', '分钟', minuteText, setMinuteText)}
      <span className="px-0.5 text-muted-foreground/70">:</span>
      {renderPart('second', '秒', secondText, setSecondText)}
    </span>
  )
}

function MomentCard({
  slot,
  role,
  moment,
  lunar,
  onChange,
  onNow,
  onSwapRole,
}: {
  slot: 'A' | 'B'
  role: 'start' | 'end'
  moment: MomentValue
  lunar: LunarDetail | null
  onChange: (next: MomentValue) => void
  onNow: () => void
  onSwapRole: () => void
}) {
  return (
    <section className="glass flex min-w-0 flex-col justify-center gap-1.5 rounded-panel px-5 py-3.5">
      <header className="flex items-center gap-2">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/70" />
        <span className="text-[13px] font-medium tracking-[0.08em] text-muted-foreground">
          {slot} 点
        </span>
        <Tip label="点击交换起点和终点">
          <button
            type="button"
            aria-label="交换起点和终点"
            onClick={onSwapRole}
            className={cn(
              'inline-flex h-7 items-center rounded-full px-2.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40',
              role === 'start'
                ? 'bg-primary/10 text-primary hover:bg-primary/15'
                : 'bg-foreground/[0.055] text-foreground/65 hover:bg-foreground/[0.09]',
            )}
          >
            {role === 'start' ? '起点' : '终点'}
          </button>
        </Tip>
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto gap-1 text-[13px] text-muted-foreground hover:text-foreground"
          onClick={onNow}
        >
          <RotateCw className="size-3" />
          现在
        </Button>
      </header>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <DateField
          value={moment.date}
          onChange={(ms) => onChange({ ...moment, date: startOfLocalDay(ms) })}
          ariaLabel={`${slot} 点日期`}
          className="h-9 w-auto rounded-md border-0 px-0 font-mono text-[24px] font-medium tracking-[-0.02em] hover:border-0 hover:bg-foreground/[0.035] focus-visible:bg-primary/[0.06] focus-visible:ring-0"
        />
        <TimeTuner
          hour={moment.hour}
          minute={moment.minute}
          second={moment.second}
          label={`${slot} 点`}
          onChange={(hour, minute, second) => onChange({ ...moment, hour, minute, second })}
        />
      </div>

      <p className="flex min-w-0 items-center gap-1.5 text-[14px] text-muted-foreground">
        <span>{momentWeekday(moment)}</span>
        {lunar ? (
          <>
            <span aria-hidden className="text-muted-foreground/35">
              ·
            </span>
            <span className="truncate">农历{lunar.text}</span>
            <span aria-hidden className="text-muted-foreground/35">
              ·
            </span>
            <span>{lunar.animal}年</span>
          </>
        ) : null}
      </p>
    </section>
  )
}

const ganZhiText = (lunar: LunarDetail | null): string =>
  lunar ? `${lunar.ganZhiYear}年 ${lunar.ganZhiMonth}月 ${lunar.ganZhiDay}日` : '—'

const lunarCopyText = (lunar: LunarDetail): string =>
  `${lunar.fullText}；${lunar.ganZhiYear}年 ${lunar.ganZhiMonth}月 ${lunar.ganZhiDay}日；生肖${lunar.animal}；${
    lunar.isLeap ? '闰月' : '非闰月'
  }；${lunar.monthDays}天${lunar.term ? `；节气${lunar.term}` : ''}`

export function TimeDiffTool() {
  const [pointA, setPointA] = useState<MomentValue>(() => ensureTimeDiffDraft().a)
  const [pointB, setPointB] = useState<MomentValue>(() => ensureTimeDiffDraft().b)
  const [startIsA, setStartIsA] = useState<boolean>(() => ensureTimeDiffDraft().startIsA)
  const [copied, setCopied] = useState(false)
  const [copiedUnit, setCopiedUnit] = useState<string | null>(null)
  const [intervalUnit, setIntervalUnit] = useState<TimeCalcUnit>(() => {
    const draft = ensureTimeDiffDraft()
    const start = draft.startIsA ? draft.a : draft.b
    const end = draft.startIsA ? draft.b : draft.a
    return bestUnitOf(start, end)
  })
  const [intervalDraft, setIntervalDraft] = useState<string | null>(null)

  const start = startIsA ? pointA : pointB
  const end = startIsA ? pointB : pointA

  useEffect(() => {
    timeDiffDraft = { a: pointA, b: pointB, startIsA }
  }, [pointA, pointB, startIsA])

  // 纯计算，首屏同步出结果：切页回来时不再出现文字分批加载
  const diffResult = useMemo(
    () =>
      runTimeToolSync<TimeDiffData>('time-diff', {
        start: momentText(start),
        end: momentText(end),
      }),
    [start, end],
  )
  const data = diffResult.ok ? diffResult.data : null
  const error = diffResult.ok ? null : diffResult.error.message

  const lunarA = useMemo(() => lunarDetailOf(pointA), [pointA])
  const lunarB = useMemo(() => lunarDetailOf(pointB), [pointB])

  const liveDiff = useMemo(
    () => diffBetween(momentParts(start), momentParts(end)),
    [start, end],
  )
  const seconds = liveDiff.seconds
  const absSeconds = Math.abs(seconds)
  let primaryValue = absSeconds
  let primaryUnit = '秒'
  if (absSeconds >= 86_400) {
    primaryValue = Math.floor(absSeconds / 86_400)
    primaryUnit = '天'
  } else if (absSeconds >= 3_600) {
    primaryValue = Math.floor(absSeconds / 3_600)
    primaryUnit = '小时'
  } else if (absSeconds >= 60) {
    primaryValue = Math.floor(absSeconds / 60)
    primaryUnit = '分钟'
  }
  const primaryText = `${formatNumber(primaryValue)} ${primaryUnit}`
  const exactDays = Math.floor(absSeconds / 86_400)
  const exactHours = Math.floor((absSeconds % 86_400) / 3_600)
  const exactMinutes = Math.floor((absSeconds % 3_600) / 60)
  const exactSeconds = absSeconds % 60
  const exactText =
    exactDays > 0
      ? `${formatNumber(exactDays)} 天 ${exactHours} 小时 ${exactMinutes} 分 ${exactSeconds} 秒`
      : exactHours > 0
        ? `${exactHours} 小时 ${exactMinutes} 分 ${exactSeconds} 秒`
        : exactMinutes > 0
          ? `${exactMinutes} 分 ${exactSeconds} 秒`
          : `${exactSeconds} 秒`
  const approxText = data ? data.humanized.replace(/^早\s*/, '') : ''
  // 只有按周/月/年折算时才有补充意义；几天以内直接用精确分解
  const showApprox = Boolean(data && absSeconds >= 7 * 86_400 && approxText && approxText !== primaryText)
  const direction = seconds === 0 ? 'same' : seconds > 0 ? 'future' : 'past'
  const directionWord = direction === 'past' ? '已过去' : direction === 'future' ? '还有' : '同一时刻'
  const DirectionIcon = direction === 'past' ? History : direction === 'future' ? Hourglass : ArrowLeftRight

  const unitValue = Math.abs(
    intervalUnit === 'year'
      ? liveDiff.years
      : intervalUnit === 'month'
        ? liveDiff.months
        : intervalUnit === 'day'
          ? liveDiff.days
          : intervalUnit === 'hour'
            ? liveDiff.hours
            : intervalUnit === 'minute'
              ? liveDiff.minutes
              : liveDiff.seconds,
  )
  const intervalText = intervalDraft ?? String(unitValue)

  const reset = () => {
    const next = momentsFromNow()
    timeDiffDraft = { a: next.start, b: next.end, startIsA: true }
    setPointA(next.start)
    setPointB(next.end)
    setStartIsA(true)
    setIntervalUnit('day')
    setIntervalDraft(null)
    setCopied(false)
  }

  /** 改 A/B 本身：日期原地变，角色不跟着换；单位也保持用户当前选择 */
  const changePointA = (next: MomentValue) => {
    setPointA(next)
    setIntervalDraft(null)
  }

  const changePointB = (next: MomentValue) => {
    setPointB(next)
    setIntervalDraft(null)
  }

  /** 只交换起点/终点角色，A/B 的日期完全不动 */
  const swapRoles = () => {
    setStartIsA((value) => !value)
    setIntervalDraft(null)
  }

  const changeUnit = (next: TimeCalcUnit) => {
    setIntervalUnit(next)
    setIntervalDraft(null)
  }

  const updateInterval = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 6)
    if (cleaned && Number(cleaned) > 100_000) return
    setIntervalDraft(cleaned)
    if (!cleaned) return
    const value = Number(cleaned)
    // 起点角色固定，只动终点；方向沿用当前终点相对起点的前后关系
    const sign = seconds < 0 ? -1 : 1
    const target = shiftDateTime(momentParts(start), sign * value, intervalUnit)
    const next = new Date(
      target.year,
      target.month - 1,
      target.day,
      target.hour,
      target.minute,
      target.second,
    )
    if (Number.isNaN(next.getTime())) return
    if (startIsA) setPointB(momentFromDate(next))
    else setPointA(momentFromDate(next))
    setCopied(false)
  }

  const copySummary = async () => {
    if (!data) return
    const headline =
      direction === 'same' ? '起点与终点是同一时刻' : `${directionWord} ${primaryText}`
    const lines = [
      headline,
      `精确到秒：${exactText}`,
      showApprox ? `约 ${approxText}` : '',
      `起点：${momentText(start)} ${momentWeekday(start)}${data.startLunar ? ` · 农历${data.startLunar.text}` : ''}`,
      `终点：${momentText(end)} ${momentWeekday(end)}${data.endLunar ? ` · 农历${data.endLunar.text}` : ''}`,
      '',
      ...data.rows.map((row) => `${row.label}：${formatNumber(Math.abs(row.value))}`),
      data.startLunar ? `起点农历：${lunarCopyText(data.startLunar)}` : '',
      data.endLunar ? `终点农历：${lunarCopyText(data.endLunar)}` : '',
    ].filter(Boolean)
    try {
      await copyText(lines.join('\n'))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const unitLabelOf = (row: DiffRow) => (row.unit === 'minute' ? '分钟' : row.label)
  const maxUnitValueLength = data
    ? Math.max(...data.rows.map((row) => formatNumber(Math.abs(row.value)).length))
    : 0
  /** 所有单位共用一档字号：最大的一项不溢出时保持统一，撑不下时整体降一档 */
  const unitValueClass =
    maxUnitValueLength >= 12
      ? 'text-[12px]'
      : maxUnitValueLength >= 10
        ? 'text-[14px]'
        : maxUnitValueLength >= 8
          ? 'text-[15px]'
          : 'text-[17px]'

  const copyUnit = async (row: DiffRow) => {
    try {
      await copyText(`${formatNumber(Math.abs(row.value))} ${unitLabelOf(row)}`)
      setCopiedUnit(row.unit)
      window.setTimeout(
        () => setCopiedUnit((current) => (current === row.unit ? null : current)),
        1400,
      )
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const renderUnit = (row: DiffRow) => {
    const valueText = formatNumber(Math.abs(row.value))
    const label = unitLabelOf(row)
    return (
      <Tip
        key={row.unit}
        label={
          row.unit === 'month' || row.unit === 'year'
            ? `${label} ${valueText} · 按满整计算，点击复制`
            : `${label} ${valueText} · 点击复制`
        }
      >
        <button
          type="button"
          aria-label={`复制${label}数值`}
          onClick={() => void copyUnit(row)}
          className="group flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-lg border border-border/45 bg-background/35 px-3 py-1.5 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.05]"
        >
          <span className="flex w-full items-center gap-1 whitespace-nowrap text-[13px] leading-4 text-muted-foreground">
            {label}
            {copiedUnit === row.unit ? (
              <Check aria-hidden className="ml-auto size-3 text-success" />
            ) : (
              <Copy
                aria-hidden
                className="ml-auto size-3 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
              />
            )}
          </span>
          <span
            className={cn(
              'mt-0.5 w-full whitespace-nowrap leading-tight tabular-nums text-foreground',
              unitValueClass,
            )}
          >
            {valueText}
          </span>
        </button>
      </Tip>
    )
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 scroll-thin">
      <div className="grid shrink-0 grid-cols-2 items-stretch gap-3">
        <MomentCard
          slot="A"
          role={startIsA ? 'start' : 'end'}
          moment={pointA}
          lunar={lunarA}
          onChange={changePointA}
          onNow={() => changePointA(momentNow())}
          onSwapRole={swapRoles}
        />
        <MomentCard
          slot="B"
          role={startIsA ? 'end' : 'start'}
          moment={pointB}
          lunar={lunarB}
          onChange={changePointB}
          onNow={() => changePointB(momentNow())}
          onSwapRole={swapRoles}
        />
      </div>

      {/* 压缩窗口高度时先吃掉中间卡片的留白，内容完整保留，触底后才交给外层滚动 */}
      <section className="glass relative flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-panel px-7 py-5">
        <header className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13.5px] font-medium',
              direction === 'future'
                ? 'bg-primary/10 text-primary'
                : 'bg-foreground/[0.055] text-foreground/70',
            )}
          >
            <DirectionIcon className="size-3.5" aria-hidden />
            {directionWord}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <Tip label="重置为当前时间与两天后">
              <Button variant="ghost" size="icon-sm" aria-label="重置" onClick={reset}>
                <RotateCcw />
              </Button>
            </Tip>
            <Tip label={copied ? '已复制' : '复制结果'}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="复制结果"
                disabled={!data}
                onClick={() => void copySummary()}
              >
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
            </Tip>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2">
          <div className="flex flex-wrap items-baseline justify-center gap-x-2">
            <div className="flex items-baseline justify-center rounded-2xl border border-primary/35 bg-primary/[0.06] px-5 py-2 transition-colors hover:border-primary/50 hover:bg-primary/[0.075] focus-within:border-primary/55 focus-within:bg-primary/[0.085]">
              <input
                aria-label="修改时间间隔"
                inputMode="numeric"
                value={intervalText}
                onChange={(event) => updateInterval(event.target.value)}
                onFocus={(event) => {
                  setIntervalDraft(String(unitValue))
                  event.currentTarget.select()
                }}
                onBlur={() => setIntervalDraft(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
                style={{ width: `${Math.max(intervalText.length, 1) + 0.25}ch` }}
                className="min-w-[1ch] max-w-full border-0 bg-transparent p-0 text-center text-[68px] font-medium leading-none tracking-[-0.04em] tabular-nums text-foreground outline-none selection:bg-primary selection:text-primary-foreground"
              />
            </div>
            <span className="text-[26px] font-medium text-foreground/65">
              {UNIT_LABELS[intervalUnit]}
            </span>
          </div>
          <SlidingSegmented
            options={TIME_CALC_UNITS}
            value={intervalUnit}
            onValueChange={changeUnit}
            size="sm"
            ariaLabel="间隔单位"
          />
          <div className="flex min-h-[24px] w-full items-center justify-center px-2">
            <p className="max-w-full text-center text-[14.5px] leading-6 tabular-nums">
              <span className="text-foreground/80">{exactText}</span>
              {showApprox ? (
                <>
                  {' '}
                  <Tip label="按天粗略折算">
                    <span className="text-muted-foreground">≈ {approxText}</span>
                  </Tip>
                </>
              ) : null}
            </p>
          </div>
          {error ? <p className="text-[13px] leading-5 text-destructive">{error}</p> : null}
        </div>
      </section>

      <div className="grid h-[192px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3">
        <section className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-panel p-3.5">
          <header className="flex items-center gap-2">
            <Clock3 className="size-4 text-primary" aria-hidden />
            <h2 className="text-[14.5px] font-medium text-foreground">单位换算</h2>
          </header>
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5">
              {data?.rows.slice(0, 3).map((row) => renderUnit(row))}
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-4 gap-1.5">
              {data?.rows.slice(3, 7).map((row) => renderUnit(row))}
            </div>
          </div>
        </section>

        <section className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-panel p-3.5">
          <header className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" aria-hidden />
            <h2 className="text-[14px] font-medium text-foreground">农历详情</h2>
          </header>
          <div className="mt-2 grid min-h-0 flex-1 grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)] grid-rows-7 text-[12.5px] leading-[18px]">
            <span />
            <span className="flex items-center gap-1.5 whitespace-nowrap pr-3 text-muted-foreground">
              <span aria-hidden className="size-1 rounded-full bg-primary/55" />
              起点
            </span>
            <span className="flex items-center gap-1.5 whitespace-nowrap border-l border-border/40 pl-3 text-muted-foreground">
              <span aria-hidden className="size-1 rounded-full bg-primary/55" />
              终点
            </span>
            {[
              {
                label: '农历',
                start: data?.startLunar?.fullText ?? '—',
                end: data?.endLunar?.fullText ?? '—',
              },
              {
                label: '干支',
                start: ganZhiText(data?.startLunar ?? null),
                end: ganZhiText(data?.endLunar ?? null),
              },
              {
                label: '生肖',
                start: data?.startLunar?.animal ?? '—',
                end: data?.endLunar?.animal ?? '—',
              },
              {
                label: '节气',
                start: data?.startLunar?.term ?? '—',
                end: data?.endLunar?.term ?? '—',
              },
              {
                label: '闰月',
                start: data?.startLunar ? (data.startLunar.isLeap ? '是' : '否') : '—',
                end: data?.endLunar ? (data.endLunar.isLeap ? '是' : '否') : '—',
              },
              {
                label: '月天数',
                start: data?.startLunar ? `${data.startLunar.monthDays} 天` : '—',
                end: data?.endLunar ? `${data.endLunar.monthDays} 天` : '—',
              },
            ].map((row) => (
              <Fragment key={row.label}>
                <span className="flex items-center whitespace-nowrap pr-2 text-muted-foreground/80">
                  {row.label}
                </span>
                <span className="flex min-w-0 items-center whitespace-nowrap pr-3 text-foreground">
                  {row.start}
                </span>
                <span className="flex min-w-0 items-center whitespace-nowrap border-l border-border/40 pl-3 text-foreground">
                  {row.end}
                </span>
              </Fragment>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

interface ZoneView {
  label: string
  offsetLabel: string
  offset: number
  places: string[]
  date: string
  time: string
  weekday: string
  dayShift: number
  isLocal: boolean
}

const formatZoneDate = (date: string): string => {
  const [year, month, day] = date.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}

export function ClockTool() {
  const [follow, setFollow] = useState(true)
  const [base, setBase] = useState<MomentValue>(() => momentNow())
  const [clock, setClock] = useState<MomentValue>(() => momentNow())
  const [zones, setZones] = useState<ZoneView[]>([])
  const [error, setError] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const heroRef = useRef<HTMLElement | null>(null)

  const localOffset = useMemo(() => -new Date().getTimezoneOffset() / 60, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const local = follow ? momentNow() : base
      if (follow) setClock(local)
      const result = await runTimeTool<{ zones: Omit<ZoneView, 'isLocal'>[] }>('clock', {
        base: momentText(local),
      })
      if (!alive) return
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setError(null)
      setZones(
        result.data.zones.map((zone) => ({
          ...zone,
          isLocal: zone.offset === localOffset,
        })),
      )
    }
    void load()
    const timer = follow ? window.setInterval(() => void load(), 1000) : null
    return () => {
      alive = false
      if (timer !== null) window.clearInterval(timer)
    }
  }, [follow, base, localOffset])

  // 本机时区置顶，随后按时区顺序继续，绕过东十二区后从西十二区接上
  const ordered = useMemo(() => {
    const index = zones.findIndex((zone) => zone.offset === localOffset)
    if (index <= 0) return zones
    return [...zones.slice(index), ...zones.slice(0, index)]
  }, [zones, localOffset])
  const localZone = ordered.find((zone) => zone.isLocal) ?? null
  const otherZones = localZone ? ordered.filter((zone) => !zone.isLocal) : ordered
  // 只有跨日徽标变化会改变换行行数，秒级刷新不触发重测
  const shiftKey = ordered.map((zone) => zone.dayShift).join(',')

  // 卡片统一高度：量出当前列宽下最高的那张卡，其余卡片撑到同一高度，内容不截断
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    let lastWidth = -1
    const fitCards = () => {
      const width = grid.clientWidth
      // 网格内容宽度（已扣掉滚动条），置顶卡按同一宽度收齐，避免比下方卡片宽出一截
      if (!width) return
      if (heroRef.current) heroRef.current.style.width = `${width}px`
      if (width === lastWidth) return

      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-zone-card]'))
      if (!cards.length) return
      lastWidth = width
      cards.forEach((card) => {
        card.style.height = 'auto'
      })
      const tallest = Math.max(...cards.map((card) => card.getBoundingClientRect().height))
      cards.forEach((card) => {
        card.style.height = `${Math.ceil(tallest)}px`
      })
    }
    fitCards()
    const observer = new ResizeObserver(fitCards)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [zones.length, base, follow, error, shiftKey])

  const toggleFollow = () => {
    // 切到手动时锁住点击这一瞬（带秒），切回实时立刻刷新
    if (follow) setBase(momentNow())
    else setClock(momentNow())
    setFollow((current) => !current)
  }

  const display = follow ? clock : base

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <Clock3 className="size-3.5 text-primary/80" aria-hidden />
          基准时间
        </span>
        <DateField
          value={display.date}
          onChange={(ms) => setBase({ ...base, date: startOfLocalDay(ms) })}
          disabled={follow}
          ariaLabel="基准日期"
          className="h-8 w-auto rounded-md border-0 px-1.5 font-mono text-[18px] font-medium tracking-tight hover:border-0 hover:bg-foreground/[0.035] focus-visible:bg-primary/[0.06] focus-visible:ring-0"
        />
        <TimeTuner
          hour={display.hour}
          minute={display.minute}
          second={display.second}
          label="基准时间"
          disabled={follow}
          onChange={(hour, minute, second) => setBase({ ...base, hour, minute, second })}
        />
        <Tip label={follow ? '切换为手动指定时间' : '切换为跟随本机时间'}>
          <Button
            variant={follow ? 'default' : 'outline'}
            size="xs"
            aria-label="跟随本机时间"
            onClick={toggleFollow}
          >
            <RotateCw className={cn('size-3.5', follow && 'animate-spin [animation-duration:3s]')} />
            {follow ? '实时' : '手动'}
          </Button>
        </Tip>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>
      ) : ordered.length ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {localZone ? (
            <section
              ref={heroRef}
              className="glass flex shrink-0 flex-wrap items-center gap-x-7 gap-y-3 rounded-panel px-5 py-3.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Globe className="size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[17px] font-semibold leading-tight text-foreground">
                      {localZone.label}
                    </h2>
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      本机时区
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11.5px] tabular-nums text-muted-foreground">
                    {localZone.offsetLabel}
                  </p>
                </div>
              </div>
              <p className="font-mono text-[34px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                {localZone.time}
              </p>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex items-baseline gap-2">
                  <span className="text-[14px] font-semibold tabular-nums text-foreground">
                    {formatZoneDate(localZone.date)}
                  </span>
                  <span className="text-[13px] font-medium text-foreground">
                    {localZone.weekday}
                  </span>
                </p>
                <p className="text-[13px] leading-[1.5] text-foreground/85">
                  {localZone.places.join(' · ')}
                </p>
              </div>
            </section>
          ) : null}
          <div
            ref={gridRef}
            className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(258px,1fr))] content-start gap-3 overflow-auto pb-1 scroll-thin"
          >
            {otherZones.map((zone) => {
            const shift =
              zone.dayShift === 0
                ? null
                : zone.dayShift > 0
                  ? { text: '明天', className: 'border-success/35 bg-success-bg text-success' }
                  : { text: '昨天', className: 'border-warning/35 bg-warning-bg text-warning' }
            return (
              <article
                key={zone.offsetLabel}
                data-zone-card
                className="glass flex min-w-0 flex-col justify-between gap-3 rounded-panel px-4 py-3.5"
              >
                <header className="flex items-center gap-2">
                  <Globe className="size-4 shrink-0 text-primary" aria-hidden />
                  <h3 className="truncate text-[15px] font-semibold text-foreground">{zone.label}</h3>
                  <span className="ml-auto shrink-0 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                    {zone.offsetLabel}
                  </span>
                </header>
                <div className="flex flex-col gap-2.5">
                  <p className="font-mono text-[30px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                    {zone.time}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-semibold tabular-nums text-foreground">
                      {formatZoneDate(zone.date)}
                    </span>
                    <span className="text-[13px] font-medium text-foreground">{zone.weekday}</span>
                    {shift ? (
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                          shift.className,
                        )}
                      >
                        {shift.text}
                      </span>
                    ) : null}
                  </div>
                </div>
                {zone.places.length ? (
                  <p className="border-t border-border/60 pt-2 text-[12px] leading-[1.5] text-foreground/80">
                    {zone.places.join(' · ')}
                  </p>
                ) : null}
              </article>
            )
            })}
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground">正在读取时区…</p>
      )}
    </main>
  )
}
