import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SlidingSegmented } from '@/components/ui/sliding'
import { runTool } from '@/lib/tool-core'
import { pluginIcon } from '@/lib/plugin-tools'
import { cn } from '@/lib/utils'
import { ColorPicker, type ColorFormat, normalizeHex } from './shared/ColorPicker'

interface PaletteItem {
  name: string
  hex: string
  group: string
}


const GROUPS = ['中国传统色', '日本传统色', 'Material Design', 'Flat UI', 'WEB 安全色'] as const

interface StoredColor {
  color: string
  colorType: ColorFormat
  name?: string
}

const STORAGE_KEY = 'matcha:color-list'

const readStored = (): StoredColor | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredColor
    if (!normalizeHex(parsed.color ?? '')) return null
    return parsed
  } catch {
    return null
  }
}

export function ColorListTool() {
  const Icon = pluginIcon('color-list')
  const stored = useMemo(readStored, [])
  const [keyword, setKeyword] = useState('')
  const [group, setGroup] = useState<string>(GROUPS[0])
  const [items, setItems] = useState<PaletteItem[]>([])
  const [selectedHex, setSelectedHex] = useState(normalizeHex(stored?.color ?? '') ?? '#5C2223')
  const [selectedName, setSelectedName] = useState(stored?.name ?? '暗玉紫')
  const [format, setFormat] = useState<ColorFormat>(stored?.colorType ?? 'hex')

  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      void runTool<{ total: number; items: PaletteItem[] }>('color-list', {
        keyword: keyword.trim() || undefined,
        group,
      }).then((result) => {
        if (alive) setItems(result.ok ? result.data.items : [])
      })
    }, 160)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [keyword, group])

  useEffect(() => {
    const payload: StoredColor = { color: selectedHex, colorType: format, name: selectedName }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      /* 隐私模式等场景写不进去，不影响取色 */
    }
  }, [selectedHex, format, selectedName])

  const pick = (item: PaletteItem) => {
    setSelectedHex(item.hex)
    setSelectedName(item.name)
  }

  const changeColor = (hex: string) => {
    setSelectedHex(hex)
    setSelectedName(hex)
  }

  return (
    <main className="flex min-h-0 flex-1 gap-0">
      <section className="flex min-w-0 flex-1 flex-col gap-2 px-4 pb-4">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SlidingSegmented
            options={GROUPS.map((item) => ({ value: item, label: item }))}
            value={group}
            onValueChange={setGroup}
            ariaLabel="色板分类"
          />
          <div className="relative ml-auto w-44">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜 暗玉紫 / #5C2223"
              className="h-8 pl-8 text-[12px]"
              spellCheck={false}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">{items.length} 色</span>
        </div>

        <section className="glass min-h-0 flex-1 overflow-auto rounded-panel p-3 scroll-thin">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-1">
              <Icon className="size-6 text-muted-foreground/50" />
              <p className="text-[12px] text-muted-foreground">没有匹配的颜色。</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-2">
              {items.map((item) => {
                const active = normalizeHex(item.hex) === selectedHex
                return (
                  <button
                    key={`${item.group}-${item.name}-${item.hex}`}
                    type="button"
                    onClick={() => pick(item)}
                    className={
                      active
                        ? 'overflow-hidden rounded-md border border-primary/60 ring-1 ring-primary/30 text-left'
                        : 'overflow-hidden rounded-md border border-border/50 text-left transition-colors hover:border-primary/40'
                    }
                  >
                    <span className="block truncate bg-background/40 px-1.5 py-1 text-[11px] text-foreground">
                      {item.name}
                    </span>
                    <span className="block h-11 w-full" style={{ backgroundColor: item.hex }} aria-hidden />
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </section>

      <aside
        className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-l-panel border-l border-border/40"
        style={{ backgroundColor: selectedHex }}
      >
        <header className="shrink-0 bg-black/30 px-4 py-3">
          <h2 className="truncate text-[20px] font-bold leading-7 text-white">{selectedName}</h2>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-3 scroll-thin">
          <div className="rounded-lg bg-background/95 p-3 shadow-sm">
            <ColorPicker
              color={selectedHex}
              onChange={changeColor}
              format={format}
              onFormatChange={setFormat}
            />
          </div>
        </div>
      </aside>
    </main>
  )
}

const SELECT_STORAGE_KEY = 'matcha:color-select'

const SELECT_PALETTE = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
  '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#9e9e9e',
  '#607d8b', '#000000', '#ffffff',
]

const readSelectStored = (): StoredColor | null => {
  try {
    const raw = window.localStorage.getItem(SELECT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredColor>
    const parsedColor = normalizeHex(parsed.color ?? '')
    if (parsedColor) return { color: parsedColor, colorType: parsed.colorType ?? 'hex' }
    const direct = normalizeHex(raw)
    return direct ? { color: direct, colorType: 'hex' } : null
  } catch {
    return null
  }
}


export function ColorSelectTool() {
  const stored = useMemo(readSelectStored, [])
  const [color, setColor] = useState(normalizeHex(stored?.color ?? '') ?? '#efe9e7')
  const [format, setFormat] = useState<ColorFormat>(stored?.colorType ?? 'hex')

  useEffect(() => {
    const payload: StoredColor = { color, colorType: format }
    try {
      window.localStorage.setItem(SELECT_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      /* 写不进去不影响取色 */
    }
  }, [color, format])

  return (
    <main
      className="flex min-h-0 flex-1 flex-col items-center overflow-auto px-4 pb-4 pt-3 scroll-thin"
      style={{ backgroundColor: color }}
    >
      <h2 className="mb-2 shrink-0 rounded bg-black/25 px-3 py-1 text-[16px] font-bold text-white">
        颜色选择器
      </h2>
      <div className="w-full max-w-[360px] rounded-lg bg-background/95 p-3 shadow-sm">
        <div className="mb-2.5 grid grid-cols-11 gap-1">
          {SELECT_PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              title={swatch.toUpperCase()}
              aria-label={`选择 ${swatch.toUpperCase()}`}
              onClick={() => setColor(swatch)}
              className={cn(
                'aspect-square rounded border border-black/15 transition-transform hover:scale-110',
                color === swatch && 'ring-2 ring-primary ring-offset-1',
              )}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
        <ColorPicker color={color} onChange={setColor} format={format} onFormatChange={setFormat} />
      </div>
      <p className="mt-2 shrink-0 font-mono text-[11px] text-white/85">{color}</p>
    </main>
  )
}

