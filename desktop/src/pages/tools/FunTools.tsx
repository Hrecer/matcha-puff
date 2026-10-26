import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Dices,
  Download,
  Loader2,
  QrCode,
  Search,
} from 'lucide-react'
import QRCodeStyling from 'qr-code-styling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { saveDialog, writeFileBytes } from '@/ipc/bridge'
import { copyText } from '@/lib/clipboard'
import { runTool } from '@/lib/tool-core'

interface IdiomItem {
  word: string
  length: number
}

interface IdiomResult {
  total: number
  truncated: boolean
  hasMore: boolean
  offset: number
  items: IdiomItem[]
  lengthStats: { length: number; count: number }[]
}

const IDIOM_MODES = [
  { value: 'contains' as const, label: '包含' },
  { value: 'startsWith' as const, label: '开头' },
  { value: 'endsWith' as const, label: '结尾' },
  { value: 'pinyin' as const, label: '拼音' },
]

type IdiomMode = (typeof IDIOM_MODES)[number]['value']

/** 成语查询：汉字/拼音检索、字数筛选、随机一条，分页加载不静默截断 */
export function IdiomQueryTool() {
  const [keyword, setKeyword] = useState('')
  const [mode, setMode] = useState<IdiomMode>('contains')
  const [length, setLength] = useState('0')
  const [items, setItems] = useState<IdiomItem[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [randomWord, setRandomWord] = useState('')
  const requestId = useRef(0)

  const load = async (reset: boolean, offset: number) => {
    const id = ++requestId.current
    setLoading(true)
    const result = await runTool<IdiomResult>('idiom-query', {
      keyword: keyword.trim() || undefined,
      mode,
      length: Number(length),
      offset,
      limit: 200,
    })
    if (id !== requestId.current) return
    setLoading(false)
    if (!result.ok) {
      if (reset) {
        setItems([])
        setTotal(0)
        setHasMore(false)
        setError(result.error.message)
      }
      return
    }
    setError('')
    setTotal(result.data.total)
    setHasMore(result.data.hasMore)
    setItems((current) => (reset ? result.data.items : [...current, ...result.data.items]))
  }

  useEffect(() => {
    setRandomWord('')
    const timer = window.setTimeout(() => void load(true, 0), 260)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, mode, length])

  const random = async () => {
    const result = await runTool<IdiomResult>('idiom-query', { random: true, mode, length: 0 })
    if (!result.ok) {
      toast(result.error.message, 'error')
      return
    }
    const word = result.data.items[0]
    if (!word) return
    setRandomWord(word.word)
    setItems([word])
    setTotal(1)
    setHasMore(false)
    setError('')
  }

  const copy = async (word: string) => {
    try {
      await copyText(word)
      setCopied(word)
      window.setTimeout(() => setCopied((current) => (current === word ? null : current)), 1200)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative w-52">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void load(true, 0)
              }
            }}
            placeholder={mode === 'pinyin' ? '拼音，如 yixinyiyi / yxyy' : '一个字、一个词或成语'}
            className="h-8 pl-8 text-[12px]"
            spellCheck={false}
          />
        </div>
        <SlidingSegmented
          options={IDIOM_MODES}
          value={mode}
          onValueChange={setMode}
          size="sm"
          motion="spring"
          bare
          ariaLabel="成语匹配方式"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          字数
          <SelectField
            value={length}
            onValueChange={setLength}
            options={[
              { value: '0', label: '不限' },
              ...[3, 4, 5, 6, 7, 8].map((size) => ({ value: String(size), label: `${size} 字` })),
            ]}
            ariaLabel="字数"
            size="sm"
            className="h-8 px-2 text-[11.5px]"
          />
        </label>
        <Button size="sm" variant="outline" onClick={() => void random()}>
          <Dices />
          随机一条
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {loading ? '正在查询…' : `共 ${total.toLocaleString('zh-CN')} 条`}
        </span>
      </div>

      {randomWord ? (
        <button
          type="button"
          onClick={() => void copy(randomWord)}
          className="flex shrink-0 items-center gap-2 rounded-md border border-primary/30 bg-primary/[0.08] px-3 py-2 text-left text-[15px] text-foreground transition-colors hover:bg-primary/[0.12]"
        >
          <Dices className="size-4 text-primary" aria-hidden />
          {randomWord}
          <span className="ml-auto flex items-center gap-1 text-[10.5px] text-muted-foreground">
            {copied === randomWord ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
            点击复制
          </span>
        </button>
      ) : null}

      <section className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel">
        <header className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-1.5 text-[10.5px] text-muted-foreground">
          <span className="flex-1">成语</span>
          <span className="w-12 text-right">字数</span>
          <span className="w-6" />
        </header>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin">
          {loading && items.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              正在读取…
            </p>
          ) : error ? (
            <p className="py-10 text-center text-[12px] text-muted-foreground">{error}</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-muted-foreground">
              没有匹配的成语，换个关键词或匹配方式试试。
            </p>
          ) : (
            items.map((item, index) => (
              <button
                key={`${item.word}-${index}`}
                type="button"
                onClick={() => void copy(item.word)}
                className="group flex w-full items-center gap-2 border-b border-border/25 px-3 py-1.5 text-left text-[12px] transition-colors last:border-0 hover:bg-foreground/[0.03]"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">{item.word}</span>
                <span className="w-12 text-right font-mono text-[11.5px] text-muted-foreground">
                  {item.length}
                </span>
                <span className="flex w-6 justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {copied === item.word ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                </span>
              </button>
            ))
          )}
        </div>
        <footer className="flex shrink-0 items-center gap-2 border-t border-border/40 px-3 py-2">
          <span className="text-[10.5px] text-muted-foreground">
            已显示 {items.length} / {total.toLocaleString('zh-CN')} 条
            {total > 0 && items.length < total ? '，结果未全部展示' : ''}
          </span>
          {hasMore ? (
            <Button
              size="xs"
              variant="outline"
              className="ml-auto"
              disabled={loading}
              onClick={() => void load(false, items.length)}
            >
              {loading ? <Loader2 className="animate-spin" /> : null}
              加载更多
            </Button>
          ) : null}
        </footer>
      </section>

      <p className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground/70">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/40" />
        30741 条成语；点一行复制。拼音支持全拼与首字母，例如 yixinyiyi、yxyy。
      </p>
    </main>
  )
}

