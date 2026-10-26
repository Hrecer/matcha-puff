import { useEffect, useState, type CSSProperties } from 'react'
import { cn } from 'cn'
import '@/styles/matcha-sign.css'

/**
 * 抹茶泡芙霓虹手绘动画（关于页展示）
 *
 * 线稿：圆脸猫 + 头顶抹茶叶 + 手写连笔「matcha puff」+ 爪印/爱心/星芒，
 * 笔画逐段点亮 → 辉光呼吸、星芒闪烁、轻微浮动 → 淡出重来，5.6s 一轮。
 * 技术：SVG pathLength 描线 + CSS 关键帧；辉光为高斯模糊副本层。
 * 背景透明，直接落在页面原有的抹茶底色上。
 */

const CYCLE_MS = 5600

const CAT = '#547a48' // 抹茶描线（浅底可读）
const LEAF = '#6f9c5a'
const TEXT = '#3f5837' // 手写笔字（深抹茶墨）
const PINK = '#e58ba9'
const PINK_SOFT = '#f2b7cb'

type Stroke = { d: string; c: string; w: number; delay: number; dur?: number }
type Blob = { cx: number; cy: number; r: number; c: string; delay: number }
type Spark = { x: number; y: number; s: number; c: string; delay: number }

const STROKES: Stroke[] = [
  // 猫头一圈（含双耳，收笔留缺口的手绘感）
  {
    d: 'M92,196 C84,150 96,116 118,96 C120,74 128,58 142,50 C152,60 158,76 160,92 C186,82 214,82 240,92 C242,76 248,60 258,50 C272,58 280,74 282,96 C304,116 316,150 308,196 C300,236 262,258 200,258 C140,258 104,232 94,200',
    c: CAT,
    w: 5,
    delay: 0,
    dur: 1.2,
  },
  // 眯眯笑眼
  { d: 'M150,168 q14,-16 28,0', c: CAT, w: 4.5, delay: 0.95, dur: 0.25 },
  { d: 'M222,168 q14,-16 28,0', c: CAT, w: 4.5, delay: 1.05, dur: 0.25 },
  // 鼻头与嘴
  { d: 'M196,186 q4,6 8,0 q-4,8 -8,0', c: CAT, w: 4, delay: 1.15, dur: 0.2 },
  { d: 'M200,196 q-8,10 -16,4', c: CAT, w: 4, delay: 1.25, dur: 0.2 },
  { d: 'M200,196 q8,10 16,4', c: CAT, w: 4, delay: 1.3, dur: 0.2 },
  // 胡须
  { d: 'M60,168 q26,2 44,10', c: CAT, w: 4, delay: 1.25, dur: 0.25 },
  { d: 'M56,190 q28,-2 48,0', c: CAT, w: 4, delay: 1.35, dur: 0.25 },
  { d: 'M340,168 q-26,2 -44,10', c: CAT, w: 4, delay: 1.4, dur: 0.25 },
  { d: 'M344,190 q-28,-2 -48,0', c: CAT, w: 4, delay: 1.5, dur: 0.25 },
  // 头顶抹茶叶（轮廓 + 叶脉）
  {
    d: 'M198,46 c-14,-2 -22,-12 -20,-24 c14,2 22,10 22,24 c4,-12 12,-18 22,-18 c0,12 -8,20 -24,18 z',
    c: LEAF,
    w: 4,
    delay: 1.55,
    dur: 0.45,
  },
  { d: 'M200,44 c4,-8 10,-14 18,-16', c: LEAF, w: 3, delay: 1.85, dur: 0.2 },
]

