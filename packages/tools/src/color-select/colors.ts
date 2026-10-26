/** 颜色解析与格式换算（HEX / RGB / HSL / CMYK + WCAG 对比度） */

export interface Rgb {
  r: number
  g: number
  b: number
  a: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** 支持 #rgb / #rgba / #rrggbb / #rrggbbaa / rgb() / rgba() / hsl() / hsla() */
export function parseColor(input: string): Rgb | null {
  const text = input.trim().toLowerCase()

  const hex = /^#?([0-9a-f]{3,8})$/.exec(text)
  if (hex) {
    const value = hex[1] ?? ''
    if (![3, 4, 6, 8].includes(value.length)) return null
    const expand = (part: string) => Number.parseInt(part.length === 1 ? part + part : part, 16)
    if (value.length <= 4) {
      return {
        r: expand(value[0] ?? ''),
        g: expand(value[1] ?? ''),
        b: expand(value[2] ?? ''),
        a: value.length === 4 ? round(expand(value[3] ?? '') / 255, 3) : 1,
      }
    }
    return {
      r: expand(value.slice(0, 2)),
      g: expand(value.slice(2, 4)),
      b: expand(value.slice(4, 6)),
      a: value.length === 8 ? round(expand(value.slice(6, 8)) / 255, 3) : 1,
    }
  }

  const rgb = /^rgba?\(([^)]+)\)$/.exec(text)
  if (rgb) {
    const parts = (rgb[1] ?? '').split(/[,/\s]+/).filter(Boolean).map(Number)
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null
    return {
      r: clamp(Math.round(parts[0] ?? 0), 0, 255),
      g: clamp(Math.round(parts[1] ?? 0), 0, 255),
      b: clamp(Math.round(parts[2] ?? 0), 0, 255),
      a: clamp(parts[3] ?? 1, 0, 1),
    }
  }

  const hsl = /^hsla?\(([^)]+)\)$/.exec(text)
  if (hsl) {
    const parts = (hsl[1] ?? '').split(/[,/\s]+/).filter(Boolean)
    if (parts.length < 3) return null
    const h = Number.parseFloat(parts[0] ?? '0')
    const s = Number.parseFloat(parts[1] ?? '0') / 100
    const l = Number.parseFloat(parts[2] ?? '0') / 100
    if ([h, s, l].some((part) => Number.isNaN(part))) return null
    const rgb = hslToRgb({ h, s, l })
    return { ...rgb, a: clamp(Number.parseFloat(parts[3] ?? '1'), 0, 1) }
  }

  return null
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h: round(h), s: round(s * 100, 1), l: round(l * 100, 1) }
}

export function hslToRgb({ h, s, l }: Hsl): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1))
  const m = l - c / 2
  const table: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  const [r, g, b] = table[Math.floor(hn / 60) % 6] ?? [0, 0, 0]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

export function rgbToCmyk({ r, g, b }: Rgb): { c: number; m: number; y: number; k: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const k = 1 - Math.max(rn, gn, bn)
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 }
  return {
    c: round(((1 - rn - k) / (1 - k)) * 100, 1),
    m: round(((1 - gn - k) / (1 - k)) * 100, 1),
    y: round(((1 - bn - k) / (1 - k)) * 100, 1),
    k: round(k * 100, 1),
  }
}

const toHexPair = (value: number): string => value.toString(16).padStart(2, '0')

export function toHex(color: Rgb): string {
  const base = `#${toHexPair(color.r)}${toHexPair(color.g)}${toHexPair(color.b)}`.toUpperCase()
  return color.a < 1 ? `${base}${toHexPair(Math.round(color.a * 255)).toUpperCase()}` : base
}

/** WCAG 相对亮度 */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number): number => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 对比度（1–21） */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return round((lighter + 0.05) / (darker + 0.05), 2)
}
