import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface GlassRect {
  x: number
  y: number
  w: number
  h: number
  /** 单块圆角；不传则使用组件的 radius */
  rx?: number
}

export interface FrostedGlassUnionHandle {
  /** 玻璃曲面层元素（用于把视口矩形换算成本层局部坐标） */
  layer: HTMLDivElement | null
  /** 每帧写入参与融合的矩形（本层局部坐标）与可视高度 */
  setRects: (rects: GlassRect[], viewportHeight: number) => void
}

let seq = 0

export const FrostedGlassUnion = forwardRef<
  FrostedGlassUnionHandle,
  { radius?: number; mergeTouching?: boolean }
>(function FrostedGlassUnion({ radius = 20, mergeTouching = true }, ref) {
    const uid = useRef(`lgu${(seq += 1)}`)
    const layerRef = useRef<HTMLDivElement>(null)
    const rimLayerRef = useRef<HTMLDivElement>(null)
    const groupRef = useRef<SVGGElement>(null)
    const rimGroupRef = useRef<SVGGElement>(null)
    const holeGroupRef = useRef<SVGGElement>(null)
    const pool = useRef<SVGRectElement[]>([])
    const rimPool = useRef<SVGRectElement[]>([])
    const holePool = useRef<SVGRectElement[]>([])

    useImperativeHandle(ref, () => ({
      get layer() {
        return layerRef.current
      },
      setRects(rects, viewportHeight) {
        const layer = layerRef.current
        const g = groupRef.current
        if (!layer || !g) return
        const h = `${Math.ceil(viewportHeight)}px`
        if (layer.style.height !== h) layer.style.height = h
        if (rimLayerRef.current && rimLayerRef.current.style.height !== h) {
          rimLayerRef.current.style.height = h
        }

        const sorted = rects
          .slice()
          .sort((a, b) => a.y - b.y)
          .filter((r) => r.w > 0 && r.h > 0)
        // 常态合并相接矩形避免接触线鼓包；拼合动画必须保留两块，
        // 让 goo 自己生成水表面张力的颈部。
        const parsed: GlassRect[] = mergeTouching ? [] : sorted.map((r) => ({ ...r }))
        if (mergeTouching) {
          for (const r of sorted) {
            const last = parsed[parsed.length - 1]
            if (last && r.y <= last.y + last.h + 3 && Math.abs(r.w - last.w) < 2) {
              last.h = Math.max(last.y + last.h, r.y + r.h) - last.y
            } else {
              parsed.push({ ...r })
            }
          }
        }
        const merged = parsed

        const write = (group: SVGGElement | null, p: SVGRectElement[]) => {
          if (!group) return
          while (p.length < merged.length) {
            const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
            group.appendChild(el)
            p.push(el)
          }
          for (let i = 0; i < p.length; i++) {
            const el = p[i]
            const rect = merged[i]
            if (!rect) {
              el.setAttribute('width', '0')
              el.setAttribute('height', '0')
              continue
            }
            // 取整：亚像素矩形会让 goo 掩码在边缘闪出毛刺
            el.setAttribute('x', String(Math.round(rect.x)))
            el.setAttribute('y', String(Math.round(rect.y)))
            el.setAttribute('width', String(Math.round(rect.w)))
            el.setAttribute('height', String(Math.round(rect.h)))
            el.setAttribute('rx', String(rect.rx ?? radius))
          }
        }
        write(g, pool.current)
        write(rimGroupRef.current, rimPool.current)
        write(holeGroupRef.current, holePool.current)
      },
    }))

    const goo = `${uid.current}-goo`
    const gooErode = `${uid.current}-goo-erode`
    const maskBody = `${uid.current}-body`
    const maskRim = `${uid.current}-rim`

    return (
      /* 固定在工具页卡片层的左上角；宽度由卡片层给出 */
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-20 h-0 w-full">
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <filter
              id={goo}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b" />
              {/* 阈值必须近乎二值（gain 50）：阈值太缓时颈部一整条 alpha<1，
                  玻璃 tint 在那条上变淡，看起来像两块卡之间被截断 */}
              <feColorMatrix
                in="b"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 50 -24.5"
                result="shape"
              />
            </filter>
            {/* 在 goo 形状本身上向内蚀刻 2px：外轮廓/融合颈不变，环宽严格恒定 */}
            <filter
              id={gooErode}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 50 -24.5"
                result="shape"
              />
              <feMorphology in="shape" operator="erode" radius="2" result="eroded" />
            </filter>
            <mask id={maskBody} maskUnits="userSpaceOnUse" x="0" y="0" width="4000" height="4000">
              <g ref={groupRef} fill="#fff" filter={`url(#${goo})`} />
            </mask>
            <mask id={maskRim} maskUnits="userSpaceOnUse" x="0" y="0" width="4000" height="4000">
              <g ref={rimGroupRef} fill="#fff" filter={`url(#${goo})`} />
              <g ref={holeGroupRef} fill="#000" filter={`url(#${gooErode})`} />
            </mask>
          </defs>
        </svg>
        <div
          ref={layerRef}
          className="glass-union pointer-events-none absolute left-0 top-0 w-full"
          style={{ mask: `url(#${maskBody})`, WebkitMask: `url(#${maskBody})` }}
        />
        <div
          ref={rimLayerRef}
          className="pointer-events-none absolute left-0 top-0 w-full"
          style={{
            background: 'var(--glass-rim)',
            mask: `url(#${maskRim})`,
            WebkitMask: `url(#${maskRim})`,
          }}
        />
      </div>
    )
  },
)