const BLOBS: Blob[] = [
  // 腮红
  { cx: 140, cy: 198, r: 9, c: PINK, delay: 1.6 },
  { cx: 260, cy: 198, r: 9, c: PINK, delay: 1.7 },
  // 爱心
  { cx: 330, cy: 60, r: 0, c: PINK, delay: 1.8 },
  // 右爪印
  { cx: 410, cy: 306, r: 8, c: PINK, delay: 3.4 },
  { cx: 398, cy: 292, r: 3.5, c: PINK_SOFT, delay: 3.48 },
  { cx: 410, cy: 288, r: 3.5, c: PINK_SOFT, delay: 3.56 },
  { cx: 422, cy: 292, r: 3.5, c: PINK_SOFT, delay: 3.64 },
  // 左爪印
  { cx: 66, cy: 306, r: 6, c: PINK, delay: 3.5 },
  { cx: 57, cy: 295, r: 3, c: PINK_SOFT, delay: 3.58 },
  { cx: 66, cy: 292, r: 3, c: PINK_SOFT, delay: 3.66 },
  { cx: 75, cy: 295, r: 3, c: PINK_SOFT, delay: 3.74 },
  // 小圆点
  { cx: 48, cy: 240, r: 3, c: CAT, delay: 3.7 },
  { cx: 408, cy: 220, r: 3, c: TEXT, delay: 3.8 },
]

const SPARKS: Spark[] = [
  { x: 60, y: 80, s: 9, c: TEXT, delay: 3.5 },
  { x: 392, y: 120, s: 8, c: PINK, delay: 3.65 },
  { x: 380, y: 40, s: 7, c: CAT, delay: 3.8 },
]

function starPath(x: number, y: number, s: number) {
  const q = s * 0.28
  return `M${x},${y - s} C${x + q},${y - q} ${x + q},${y - q} ${x + s},${y} C${x + q},${y + q} ${x + q},${y + q} ${x},${y + s} C${x - q},${y + q} ${x - q},${y + q} ${x - s},${y} C${x - q},${y - q} ${x - q},${y - q} ${x},${y - s} Z`
}

function Art({ glow = false }: { glow?: boolean }) {
  const extra = glow ? 3 : 0
  return (
    <>
      {STROKES.map((s, i) => (
        <path
          key={`s${i}`}
          d={s.d}
          pathLength={1}
          fill={s.d.endsWith('z') ? s.c : 'none'}
          stroke={s.c}
          strokeWidth={s.w + extra}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ms-draw"
          style={{ '--d': `${s.delay}s`, '--dur': `${s.dur ?? 0.3}s` } as CSSProperties}
        />
      ))}
      {BLOBS.map((b, i) =>
        b.r === 0 ? (
          <path
            key={`b${i}`}
            d="M330,66 c-5,-8 -16,-6 -16,2 c0,7 9,11 16,17 c7,-6 16,-10 16,-17 c0,-8 -11,-10 -16,-2 z"
            fill={b.c}
            className="ms-pop"
            style={{ '--d': `${b.delay}s` } as CSSProperties}
          />
        ) : (
          <circle
            key={`b${i}`}
            cx={b.cx}
            cy={b.cy}
            r={b.r + (glow ? 1.5 : 0)}
            fill={b.c}
            className="ms-pop"
            style={{ '--d': `${b.delay}s` } as CSSProperties}
          />
        ),
      )}
      {SPARKS.map((p, i) => (
        <path
          key={`p${i}`}
          d={starPath(p.x, p.y, p.s)}
          fill={p.c}
          className="ms-twinkle"
          style={{ '--d': `${p.delay}s` } as CSSProperties}
        />
      ))}
      {/* 手写笔字：系统手写体 + 从左到右写出遮罩 */}
      <g mask="url(#ms-write)">
        <text
          x={230}
          y={316}
          textAnchor="middle"
          fill={TEXT}
          stroke={TEXT}
          strokeWidth={glow ? 2 : 0}
          className="ms-hand"
        >
          matcha puff
        </text>
      </g>
    </>
  )
}

export function MatchaSign({ className }: { className?: string }) {
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setCycle((c) => c + 1), CYCLE_MS)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className={cn('inline-block', className)} aria-hidden>
      <svg key={cycle} width={340} height={266} viewBox="0 0 460 360" className="block">
        <defs>
          <filter id="ms-blur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <mask id="ms-write" maskUnits="userSpaceOnUse" x="0" y="250" width="460" height="110">
            <rect className="ms-wipe" x="0" y="250" width="460" height="110" fill="#fff" />
          </mask>
        </defs>
        <g className="ms-exit">
          <g className="ms-float">
            <g filter="url(#ms-blur)" className="ms-glow">
              <Art glow />
            </g>
            <Art />
          </g>
        </g>
      </svg>
    </div>
  )
}
