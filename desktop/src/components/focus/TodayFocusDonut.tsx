import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cn } from 'cn'
import { UNSET_TASK_COLOR } from '@/components/focus/calendar-utils'

export interface TodayFocusItem {
  id: string
  name: string
  seconds: number
  color: string
  /** 有明确归属、且当前任务/习惯仍存在时才可跳转 */
  kind?: 'task' | 'habit'
}

const H = 300
const BASE_W = 480
const MAX_OUTER_R = 92
const OUTER_WIDTH_RATIO = 22 / 92
const INNER_R_RATIO = 58 / 92
const INNER_WIDTH_RATIO = 14 / 58
/** 引线从圆环外缘先沿径向探出的一小段 */
const LEADER_TICK = 9
/** 径向段之后留出的水平/垂直段长度，用来反推圆环半径 */
const LEADER_MIN = 14
const LABEL_MARGIN = 4
const LABEL_GAP = 4
/** 引线贴到标签边时，离圆角留出的余量 */
const EDGE_INSET = 6
const DAY_SECONDS = 24 * 60 * 60
const TAU = Math.PI * 2

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function shortDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${rest}m`
}

interface LabelLayout {
  item: TodayFocusItem
  frac: number
  start: number
  startX: number
  startY: number
  tickX: number
  tickY: number
  lx: number
  ly: number
  width: number
  height: number
  percent: number
}

/** 估算实际渲染行数，只用于分栏时避让；卡片高度本身由内容撑开 */
function estimateLabelHeight(name: string, labelW: number): number {
  const charsPerLine = Math.max(4, Math.floor((labelW - 22) / 10))
  const lines = Math.min(3, Math.max(1, Math.ceil(name.length / charsPerLine)))
  return 19 + lines * 14
}

/**
 * 常规饼图引线：扇区外缘先沿径向拉出，再水平或垂直贴到标签最近的那条边。
 * 标签位置会先做几像素微调，保证第二段不需要斜着拐进去。
 */
function leaderPath(entry: LabelLayout): string {
  const left = entry.lx - entry.width / 2
  const right = entry.lx + entry.width / 2
  const top = entry.ly - entry.height / 2
  const bottom = entry.ly + entry.height / 2

  // 末端多压 1px 进标签，估计高度与真实高度有零点几像素误差时也不会露出缝
  if (entry.tickX >= left && entry.tickX <= right) {
    const endY = entry.ly >= entry.tickY ? top + 1 : bottom - 1
    return `M ${entry.startX} ${entry.startY} L ${entry.tickX} ${entry.tickY} L ${entry.tickX} ${endY}`
  }

  const endX = entry.lx >= entry.tickX ? left + 1 : right - 1
  return `M ${entry.startX} ${entry.startY} L ${entry.tickX} ${entry.tickY} L ${endX} ${entry.tickY}`
}

/** 未设色的灰扇区：线加深一档并略加粗，保证细线在浅底色上看得见 */
function leaderColor(color: string): string {
  return color.toLowerCase() === UNSET_TASK_COLOR.toLowerCase() ? '#626863' : color
}

export function TodayFocusDonut({
  items,
  focusSeconds,
  onJump,
}: {
  items: TodayFocusItem[]
  focusSeconds: number
  onJump?: (kind: 'task' | 'habit', id: string) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [chartW, setChartW] = useState(BASE_W)

  // SVG 与 HTML 标签必须用同一个宽度坐标系；不能只缩放 SVG 而让标签停在 480 上
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth
      if (width > 0) setChartW(Math.min(BASE_W, Math.max(280, Math.floor(width))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const labelW = chartW >= 460 ? 120 : chartW >= 340 ? 96 : 80
  const labelR = chartW / 2 - labelW / 2 - 6
  /** 圆心到标签内缘的距离；圆环要为「径向段 + 水平/垂直段」让出空间 */
  const labelEdge = Math.max(0, labelR - labelW / 2)
  const outerR = Math.round(
    Math.min(
      MAX_OUTER_R,
      Math.max(34, (labelEdge - LEADER_TICK - LEADER_MIN) / (1 + OUTER_WIDTH_RATIO / 2)),
    ),
  )
  const innerR = Math.round(outerR * INNER_R_RATIO)
  const outerW = Math.max(10, Math.round(outerR * OUTER_WIDTH_RATIO))
  const innerW = Math.max(8, Math.round(innerR * INNER_WIDTH_RATIO))
  const cx = chartW / 2
  const cy = H / 2

  const total = Math.max(1, items.reduce((sum, item) => sum + item.seconds, 0))
  const outerC = 2 * Math.PI * outerR
  const innerC = 2 * Math.PI * innerR
  const focusRatio = Math.min(1, Math.max(0, focusSeconds / DAY_SECONDS))

  const labels = useMemo<LabelLayout[]>(() => {
    const startR = outerR + outerW / 2
    const tickR = startR + LEADER_TICK
    let acc = 0
    const entries = items.map((item) => {
      const frac = item.seconds / total
      const start = acc
      acc += frac
      const mid = -Math.PI / 2 + (start + frac / 2) * TAU
      const cos = Math.cos(mid)
      const sin = Math.sin(mid)
      const height = estimateLabelHeight(item.name, labelW)
      return {
        item,
        frac,
        start,
        startX: cx + cos * startR,
        startY: cy + sin * startR,
        tickX: cx + cos * tickR,
        tickY: cy + sin * tickR,
        lx: clamp(cx + cos * labelR, labelW / 2 + LABEL_MARGIN, chartW - labelW / 2 - LABEL_MARGIN),
        ly: clamp(cy + sin * labelR, height / 2 + LABEL_MARGIN, H - height / 2 - LABEL_MARGIN),
        width: labelW,
        height,
        percent: Math.round(frac * 100),
      } satisfies LabelLayout
    })

    // 标签先按扇区角度摆在圆环四周；再微调几像素，保证引线能以水平/垂直段收口
    const alignConnections = () => {
      for (const entry of entries) {
        const left = entry.lx - entry.width / 2
        const right = entry.lx + entry.width / 2
        const top = entry.ly - entry.height / 2
        const bottom = entry.ly + entry.height / 2
        const insideX = entry.tickX >= left + EDGE_INSET && entry.tickX <= right - EDGE_INSET
        const insideY = entry.tickY >= top + EDGE_INSET && entry.tickY <= bottom - EDGE_INSET
        if (insideX !== insideY) continue

        const needX =
          entry.tickX < left + EDGE_INSET
            ? left + EDGE_INSET - entry.tickX
            : entry.tickX > right - EDGE_INSET
              ? entry.tickX - (right - EDGE_INSET)
              : 0
        const needY =
          entry.tickY < top + EDGE_INSET
            ? top + EDGE_INSET - entry.tickY
            : entry.tickY > bottom - EDGE_INSET
              ? entry.tickY - (bottom - EDGE_INSET)
              : 0

        if (needX <= needY) {
          entry.lx += entry.tickX < left + EDGE_INSET ? -needX : needX
        } else {
          entry.ly += entry.tickY < top + EDGE_INSET ? -needY : needY
        }
        entry.lx = clamp(
          entry.lx,
          entry.width / 2 + LABEL_MARGIN,
          chartW - entry.width / 2 - LABEL_MARGIN,
        )
        entry.ly = clamp(
          entry.ly,
          entry.height / 2 + LABEL_MARGIN,
          H - entry.height / 2 - LABEL_MARGIN,
        )
      }
    }

    // 相邻标签重叠时，沿重叠较短的一轴让开一点
    const separateOverlaps = () => {
      for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
          const a = entries[i]!
          const b = entries[j]!
          const overlapX =
            Math.min(a.lx + a.width / 2, b.lx + b.width / 2) -
            Math.max(a.lx - a.width / 2, b.lx - b.width / 2)
          const overlapY =
            Math.min(a.ly + a.height / 2, b.ly + b.height / 2) -
            Math.max(a.ly - a.height / 2, b.ly - b.height / 2)
          if (overlapX <= 0 || overlapY <= 0) continue

          if (overlapY > overlapX) {
            const push = (overlapX + LABEL_GAP) / 2
            if (a.lx <= b.lx) {
              a.lx -= push
              b.lx += push
            } else {
              a.lx += push
              b.lx -= push
            }
          } else {
            const push = (overlapY + LABEL_GAP) / 2
            if (a.ly <= b.ly) {
              a.ly -= push
              b.ly += push
            } else {
              a.ly += push
              b.ly -= push
            }
          }
          for (const entry of [a, b]) {
            entry.lx = clamp(
              entry.lx,
              entry.width / 2 + LABEL_MARGIN,
              chartW - entry.width / 2 - LABEL_MARGIN,
            )
            entry.ly = clamp(
              entry.ly,
              entry.height / 2 + LABEL_MARGIN,
              H - entry.height / 2 - LABEL_MARGIN,
            )
          }
        }
      }
    }

    alignConnections()
    separateOverlaps()
    alignConnections()

    return entries
  }, [items, total, chartW, labelW, labelR, cx, cy, outerR, outerW])

  const focusMinutes = Math.round(focusSeconds / 60)
  const focusHours = Math.floor(focusMinutes / 60)
  const focusRest = focusMinutes % 60
  const focusText =
    focusHours <= 0
      ? `${focusMinutes}分钟`
      : focusRest === 0
        ? `${focusHours}小时`
        : `${focusHours}小时${focusRest}分`

  const jump = (item: TodayFocusItem) => {
    if (item.kind) onJump?.(item.kind, item.id)
  }

  const activeItem = activeId ? labels.find((entry) => entry.item.id === activeId)?.item : undefined

  // 空隙只存在于描边上；命中的是一整圈，按角度折算回对应扇区，跨过空隙也不会掉悬停
  const pickAt = (clientX: number, clientY: number, svg: SVGSVGElement): LabelLayout | null => {
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * chartW - cx
    const y = ((clientY - rect.top) / rect.height) * H - cy
    const ratio = ((Math.atan2(y, x) + Math.PI / 2) / TAU + 1) % 1
    return (
      labels.find((entry) => ratio >= entry.start && ratio < entry.start + entry.frac) ??
      labels[labels.length - 1] ??
      null
    )
  }

  return (
    <div ref={wrapRef} className="w-full select-none" onPointerLeave={() => setActiveId(null)}>
      <div className="relative mx-auto h-[300px]" style={{ width: chartW }}>
        <svg viewBox={`0 0 ${chartW} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
          {labels.map((entry) => {
            const on = activeId === entry.item.id
            return (
              <path
                key={`line-${entry.item.id}`}
                d={leaderPath(entry)}
                fill="none"
                stroke={leaderColor(entry.item.color)}
                strokeWidth={on ? 2 : entry.item.color === UNSET_TASK_COLOR ? 1.5 : 1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={activeId && !on ? 0.3 : 0.9}
              />
            )
          })}

          {labels.length === 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={outerR}
              fill="none"
              stroke="currentColor"
              strokeWidth={outerW}
              className="text-foreground/8"
            />
          ) : null}

          {labels.map((entry) => {
            const length = Math.max(0.5, entry.frac * outerC - 2)
            const on = activeId === entry.item.id
            return (
              <circle
                key={`slice-${entry.item.id}`}
                cx={cx}
                cy={cy}
                r={outerR}
                fill="none"
                stroke={entry.item.color}
                strokeWidth={on ? outerW + 3 : outerW}
                strokeDasharray={`${length} ${outerC - length}`}
                strokeDashoffset={-entry.start * outerC}
                transform={`rotate(-90 ${cx} ${cy})`}
                className={cn(
                  'pointer-events-none transition-[opacity,stroke-width]',
                  activeId && !on ? 'opacity-40' : 'opacity-100',
                )}
              />
            )
          })}

          <circle
            cx={cx}
            cy={cy}
            r={outerR}
            fill="none"
            stroke="transparent"
            strokeWidth={outerW + 10}
            pointerEvents="stroke"
            onPointerEnter={(event) => {
              const svg = event.currentTarget.ownerSVGElement
              if (svg) setActiveId(pickAt(event.clientX, event.clientY, svg)?.item.id ?? null)
            }}
            onPointerMove={(event) => {
              const svg = event.currentTarget.ownerSVGElement
              if (svg) setActiveId(pickAt(event.clientX, event.clientY, svg)?.item.id ?? null)
            }}
            onPointerLeave={() => setActiveId(null)}
            onClick={(event) => {
              const svg = event.currentTarget.ownerSVGElement
              if (!svg) return
              const entry = pickAt(event.clientX, event.clientY, svg)
              if (entry) jump(entry.item)
            }}
            style={{ cursor: activeItem?.kind ? 'pointer' : 'default' }}
          />

          <circle
            cx={cx}
            cy={cy}
            r={innerR}
            fill="none"
            stroke="currentColor"
            strokeWidth={innerW}
            className="text-foreground/8"
          />
          <circle
            cx={cx}
            cy={cy}
            r={innerR}
            fill="none"
            stroke="currentColor"
            strokeWidth={innerW}
            strokeDasharray={`${Math.max(0.5, focusRatio * innerC)} ${innerC}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="text-primary"
          />
        </svg>

        <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[96px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
          <p className="text-[9px] leading-none text-muted-foreground">今日专注</p>
          <p className="mt-0.5 whitespace-nowrap text-[12px] leading-[15px] tracking-tight text-foreground">
            {focusText}
          </p>
          <p className="mt-1 text-[10.5px] leading-none text-muted-foreground">
            占全天 {Math.round(focusRatio * 100)}%
          </p>
        </div>

        {labels.map((entry) => {
          const on = activeId === entry.item.id
          const clickable = Boolean(entry.item.kind)
          return (
            <div
              key={`label-${entry.item.id}`}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => jump(entry.item) : undefined}
              onKeyDown={
                clickable
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        jump(entry.item)
                      }
                    }
                  : undefined
              }
              onPointerEnter={() => setActiveId(entry.item.id)}
              onPointerLeave={() => setActiveId(null)}
              className={cn(
                'absolute z-10 flex flex-col rounded-[4px] border px-1.5 py-0.5 outline-none transition-[border-color,box-shadow]',
                clickable ? 'cursor-pointer' : 'cursor-default',
                on
                  ? 'z-30 border-primary bg-[var(--card-surface)]'
                  : 'border-primary/70 bg-[var(--card-surface)]',
              )}
              style={{
                left: entry.lx,
                top: entry.ly,
                width: entry.width,
                transform: 'translate(-50%, -50%)',
                boxShadow: on
                  ? '0 1px 2px rgba(49, 83, 42, 0.5), 0 2px 6px rgba(49, 83, 42, 0.3)'
                  : undefined,
              }}
              title={`${entry.item.name} · ${shortDuration(entry.item.seconds)} · ${entry.percent}%`}
            >
              <div className="flex items-start gap-1">
                <span
                  className="mt-[3px] size-1.5 shrink-0 rounded-full"
                  style={{ background: entry.item.color }}
                  aria-hidden
                />
                <span className="line-clamp-3 min-w-0 break-words text-[10px] font-medium leading-[14px] text-foreground">
                  {entry.item.name}
                </span>
              </div>
              <p className="text-[9px] leading-[13px] text-muted-foreground">
                {shortDuration(entry.item.seconds)} · {entry.percent}%
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
