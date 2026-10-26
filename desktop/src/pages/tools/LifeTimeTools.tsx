import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Check, Copy, Flag, Minus, Pause, Play, Plus, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { FormWorkbench } from './shared/FormWorkbench'

interface IdCardData {
  valid: boolean
  error: string | null
  normalized: string
  address: string
  birthday: string
  gender: string
  age: number
  constellation: string
  checkDigit: string
}

export function IdCardTool() {
  return (
    <FormWorkbench<IdCardData>
      toolId="id-card"
      hint="按 GB/T 2260 行政区划码解析地区，按校验位规则验真伪；15 位老身份证也能查。"
      formTitle="身份证号"
      runLabel="查询"
      emptyTitle="等待查询"
      emptyDescription="输入身份证号后查询。"
      example={{ id: '11010519491231002X' }}
      fields={[{ key: 'id', label: '身份证号', type: 'text', placeholder: '18 位或 15 位', wide: true }]}
      toText={(data) =>
        [
          `身份证号：${data.normalized}`,
          `地区：${data.address}`,
          `生日：${data.birthday}`,
          `性别：${data.gender}　年龄：${data.age}`,
          `星座：${data.constellation}`,
        ].join('\n')
      }
      renderResult={(data) =>
        data.valid ? (
          <div className="flex h-full flex-col gap-2">
            <p className="rounded-md bg-primary/[0.08] px-3 py-2 font-mono text-[12px] tabular-nums text-primary">
              {data.normalized}
            </p>
            <dl className="grid grid-cols-2 gap-2">
              {[
                { label: '地区', value: data.address || '—' },
                { label: '生日', value: data.birthday },
                { label: '性别', value: data.gender },
                { label: '年龄', value: `${data.age} 岁` },
                { label: '星座', value: data.constellation },
                { label: '校验位', value: data.checkDigit },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5">
                  <dt className="text-[10px] text-muted-foreground">{item.label}</dt>
                  <dd className="mt-0.5 text-[12.5px] text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] leading-5 text-destructive">
            {data.error ?? '身份证号无效'}
          </p>
        )
      }
    />
  )
}

/** 时:分:秒.厘秒，超过 60 分钟自动进位到小时 */
const formatClock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  const centiseconds = Math.floor((total % 1000) / 10)
  const clock = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
  return `${clock}.${String(centiseconds).padStart(2, '0')}`
}

const STOPWATCH_DIGIT_CLASS =
  'font-mono text-[66px] font-medium leading-none tabular-nums text-foreground'

export function StopwatchTool() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [laps, setLaps] = useState<number[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const startedAt = useRef(0)
  const baseElapsed = useRef(0)

  const copyLap = async (text: string) => {
    try {
      await copyText(text)
      setCopied(text)
      window.setTimeout(() => setCopied((current) => (current === text ? null : current)), 1200)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  useEffect(() => {
    if (!running) return
    let frame = 0
    const tick = () => {
      setElapsed(baseElapsed.current + (Date.now() - startedAt.current))
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [running])

  const start = () => {
    startedAt.current = Date.now()
    setRunning(true)
  }

  const pause = () => {
    if (!running) return
    const total = baseElapsed.current + (Date.now() - startedAt.current)
    baseElapsed.current = total
    setElapsed(total)
    setRunning(false)
  }

  const addLap = () => {
    const previous = laps.reduce((sum, item) => sum + item, 0)
    setLaps((current) => [...current, Math.max(0, elapsed - previous)])
  }

  const reset = () => {
    setRunning(false)
    setElapsed(0)
    setLaps([])
    baseElapsed.current = 0
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      <section className="glass flex min-h-0 flex-1 flex-col rounded-panel p-3">
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
              <p className={cn('text-center', STOPWATCH_DIGIT_CLASS)}>{formatClock(elapsed)}</p>

              {running || elapsed > 0 ? (
                <div className="flex shrink-0 items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={addLap} disabled={!running}>
                    <Flag />
                    计圈
                  </Button>
                  {running ? (
                    <Button size="sm" onClick={pause}>
                      <Pause />
                      暂停
                    </Button>
                  ) : (
                    <Button size="sm" onClick={start}>
                      <Play />
                      继续
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={reset}>
                    <RotateCcw />
                    重置
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={start}>
                  <Play />
                  开始
                </Button>
              )}
            </div>

            <div
              className={cn(
                'shrink-0 overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                laps.length > 0 ? 'h-[calc(46%_+_42px)]' : 'h-0',
              )}
            >
              <div className="h-full overflow-y-auto pr-0.5 scroll-thin">
                {laps.map((lap, index) => (
                  <div
                    key={index}
                    className="mb-1 flex items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5 last:mb-0"
                  >
                    <span className="w-10 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      #{index + 1}
                    </span>
                    <span className="shrink-0 font-sans text-[13px] tabular-nums text-foreground">
                      {formatClock(
                        laps.slice(0, index + 1).reduce((sum, value) => sum + value, 0),
                      )}
                    </span>
                    <span className="ml-auto shrink-0 font-sans text-[13px] tabular-nums text-muted-foreground">
                      <span className="text-muted-foreground/70">+</span>
                      {formatClock(lap)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`复制计圈 ${index + 1}`}
                      onClick={() => void copyLap(formatClock(lap))}
                    >
                      {copied === formatClock(lap) ? <Check /> : <Copy />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </section>
    </main>
  )
}

const pad2 = (value: number) => String(value).padStart(2, '0')

const formatClockTime = (date: Date) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`

const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

const WHEEL_ITEM_HEIGHT = 52
const WHEEL_VISIBLE = 5
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE
const WHEEL_COLUMN_WIDTH = 96
const WHEEL_SEPARATOR_WIDTH = 28
const WHEEL_ROW_COUNT = 15
const WHEEL_ROW_CENTER = (WHEEL_ROW_COUNT - 1) / 2
const WHEEL_SPRING_STIFFNESS = 280
const WHEEL_SPRING_DAMPING = 34
const WHEEL_WHEEL_STEP_PX = 100
const WHEEL_FLING_PROJECTION = 0.18
const WHEEL_SNAP_DELAY_MS = 140
const RING_SIZE = 420
const RING_RADIUS = 198
const RING_STROKE = 9
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const TIMER_PRIMARY_BUTTON = 'h-12 min-w-48 text-[17px] [&_svg]:size-5'
const TIMER_SECONDARY_BUTTON = 'h-12 min-w-36 px-5 text-[16px] [&_svg]:size-[18px]'
const TIME_DIGIT_CLASS =
  'font-mono text-[44px] font-medium leading-none tabular-nums text-foreground'
const TIMER_PRESETS = [1, 3, 5, 10, 15, 30]
/** 会话级草稿：切页回来还在，重启应用回到 0 */
const timerDraft = { hours: 0, minutes: 0, seconds: 0 }

const clampWheel = (value: number, max: number): number => Math.min(max, Math.max(0, value))

const wrapWheel = (index: number, count: number): number => ((index % count) + count) % count

/** 与滚轮选中行完全同宽、同字号的时分秒读数 */
function TimeReadout({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center">
      {text.split(':').map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span
              aria-hidden
              className="flex items-center justify-center font-mono text-[32px] text-muted-foreground/60"
              style={{ width: WHEEL_SEPARATOR_WIDTH }}
            >
              :
            </span>
          ) : null}
          <span
            className={cn('text-center', TIME_DIGIT_CLASS)}
            style={{ width: WHEEL_COLUMN_WIDTH }}
          >
            {part}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

interface WheelColumnProps {
  label: string
  value: number
  max: number
  disabled?: boolean
  onChange: (next: number) => void
}

/**
 * 时分秒滚轮：不用原生滚动，位移由 transform + rAF 弹簧驱动。
 * 滚轮/拖拽只改变目标位置，松手后按速度甩动、磁吸到整数；索引取模实现无限循环。
 */
function WheelColumn({ label, value, max, disabled = false, onChange }: WheelColumnProps) {
  const count = max + 1
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const engineRef = useRef({
    pos: value,
    velocity: 0,
    target: value,
    frame: 0,
    lastFrame: 0,
    paintedBase: Number.NaN,
  })
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const disabledRef = useRef(disabled)
  const userDrivenRef = useRef(false)
  const editingRef = useRef(false)
  const cancelEditRef = useRef(false)
  const snapTimerRef = useRef<number | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startY: number
    startPos: number
    lastY: number
    lastTime: number
    velocity: number
    moved: boolean
  } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const paint = () => {
    const engine = engineRef.current
    const base = Math.round(engine.pos)
    const baseChanged = base !== engine.paintedBase
    if (baseChanged) engine.paintedBase = base
    for (let index = 0; index < WHEEL_ROW_COUNT; index += 1) {
      const row = rowRefs.current[index]
      if (!row) continue
      const logical = base + index - WHEEL_ROW_CENTER
      if (baseChanged) row.textContent = pad2(wrapWheel(logical, count))
      const distance = logical - engine.pos
      const proximity = Math.max(0, 1 - Math.abs(distance))
      row.style.transform = `translate3d(0, ${distance * WHEEL_ITEM_HEIGHT}px, 0) scale(${0.5 + proximity * 0.5})`
      row.style.opacity = String(0.34 + proximity * 0.66)
      row.style.zIndex = String(Math.round(proximity * 10))
    }
    if (baseChanged && userDrivenRef.current) {
      const next = wrapWheel(base, count)
      if (next !== valueRef.current) {
        valueRef.current = next
        onChangeRef.current(next)
      }
    }
  }

  const clearSnapTimer = () => {
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current)
      snapTimerRef.current = null
    }
  }

  const stopFrame = () => {
    const engine = engineRef.current
    if (engine.frame) window.cancelAnimationFrame(engine.frame)
    engine.frame = 0
    engine.lastFrame = 0
  }

  const step = (timestamp: number) => {
    const engine = engineRef.current
    const dt = engine.lastFrame
      ? Math.min(0.032, Math.max(0.001, (timestamp - engine.lastFrame) / 1000))
      : 1 / 60
    engine.lastFrame = timestamp
    const acceleration =
      (engine.target - engine.pos) * WHEEL_SPRING_STIFFNESS - engine.velocity * WHEEL_SPRING_DAMPING
    engine.velocity += acceleration * dt
    engine.pos += engine.velocity * dt
    paint()
    if (Math.abs(engine.target - engine.pos) < 0.0015 && Math.abs(engine.velocity) < 0.02) {
      engine.pos = engine.target
      engine.velocity = 0
      engine.frame = 0
      engine.lastFrame = 0
      paint()
      userDrivenRef.current = false
      const next = wrapWheel(Math.round(engine.pos), count)
      if (next !== valueRef.current) {
        valueRef.current = next
        onChangeRef.current(next)
      }
      return
    }
    engine.frame = window.requestAnimationFrame(step)
  }

  const startFrame = () => {
    const engine = engineRef.current
    if (engine.frame) return
    engine.lastFrame = 0
    engine.frame = window.requestAnimationFrame(step)
  }

  const scheduleSnap = () => {
    clearSnapTimer()
    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null
      const engine = engineRef.current
      engine.target = Math.round(engine.target)
      startFrame()
    }, WHEEL_SNAP_DELAY_MS)
  }

  useLayoutEffect(() => {
    paint()
    return () => {
      stopFrame()
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    onChangeRef.current = onChange
    disabledRef.current = disabled
  })

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const handleWheel = (event: WheelEvent) => {
      if (disabledRef.current || editingRef.current) return
      event.preventDefault()
      event.stopPropagation()
      clearSnapTimer()
      let pixels = event.deltaY
      if (event.deltaMode === 1) pixels *= 16
      else if (event.deltaMode === 2) pixels *= WHEEL_HEIGHT
      const steps = Math.max(-4, Math.min(4, pixels / WHEEL_WHEEL_STEP_PX))
      if (!steps) return
      userDrivenRef.current = true
      engineRef.current.target += steps
      startFrame()
      scheduleSnap()
    }
    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max])

  useEffect(() => {
    if (value === valueRef.current) return
    valueRef.current = value
    userDrivenRef.current = false
    clearSnapTimer()
    const engine = engineRef.current
    engine.velocity = 0
    engine.target = value + count * Math.round((engine.pos - value) / count)
    startFrame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, max])

  const beginEdit = () => {
    if (disabledRef.current) return
    const engine = engineRef.current
    clearSnapTimer()
    stopFrame()
    engine.pos = Math.round(engine.pos)
    engine.target = engine.pos
    engine.velocity = 0
    paint()
    setDraft(pad2(wrapWheel(engine.pos, count)))
    editingRef.current = true
    setEditing(true)
  }

  const finishEdit = (nextValue?: number) => {
    if (!editingRef.current) return
    editingRef.current = false
    setEditing(false)
    if (nextValue === undefined) return
    const engine = engineRef.current
    const nearest = nextValue + count * Math.round((engine.pos - nextValue) / count)
    engine.pos = nearest
    engine.target = nearest
    engine.velocity = 0
    paint()
    userDrivenRef.current = false
    const previous = valueRef.current
    valueRef.current = nextValue
    if (nextValue !== previous) onChangeRef.current(nextValue)
  }

  const commitEdit = () => {
    if (!editingRef.current) return
    if (cancelEditRef.current) {
      cancelEditRef.current = false
      finishEdit()
      return
    }
    const current = wrapWheel(Math.round(engineRef.current.pos), count)
    const parsed = Number.parseInt(draft, 10)
    finishEdit(clampWheel(Number.isFinite(parsed) ? parsed : current, max))
  }

  const nudge = (offset: number) => {
    clearSnapTimer()
    userDrivenRef.current = true
    const engine = engineRef.current
    engine.target = Math.round(engine.target) + offset
    startFrame()
  }

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabledRef.current || editingRef.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const viewport = viewportRef.current
    if (!viewport) return
    clearSnapTimer()
    stopFrame()
    userDrivenRef.current = true
    viewport.focus({ preventScroll: true })
    viewport.setPointerCapture(event.pointerId)
    const engine = engineRef.current
    engine.velocity = 0
    engine.target = engine.pos
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPos: engine.pos,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      moved: false,
    }
  }

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const engine = engineRef.current
    const deltaY = drag.startY - event.clientY
    if (Math.abs(deltaY) > 4) drag.moved = true
    engine.pos = drag.startPos + deltaY / WHEEL_ITEM_HEIGHT
    const now = performance.now()
    const dt = Math.max(1, now - drag.lastTime) / 1000
    const instant = (drag.lastY - event.clientY) / WHEEL_ITEM_HEIGHT / dt
    drag.velocity = drag.velocity * 0.6 + instant * 0.4
    drag.lastY = event.clientY
    drag.lastTime = now
    paint()
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    const viewport = viewportRef.current
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
    const engine = engineRef.current
    if (!drag.moved) {
      const rect = viewport?.getBoundingClientRect()
      if (!rect) return
      const offset = (event.clientY - (rect.top + rect.height / 2)) / WHEEL_ITEM_HEIGHT
      if (Math.abs(offset) < 0.5) {
        beginEdit()
        return
      }
      engine.target = Math.round(engine.pos + offset)
      engine.velocity = 0
      startFrame()
      return
    }
    const idle = performance.now() - drag.lastTime
    const velocity = idle > 120 ? 0 : Math.max(-40, Math.min(40, drag.velocity))
    engine.target = Math.round(engine.pos + velocity * WHEEL_FLING_PROJECTION)
    engine.velocity = velocity
    startFrame()
  }

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    const engine = engineRef.current
    engine.target = Math.round(engine.pos)
    engine.velocity = 0
    startFrame()
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: WHEEL_COLUMN_WIDTH, height: WHEEL_HEIGHT }}>
        <div
          ref={viewportRef}
          role="spinbutton"
          aria-label={label}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          onKeyDown={(event) => {
            if (disabled) return
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              nudge(1)
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              nudge(-1)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              beginEdit()
            }
          }}
          className={cn(
            'relative h-full touch-none select-none overflow-hidden outline-none transition-opacity',
            'cursor-grab focus-visible:ring-2 focus-visible:ring-primary/25 active:cursor-grabbing',
            '[mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]',
            '[-webkit-mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]',
            disabled && 'pointer-events-none opacity-50',
            editing && 'opacity-0',
          )}
        >
          {Array.from({ length: WHEEL_ROW_COUNT }, (_, index) => (
            <div
              key={index}
              ref={(element) => {
                rowRefs.current[index] = element
              }}
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-x-0 top-1/2 flex items-center justify-center will-change-transform',
                TIME_DIGIT_CLASS,
              )}
              style={{ height: WHEEL_ITEM_HEIGHT, marginTop: -WHEEL_ITEM_HEIGHT / 2 }}
            />
          ))}
        </div>

        {editing ? (
          <input
            autoFocus
            value={draft}
            inputMode="numeric"
            aria-label={`输入${label}数`}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, '').slice(0, 2))}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={commitEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitEdit()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancelEditRef.current = true
                finishEdit()
              }
            }}
            className="absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 rounded-lg border border-primary/40 bg-background/95 py-1.5 text-center font-mono text-[40px] font-medium tabular-nums text-foreground shadow-sm outline-none"
          />
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label={`减少${label}`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(clampWheel(value - 1, max))}
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-30"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="w-5 text-center text-[13px] text-muted-foreground">{label}</span>
        <button
          type="button"
          aria-label={`增加${label}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(clampWheel(value + 1, max))}
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-30"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function TimerWheels({
  hours,
  minutes,
  seconds,
  disabled,
  onChange,
}: {
  hours: number
  minutes: number
  seconds: number
  disabled?: boolean
  onChange: (part: 'hours' | 'minutes' | 'seconds', next: number) => void
}) {
  return (
    <div className="relative flex justify-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 rounded-xl border border-primary/15 bg-primary/[0.05]"
        style={{ top: (WHEEL_HEIGHT - 64) / 2, height: 64 }}
      />
      <div className="relative z-10 flex items-start">
        <WheelColumn
          label="时"
          value={hours}
          max={23}
          disabled={disabled}
          onChange={(next) => onChange('hours', next)}
        />
        <span
          className="flex items-center justify-center font-mono text-[32px] text-muted-foreground/60"
          style={{ width: WHEEL_SEPARATOR_WIDTH, height: WHEEL_HEIGHT }}
          aria-hidden
        >
          :
        </span>
        <WheelColumn
          label="分"
          value={minutes}
          max={59}
          disabled={disabled}
          onChange={(next) => onChange('minutes', next)}
        />
        <span
          className="flex items-center justify-center font-mono text-[32px] text-muted-foreground/60"
          style={{ width: WHEEL_SEPARATOR_WIDTH, height: WHEEL_HEIGHT }}
          aria-hidden
        >
          :
        </span>
        <WheelColumn
          label="秒"
          value={seconds}
          max={59}
          disabled={disabled}
          onChange={(next) => onChange('seconds', next)}
        />
      </div>
    </div>
  )
}

type TimerPhase = 'idle' | 'running' | 'paused' | 'ringing'

export function TimerTool() {
  const [hours, setHours] = useState(() => timerDraft.hours)
  const [minutes, setMinutes] = useState(() => timerDraft.minutes)
  const [seconds, setSeconds] = useState(() => timerDraft.seconds)
  const [phase, setPhase] = useState<TimerPhase>('idle')
  const [remaining, setRemaining] = useState(0)
  const [duration, setDuration] = useState(0)
  const [now, setNow] = useState(Date.now())
  const endAtRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000
  const running = phase === 'running'
  const remainMs = running ? Math.max(0, endAtRef.current - now) : remaining
  const ringProgress =
    phase === 'ringing' ? 1 : duration > 0 ? Math.min(1, remainMs / duration) : 0

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!running || remainMs > 0) return
    setPhase('ringing')
    setRemaining(0)
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = 0
      void audio.play().catch(() => {})
    }
  }, [running, remainMs])

  useEffect(
    () => () => {
      audioRef.current?.pause()
    },
    [],
  )

  const applySelection = (nextHours: number, nextMinutes: number, nextSeconds: number) => {
    timerDraft.hours = nextHours
    timerDraft.minutes = nextMinutes
    timerDraft.seconds = nextSeconds
    setHours(nextHours)
    setMinutes(nextMinutes)
    setSeconds(nextSeconds)
  }

  const setPart = (part: 'hours' | 'minutes' | 'seconds', next: number) => {
    timerDraft[part] = next
    if (part === 'hours') setHours(next)
    else if (part === 'minutes') setMinutes(next)
    else setSeconds(next)
  }

  const start = () => {
    if (phase === 'paused') {
      if (remaining <= 0) return
      endAtRef.current = Date.now() + remaining
      setNow(Date.now())
      setPhase('running')
      return
    }
    if (phase === 'ringing' || totalMs <= 0) return
    const audio =
      audioRef.current ?? new Audio(`${import.meta.env.BASE_URL}audio/pomodoro/notify/alarm.mp3`)
    audio.pause()
    audio.currentTime = 0
    audio.loop = true
    audio.preload = 'auto'
    audioRef.current = audio
    endAtRef.current = Date.now() + totalMs
    setNow(Date.now())
    setDuration(totalMs)
    setRemaining(totalMs)
    setPhase('running')
  }

  const pause = () => {
    if (!running) return
    setRemaining(Math.max(0, endAtRef.current - Date.now()))
    setPhase('paused')
  }

  const addMinute = () => {
    setDuration((current) => current + 60_000)
    if (running) {
      endAtRef.current += 60_000
      setNow(Date.now())
    } else if (phase === 'paused') {
      setRemaining((current) => current + 60_000)
    }
  }

  const reset = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    endAtRef.current = 0
    setPhase('idle')
    setRemaining(0)
    setDuration(0)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      {phase === 'idle' ? (
        <section className="glass flex min-h-0 flex-1 flex-col overflow-y-auto rounded-panel px-6 py-6 scroll-thin">
          <div className="my-auto flex w-full flex-col items-center">
            <div
              className="flex w-full flex-col items-center justify-center gap-6"
              style={{ height: RING_SIZE }}
            >
              <div className="flex flex-wrap items-center justify-center">
                <div className="flex items-center rounded-full border border-primary/25 bg-primary/[0.07] p-1 shadow-sm">
                  {TIMER_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applySelection(0, preset, 0)}
                      className="h-9 min-w-[78px] rounded-full px-3.5 text-[14px] font-medium tabular-nums text-foreground transition-colors hover:bg-primary/10 hover:text-primary active:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      {preset} 分钟
                    </button>
                  ))}
                  <span aria-hidden className="mx-1.5 h-5 w-px bg-primary/20" />
                  <Tip label="重置为 0 分钟">
                    <button
                      type="button"
                      aria-label="重置为 0 分钟"
                      onClick={() => applySelection(0, 0, 0)}
                      className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15 active:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <RotateCcw className="size-4" aria-hidden />
                    </button>
                  </Tip>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <TimerWheels hours={hours} minutes={minutes} seconds={seconds} onChange={setPart} />
                {/* 平衡上方预设的高度，让选中时间与圆环时间落在同一垂直中心 */}
                <div aria-hidden className="h-7" />
              </div>
            </div>

            <div className="mt-5 flex w-full flex-col items-center gap-2.5">
              <Button
                size="lg"
                className={TIMER_PRIMARY_BUTTON}
                disabled={totalMs <= 0}
                onClick={start}
              >
                <Play />
                开始
              </Button>
              <p className="flex h-6 items-center text-[16px] font-medium tabular-nums text-foreground/75">
                {totalMs > 0 ? `${formatClockTime(new Date(Date.now() + totalMs))} 结束` : ''}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="glass flex min-h-0 flex-1 flex-col overflow-y-auto rounded-panel px-6 py-6 scroll-thin">
          <div className="my-auto flex w-full flex-col items-center">
            <div className="flex w-full items-center justify-center" style={{ height: RING_SIZE }}>
              <div className="relative grid place-items-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
                <svg
                  className="absolute inset-0 -rotate-90"
                  width={RING_SIZE}
                  height={RING_SIZE}
                  viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                  aria-hidden
                >
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={RING_STROKE}
                    className="text-foreground/[0.06]"
                  />
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={RING_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={RING_CIRCUMFERENCE * (1 - ringProgress)}
                    className="text-primary transition-[stroke-dashoffset] duration-200 ease-linear"
                  />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {phase === 'ringing' ? (
                    <p className="text-[40px] font-semibold leading-none text-foreground">时间到</p>
                  ) : (
                    <TimeReadout text={formatDuration(remainMs)} />
                  )}
                </div>
                <p className="pointer-events-none absolute left-1/2 top-[calc(50%+34px)] -translate-x-1/2 whitespace-nowrap text-[16px] font-medium tabular-nums text-foreground/75">
                  {phase === 'ringing'
                    ? `本次计时 ${formatDuration(duration)}`
                    : phase === 'paused'
                      ? '已暂停'
                      : `${formatClockTime(new Date(endAtRef.current))} 结束`}
                </p>
              </div>
            </div>

            <div className="mt-5 flex w-full flex-col items-center gap-2.5">
              {phase === 'ringing' ? (
                <Button size="lg" className={TIMER_PRIMARY_BUTTON} onClick={reset}>
                  <Square />
                  停止
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-2.5">
                  <Button
                    variant="secondary"
                    size="lg"
                    className={TIMER_SECONDARY_BUTTON}
                    onClick={addMinute}
                  >
                    <Plus />
                    1 分钟
                  </Button>
                  {phase === 'paused' ? (
                    <Button size="lg" className={TIMER_PRIMARY_BUTTON} onClick={start}>
                      <Play />
                      继续
                    </Button>
                  ) : (
                    <Button size="lg" className={TIMER_PRIMARY_BUTTON} onClick={pause}>
                      <Pause />
                      暂停
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="lg"
                    className={TIMER_SECONDARY_BUTTON}
                    onClick={reset}
                  >
                    <RotateCcw />
                    重置
                  </Button>
                </div>
              )}
              <div aria-hidden className="h-6" />
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