type QrDotType = 'square' | 'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded'
type QrCornerType = 'square' | 'dot' | 'extra-rounded'

const QR_DOT_OPTIONS: { value: QrDotType; label: string }[] = [
  { value: 'square', label: '方形' },
  { value: 'dots', label: '点状' },
  { value: 'rounded', label: '圆形' },
  { value: 'classy', label: '优雅' },
  { value: 'classy-rounded', label: '优雅圆形' },
  { value: 'extra-rounded', label: '超圆角' },
]

const QR_CORNER_OPTIONS: { value: QrCornerType; label: string }[] = [
  { value: 'square', label: '方形' },
  { value: 'dot', label: '圆点' },
  { value: 'extra-rounded', label: '超圆角' },
]

/** 二维码生成：点形/角形/前景背景色 + 容错与尺寸，支持 PNG/SVG 下载与复制图片 */
export function QrCodeTool() {
  const [text, setText] = useState('https://example.com')
  const [level, setLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M')
  const [size, setSize] = useState(320)
  const [dotType, setDotType] = useState<QrDotType>('square')
  const [cornerType, setCornerType] = useState<QrCornerType>('square')
  const [foreground, setForeground] = useState('#111111')
  const [background, setBackground] = useState('#ffffff')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const qrRef = useRef<QRCodeStyling | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (!text.trim()) {
      container.innerHTML = ''
      qrRef.current = null
      setError(null)
      return
    }
    let alive = true
    const timer = window.setTimeout(() => {
      try {
        const qr = new QRCodeStyling({
          width: size,
          height: size,
          type: 'svg',
          data: text,
          margin: 10,
          qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: level },
          dotsOptions: { color: foreground, type: dotType },
          backgroundOptions: { color: background },
          cornersSquareOptions: { color: foreground, type: cornerType },
          cornersDotOptions: { color: foreground, type: cornerType === 'dot' ? 'dot' : 'square' },
        })
        if (!alive) return
        qrRef.current = qr
        container.innerHTML = ''
        qr.append(container)
        setError(null)
      } catch (renderError) {
        qrRef.current = null
        container.innerHTML = ''
        setError(renderError instanceof Error ? renderError.message : '二维码生成失败')
      }
    }, 240)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [text, level, size, dotType, cornerType, foreground, background])

  const rawData = async (extension: 'png' | 'svg'): Promise<Blob | null> => {
    const qr = qrRef.current
    if (!qr) return null
    const data = await qr.getRawData(extension)
    return data instanceof Blob ? data : null
  }

  const download = async (extension: 'png' | 'svg') => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const blob = await rawData(extension)
      if (!blob) return
      const path = await saveDialog({
        defaultPath: `二维码.${extension}`,
        filters: [
          extension === 'png'
            ? { name: 'PNG 图片', extensions: ['png'] }
            : { name: 'SVG 矢量图', extensions: ['svg'] },
        ],
      })
      if (!path) return
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()))
      await writeFileBytes(path, bytes)
      toast(`二维码 ${extension.toUpperCase()} 已保存`)
    } catch (saveError) {
      toast(saveError instanceof Error ? `保存失败：${saveError.message}` : '保存失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyImage = async () => {
    if (!text.trim()) return
    try {
      const blob = await rawData('png')
      if (!blob) return
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast('二维码图片已复制')
    } catch {
      toast('当前环境不支持复制图片，请用下载', 'error')
    }
  }

  const setColor = (value: string, apply: (next: string) => void) => {
    const color = value.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(color)) apply(color)
  }

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-3 px-4 pb-4">
      <section className="glass flex min-h-0 flex-col gap-2 rounded-panel p-3">
        <header className="flex h-8 shrink-0 items-center gap-2">
          <QrCode className="size-4 text-primary" />
          <h2 className="text-[13px] font-medium text-foreground">内容与样式</h2>
          <span className="ml-auto text-[10.5px] text-muted-foreground">{text.length} 字符</span>
        </header>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          placeholder="输入网址、文本、电话号码……"
          className="min-h-[72px] flex-1 resize-none rounded-md bg-transparent p-2 font-mono text-[12.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:bg-foreground/[0.025] scroll-thin"
        />

        <div className="shrink-0 space-y-2.5 border-t border-border/50 pt-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] text-muted-foreground">容错</span>
            <SlidingSegmented
              options={[
                { value: 'L', label: 'L-7%' },
                { value: 'M', label: 'M-15%' },
                { value: 'Q', label: 'Q-25%' },
                { value: 'H', label: 'H-30%' },
              ]}
              value={level}
              onValueChange={setLevel}
              size="sm"
              motion="spring"
              bare
              ariaLabel="容错级别"
            />
            <span className="text-[11px] text-muted-foreground">尺寸</span>
            <SlidingSegmented
              options={[
                { value: 256, label: '256' },
                { value: 320, label: '320' },
                { value: 512, label: '512' },
              ]}
              value={size}
              onValueChange={setSize}
              size="sm"
              motion="spring"
              bare
              ariaLabel="二维码尺寸"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">点形</span>
              <SelectField
                value={dotType}
                onValueChange={(value) => setDotType(value as QrDotType)}
                options={QR_DOT_OPTIONS}
                ariaLabel="点形"
                size="sm"
                className="h-8 w-full px-2 text-[11.5px]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">角形</span>
              <SelectField
                value={cornerType}
                onValueChange={(value) => setCornerType(value as QrCornerType)}
                options={QR_CORNER_OPTIONS}
                ariaLabel="角形"
                size="sm"
                className="h-8 w-full px-2 text-[11.5px]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
              <input
                type="color"
                value={foreground}
                onChange={(event) => setColor(event.target.value, setForeground)}
                className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label="前景色"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] text-muted-foreground">前景色</span>
                <span className="block font-mono text-[10.5px] text-foreground">{foreground}</span>
              </span>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
              <input
                type="color"
                value={background}
                onChange={(event) => setColor(event.target.value, setBackground)}
                className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label="背景色"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] text-muted-foreground">背景色</span>
                <span className="block font-mono text-[10.5px] text-foreground">{background}</span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="glass flex min-h-0 flex-col rounded-panel p-3">
        <header className="flex h-8 shrink-0 items-center gap-2">
          <h2 className="text-[13px] font-medium text-foreground">二维码结果</h2>
          <div className="ml-auto flex items-center gap-0.5">
            <Tip label="复制图片">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="复制图片"
                disabled={!text.trim()}
                onClick={() => void copyImage()}
              >
                <Copy />
              </Button>
            </Tip>
            <Tip label="下载 PNG">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="下载 PNG"
                disabled={!text.trim() || busy}
                onClick={() => void download('png')}
              >
                <Download />
              </Button>
            </Tip>
            <Tip label="下载 SVG">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="下载 SVG"
                disabled={!text.trim() || busy}
                onClick={() => void download('svg')}
              >
                <Download className="opacity-60" />
              </Button>
            </Tip>
          </div>
        </header>
        <div className="relative mt-2 flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-border/60 bg-white p-3">
          {text.trim() ? (
            <div
              ref={containerRef}
              className="max-h-full max-w-full [&>svg]:h-auto [&>svg]:max-h-full [&>svg]:w-full"
            />
          ) : (
            <p className="px-4 text-center text-[11.5px] text-muted-foreground">输入内容后自动生成</p>
          )}
          {error ? (
            <p className="absolute px-4 text-center text-[11.5px] text-destructive">{error}</p>
          ) : null}
        </div>
        <div className="mt-2 flex shrink-0 items-center gap-2 text-[10.5px] text-muted-foreground">
          <span className="font-mono">
            {size} × {size}
          </span>
          <span>·</span>
          <span>容错 {level}</span>
          <span className="ml-auto">
            {QR_DOT_OPTIONS.find((option) => option.value === dotType)?.label} /{' '}
            {QR_CORNER_OPTIONS.find((option) => option.value === cornerType)?.label}
          </span>
        </div>
      </section>
    </main>
  )
}
