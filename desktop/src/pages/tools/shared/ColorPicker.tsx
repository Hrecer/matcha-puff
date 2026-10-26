import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NumberField } from '@/components/ui/number-field'
import { SlidingSegmented } from '@/components/ui/sliding'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

export type ColorFormat = 'hex' | 'rgb' | 'hsl'

interface RGB {
  r: number
  g: number
  b: number
}
interface HSL {
  h: number
  s: number
  l: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.split('').map((c) => c + c).join('').toLowerCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`
  return null
}

export function hexToRgb(hex: string): RGB {
  const value = normalizeHex(hex) ?? '#000000'
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16),
  }
}

export const rgbToHex = ({ r, g, b }: RGB): string =>
  `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
  else if (max === gn) h = ((bn - rn) / d + 2) * 60
  else h = ((rn - gn) / d + 4) * 60
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = ((h % 360) + 360) % 360 / 360
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100
  if (sn === 0) {
    const v = Math.round(ln * 255)
    return { r: v, g: v, b: v }
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q
  const hue = (t: number): number => {
    let tn = t
    if (tn < 0) tn += 1
    if (tn > 1) tn -= 1
    if (tn < 1 / 6) return p + (q - p) * 6 * tn
    if (tn < 1 / 2) return q
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6
    return p
  }
  return {
    r: Math.round(hue(hn + 1 / 3) * 255),
    g: Math.round(hue(hn) * 255),
    b: Math.round(hue(hn - 1 / 3) * 255),
  }
}

/** HEX → HSV（取色方块需要 s/v） */
function rgbToHsv(rgb: RGB): { h: number; s: number; v: number } {
  const { h } = rgbToHsl(rgb)
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const s = max === 0 ? 0 : d / max
  return { h, s: Math.round(s * 100), v: Math.round(max * 100) }
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  const sn = clamp(s, 0, 100) / 100
  const vn = clamp(v, 0, 100) / 100
  const c = vn * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = vn - c
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return { r: Math.round((rgb[0] + m) * 255), g: Math.round((rgb[1] + m) * 255), b: Math.round((rgb[2] + m) * 255) }
}

export const formatColor = (hex: string, format: ColorFormat): string => {
  if (format === 'rgb') {
    const { r, g, b } = hexToRgb(hex)
    return `rgb(${r}, ${g}, ${b})`
  }
  if (format === 'hsl') {
    const { h, s, l } = rgbToHsl(hexToRgb(hex))
    return `hsl(${h}, ${s}%, ${l}%)`
  }
  return normalizeHex(hex) ?? hex
}

interface ColorPickerProps {
  color: string
  onChange: (hex: string) => void
  /** 复制格式由外部 tab 控制 */
  format: ColorFormat
  onFormatChange: (format: ColorFormat) => void
  className?: string
  /** 只保留取色方块、色相条与 HEX，供窄面板使用 */
  minimal?: boolean
}

/** 调色板：饱和度/明度方块 + 色相条 + H/S/L、R/G/B、HEX 输入 + 复制 */
export function ColorPicker({ color, onChange, format, onFormatChange, className, minimal }: ColorPickerProps) {
  const hex = normalizeHex(color) ?? '#000000'
  const rgb = hexToRgb(hex)
  const hsl = rgbToHsl(rgb)
  const hsv = rgbToHsv(rgb)
  const [hexDraft, setHexDraft] = useState(hex)
  const svRef = useRef<HTMLDivElement | null>(null)
  const hueRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => setHexDraft(hex), [hex])

  const updateFromSv = (clientX: number, clientY: number) => {
    const el = svRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
    const v = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100)
    onChange(rgbToHex(hsvToRgb(hsv.h, s, v)))
  }

  const updateFromHue = (clientX: number) => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360)
    onChange(rgbToHex(hsvToRgb(h, hsv.s, hsv.v)))
  }

  const dragHandlers = (update: (x: number, y: number) => void) => ({
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      update(event.clientX, event.clientY)
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      update(event.clientX, event.clientY)
    },
  })

  const setHsl = (patch: Partial<HSL>) => {
    const next = { ...hsl, ...patch }
    onChange(rgbToHex(hslToRgb(next)))
  }

  const setRgb = (patch: Partial<RGB>) => {
    onChange(rgbToHex({ ...rgb, ...patch }))
  }

  const applyHexDraft = () => {
    const parsed = normalizeHex(hexDraft)
    if (parsed) {
      onChange(parsed)
      setHexDraft(parsed)
    } else {
      setHexDraft(hex)
    }
  }

  const copy = () => {
    void copyText(formatColor(hex, format)).then(
      () => toast(`已复制 ${formatColor(hex, format)}`),
      () => toast('复制失败，请手动选择内容', 'error'),
    )
  }

  const numberInput = (value: number, min: number, max: number, onCommit: (v: number) => void, label: string) => (
    <label key={label} className="flex min-w-0 flex-1 items-center gap-1">
      <span className="w-3 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <NumberField
        value={value}
        onChange={onCommit}
        min={min}
        max={max}
        // R/G/B 一行三列，塞加减按钮会把输入框挤没，保留统一样式的纯输入框
        showSteppers={false}
        className="h-7 w-full min-w-0 rounded border border-border/60 bg-background/70 px-1.5 font-mono text-[11px] text-foreground"
      />
    </label>
  )

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {minimal ? null : (
        <>
          <SlidingSegmented
            options={[
              { value: 'hex', label: 'HEX' },
              { value: 'rgb', label: 'RGB' },
              { value: 'hsl', label: 'HSL' },
            ]}
            value={format}
            onValueChange={(value) => onFormatChange(value as ColorFormat)}
            ariaLabel="复制格式"
          />
          <Button size="sm" className="w-full gap-1.5" onClick={copy}>
            <Copy className="size-3.5" aria-hidden />
            复制当前颜色
          </Button>
        </>
      )}

      <div
        ref={svRef}
        {...dragHandlers(updateFromSv)}
        className={cn(
          'relative w-full cursor-crosshair touch-none overflow-hidden rounded-md border border-border/50',
          minimal ? 'h-28' : 'h-36',
        )}
        style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
        aria-label="饱和度和明度"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <span
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span
          className="size-7 shrink-0 rounded-full border border-black/10"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <div
          ref={hueRef}
          {...dragHandlers((x) => updateFromHue(x))}
          className="relative h-3 min-w-0 flex-1 cursor-pointer touch-none rounded-full"
          style={{
            background:
              'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          }}
          aria-label="色相"
        >
          <span
            className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            style={{ left: `${(hsv.h / 360) * 100}%` }}
          />
        </div>
      </div>

      {minimal ? null : (
        <>
          <div className="flex gap-1.5">
            {numberInput(hsl.h, 0, 360, (value) => setHsl({ h: value }), 'H')}
            {numberInput(hsl.s, 0, 100, (value) => setHsl({ s: value }), 'S')}
            {numberInput(hsl.l, 0, 100, (value) => setHsl({ l: value }), 'L')}
          </div>
          <div className="flex gap-1.5">
            {numberInput(rgb.r, 0, 255, (value) => setRgb({ r: value }), 'R')}
            {numberInput(rgb.g, 0, 255, (value) => setRgb({ g: value }), 'G')}
            {numberInput(rgb.b, 0, 255, (value) => setRgb({ b: value }), 'B')}
          </div>
        </>
      )}
      <label className="flex items-center gap-2">
        <span className="w-7 shrink-0 text-[10px] text-muted-foreground">HEX</span>
        <input
          value={hexDraft}
          onChange={(event) => setHexDraft(event.target.value)}
          onBlur={applyHexDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyHexDraft()
          }}
          spellCheck={false}
          className="h-7 w-full rounded border border-border/60 bg-background/70 px-2 font-mono text-[11px] text-foreground outline-none focus-visible:border-primary/50"
        />
      </label>
    </div>
  )
}
