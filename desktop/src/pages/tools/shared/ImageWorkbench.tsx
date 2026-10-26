import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, FolderOpen, ImagePlus, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { inTauri, invoke, saveDialog, writeFileBytes } from '@/ipc/bridge'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

export interface ImageControl {
  key: string
  label: string
  type: 'number' | 'text' | 'select' | 'switch' | 'range'
  defaultValue?: string
  options?: { value: string; label: string }[]
  min?: string
  max?: string
  step?: string
  suffix?: string
  placeholder?: string
  /** 在参数网格中占几列 */
  span?: 1 | 2
}

export interface ImageWorkbenchProps<TResult> {
  toolId: string
  hint: string
  controls: ImageControl[]
  fileName: string
  /** 由源图与参数拼出工具入参 */
  buildInput: (ctx: {
    dataUrl: string
    width: number
    height: number
    values: Record<string, string | number | boolean>
  }) => Record<string, unknown>
  /** 结果区额外信息 */
  renderMeta?: (data: TResult) => React.ReactNode
  /** 一键套用预设（裁剪比例、证件照尺寸等） */
  presets?: {
    label: string
    apply: (size: { width: number; height: number }) => Record<string, string>
  }[]
  /** 只显示结果图的工具（不需要裁剪框覆盖层） */
  showCropOverlay?: boolean
  /** 参数变化后自动重跑（滑块实时预览） */
  autoRun?: boolean
  /** 结果区显示「复制图片」 */
  showCopy?: boolean
  /** 参数记忆的 localStorage 键 */
  storageKey?: string
}

const defaultValues = (controls: ImageControl[]): Record<string, string> =>
  Object.fromEntries(
    controls.map((control) => [control.key, control.defaultValue ?? (control.type === 'select' ? (control.options?.[0]?.value ?? '') : control.type === 'switch' ? 'false' : '')]),
  )

const initialValues = (controls: ImageControl[], storageKey?: string): Record<string, string> => {
  const values = defaultValues(controls)
  if (!storageKey || typeof window === 'undefined') return values
  try {
    const raw = window.localStorage.getItem(storageKey)
    const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
    if (!saved || typeof saved !== 'object') return values
    for (const control of controls) {
      const value = saved[control.key]
      if (typeof value === 'string') values[control.key] = value
    }
  } catch {
    // 损坏的本地配置按默认值处理
  }
  return values
}

/** data URL → 字节：同时支持 base64 与 URI 编码（SVG） */
export const dataUrlToBytes = (dataUrl: string): number[] => {
  const comma = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, Math.max(0, comma))
  const payload = dataUrl.slice(comma + 1)
  if (!meta.includes(';base64')) {
    return Array.from(new TextEncoder().encode(decodeURIComponent(payload)))
  }
  const binary = atob(payload)
  const bytes = new Array<number>(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 读取文件为 data URL */
export const readFileDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })

/** 加载 data URL 为 HTMLImageElement */
export const loadImageElement = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = dataUrl
  })

export interface LoadedImage {
  dataUrl: string
  width: number
  height: number
}

/** 文件 → 已探测尺寸的图片 */
export const fileToLoadedImage = async (file: File): Promise<LoadedImage> => {
  const dataUrl = await readFileDataUrl(file)
  const image = await loadImageElement(dataUrl)
  return { dataUrl, width: image.naturalWidth, height: image.naturalHeight }
}

/** data URL → PNG（复制到剪贴板时 PNG 兼容性最好） */
const toPngDataUrl = async (dataUrl: string): Promise<string> => {
  if (dataUrl.startsWith('data:image/png')) return dataUrl
  const image = await loadImageElement(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('拿不到 canvas 上下文')
  ctx.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

/** 复制图片到剪贴板：桌面端走宿主 arboard，浏览器预览走 Clipboard API */
export async function copyImageDataUrl(dataUrl: string): Promise<void> {
  const png = await toPngDataUrl(dataUrl)
  const base64 = png.slice(png.indexOf(',') + 1)
  if (inTauri()) {
    await invoke('plugin:clipboard|write_image', { base64Image: base64 })
    return
  }
  if (!navigator.clipboard?.write) throw new Error('当前环境不支持复制图片')
  const blob = await (await fetch(png)).blob()
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

/** 从剪贴板读取图片，返回 data URL */
export async function readClipboardImageDataUrl(): Promise<string | null> {
  if (inTauri()) {
    const base64 = await invoke<string>('plugin:clipboard|read_image')
    return base64 ? `data:image/png;base64,${base64}` : null
  }
  if (!navigator.clipboard?.read) return null
  const items = await navigator.clipboard.read()
  for (const item of items) {
    const type = item.types.find((entry) => entry.startsWith('image/'))
    if (!type) continue
    const blob = await item.getType(type)
    return readFileDataUrl(new File([blob], 'clipboard.png', { type }))
  }
  return null
}

/** 页面级选图/拖入/粘贴状态 */
export function useImageSource() {
  const [source, setSource] = useState<LoadedImage | null>(null)

  const loadDataUrl = useCallback(async (dataUrl: string) => {
    const image = await loadImageElement(dataUrl)
    setSource({ dataUrl, width: image.naturalWidth, height: image.naturalHeight })
  }, [])

  const loadFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return
      if (!file.type.startsWith('image/')) {
        toast('请选择图片文件', 'error')
        return
      }
      try {
        setSource(await fileToLoadedImage(file))
      } catch {
        toast('图片读取失败', 'error')
      }
    },
    [],
  )

  const loadClipboard = useCallback(async () => {
    try {
      const dataUrl = await readClipboardImageDataUrl()
      if (!dataUrl) {
        toast('剪贴板里没有图片', 'error')
        return
      }
      await loadDataUrl(dataUrl)
    } catch {
      toast('读取剪贴板图片失败', 'error')
    }
  }, [loadDataUrl])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((entry) => entry.type.startsWith('image/'))
      if (!item) return
      event.preventDefault()
      void loadFile(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadFile])

  return { source, setSource, loadDataUrl, loadFile, loadClipboard }
}

/** 图片工具共用工作台：选图 → 调参 → 出图 → 保存 */
export function ImageWorkbench<TResult extends { dataUrl: string; width: number; height: number }>({
  toolId,
  hint,
  controls,
  fileName,
  buildInput,
  renderMeta,
  presets,
  autoRun = false,
  showCopy = false,
  storageKey,
}: ImageWorkbenchProps<TResult>) {
  const Icon = pluginIcon(toolId)
  const [source, setSource] = useState<string>('')
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(controls, storageKey))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const runRef = useRef<() => Promise<void>>(async () => {})
  const runRequestRef = useRef(0)

  useEffect(() => {
    if (!storageKey) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(values))
    } catch {
      // 存储满/被禁用时静默失败，不影响当前操作
    }
  }, [storageKey, values])

  // 换图时让仍在进行的请求作废
  useEffect(() => {
    runRequestRef.current += 1
    setLoading(false)
  }, [source])

  const loadFile = useCallback((file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '')
      const probe = new Image()
      probe.onload = () => {
        setSource(dataUrl)
        setSize({ width: probe.naturalWidth, height: probe.naturalHeight })
        setResult(null)
        setError(null)
        setSaved(false)
      }
      probe.onerror = () => toast('图片读取失败', 'error')
      probe.src = dataUrl
    }
    reader.onerror = () => toast('图片读取失败', 'error')
    reader.readAsDataURL(file)
  }, [])

  // 支持直接把剪贴板里的图片粘进来
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((entry) => entry.type.startsWith('image/'))
      if (item) {
        event.preventDefault()
        loadFile(item.getAsFile())
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadFile])

  const setValue = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  const applyPreset = (preset: NonNullable<ImageWorkbenchProps<TResult>['presets']>[number]) => {
    if (!size) return
    setValues((current) => ({ ...current, ...preset.apply(size) }))
  }

  const run = async () => {
    if (!source || !size) return
    const request = ++runRequestRef.current
    setLoading(true)
    try {
      const parsed: Record<string, string | number | boolean> = {}
      for (const control of controls) {
        const raw = values[control.key] ?? ''
        parsed[control.key] =
          control.type === 'number' || control.type === 'range'
            ? Number(raw)
            : control.type === 'switch'
              ? raw === 'true'
              : raw
      }
      const response = await runTool<TResult>(toolId, buildInput({ dataUrl: source, width: size.width, height: size.height, values: parsed }))
      if (request !== runRequestRef.current) return
      if (response.ok) {
        setResult(response.data)
        setError(null)
        setSaved(false)
      } else {
        setResult(null)
        setError(response.error.message)
      }
    } catch (runError) {
      if (request !== runRequestRef.current) return
      setResult(null)
      setError(runError instanceof Error ? runError.message : '处理失败')
    } finally {
      if (request === runRequestRef.current) setLoading(false)
    }
  }
  runRef.current = run

  // 滑块/开关变化后自动重跑；防抖避免拖动过程中堆积任务
  useEffect(() => {
    if (!autoRun || !source || !size) return
    const timer = window.setTimeout(() => {
      void runRef.current()
    }, 160)
    return () => window.clearTimeout(timer)
  }, [autoRun, source, size, values])

  const copy = async () => {
    if (!result) return
    try {
      await copyImageDataUrl(result.dataUrl)
      toast('图片已复制')
    } catch (copyError) {
      toast(copyError instanceof Error ? `复制失败：${copyError.message}` : '复制失败', 'error')
    }
  }

  const save = async () => {
    if (!result) return
    try {
      const path = await saveDialog({ defaultPath: fileName, filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] })
      if (!path) return
      await writeFileBytes(path, dataUrlToBytes(result.dataUrl))
      setSaved(true)
      toast('已保存')
      window.setTimeout(() => setSaved(false), 1500)
    } catch (saveError) {
      toast(saveError instanceof Error ? `保存失败：${saveError.message}` : '保存失败', 'error')
    }
  }

  const cropOverlay =
    size && values.x !== undefined && values.width !== undefined && Number(values.width) > 0
      ? {
          left: `${(Number(values.x) / size.width) * 100}%`,
          top: `${(Number(values.y) / size.height) * 100}%`,
          width: `${(Number(values.width) / size.width) * 100}%`,
          height: `${(Number(values.height) / size.height) * 100}%`,
        }
      : null

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        {hint}
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Icon className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">原图</h2>
            <Tip label="选择图片文件">
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto"
                aria-label="选择图片文件"
                onClick={() => fileRef.current?.click()}
              >
                <FolderOpen />
              </Button>
            </Tip>
          </header>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => loadFile(event.target.files?.[0])}
          />

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              loadFile(event.dataTransfer.files?.[0])
            }}
            className="relative mt-2 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-dashed border-border/60 bg-foreground/[0.02]"
          >
            {source ? (
              <>
                <img
                  src={source}
                  alt="原图预览"
                  className="max-h-full max-w-full object-contain"
                />
                {cropOverlay ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute border-2 border-primary/70 bg-primary/10"
                    style={cropOverlay}
                  />
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                <ImagePlus className="size-6" />
                <p className="text-[12px]">把图片拖进来，或点右上角选文件</p>
                <p className="text-[10.5px] text-muted-foreground/70">也支持直接 Ctrl+V 粘贴剪贴板里的图</p>
              </div>
            )}
          </div>
          {size ? (
            <p className="mt-1.5 shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              源图 {size.width} × {size.height}
            </p>
          ) : null}
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">参数</h2>
            {presets?.length ? (
              <span className="ml-auto flex flex-wrap items-center gap-1">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={!size}
                    onClick={() => applyPreset(preset)}
                    className="rounded-full border border-border/60 px-2 py-0.5 text-[10.5px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </span>
            ) : null}
          </header>

          <div className="mt-2 grid max-h-[46%] shrink-0 grid-cols-2 gap-2 overflow-y-auto px-1 scroll-thin">
            {controls.map((control) => (
              <label
                key={control.key}
                className={cn('flex flex-col gap-1', control.span === 2 && 'col-span-2')}
              >
                <span className="text-[10.5px] text-muted-foreground">{control.label}</span>
                {control.type === 'switch' ? (
                  <button
                    type="button"
                    onClick={() => setValue(control.key, values[control.key] === 'true' ? 'false' : 'true')}
                    aria-pressed={values[control.key] === 'true'}
                    className={cn(
                      'h-8 rounded-md border px-2 text-[11.5px] transition-colors',
                      values[control.key] === 'true'
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border/60 text-muted-foreground',
                    )}
                  >
                    {values[control.key] === 'true' ? '开' : '关'}
                  </button>
                ) : control.type === 'select' ? (
                  <SelectField
                    value={values[control.key] ?? ''}
                    onValueChange={(value) => setValue(control.key, value)}
                    options={control.options ?? []}
                    ariaLabel={control.label}
                    size="sm"
                    className="h-8 w-full px-2 text-[11.5px]"
                  />
                ) : control.type === 'range' ? (
                  <span className="flex h-8 items-center gap-2 rounded-md border border-border/60 px-2">
                    <input
                      type="range"
                      value={values[control.key] ?? control.min ?? '0'}
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      onChange={(event) => setValue(control.key, event.target.value)}
                      className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-foreground/15 accent-primary"
                    />
                    <span className="w-12 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
                      {values[control.key] ?? ''}
                    </span>
                  </span>
                ) : (
                  <Input
                    value={values[control.key] ?? ''}
                    onChange={(event) => setValue(control.key, event.target.value)}
                    type={control.type === 'number' ? 'number' : 'text'}
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    placeholder={control.placeholder}
                    className="h-8 text-[11.5px]"
                  />
                )}
              </label>
            ))}
          </div>

          <Button size="sm" className="mt-2" disabled={!source || loading} onClick={() => void run()}>
            {loading ? <Loader2 className="animate-spin" /> : <Play />}
            {loading ? '处理中…' : '生成结果'}
          </Button>

          {error ? (
            <p className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] leading-5 text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            {result ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {result.width} × {result.height}
                  </span>
                  {renderMeta ? renderMeta(result) : null}
                  <span className="ml-auto flex items-center gap-1">
                    {showCopy ? (
                      <Tip label="复制图片到剪贴板">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="复制图片"
                          onClick={() => void copy()}
                        >
                          <Copy />
                        </Button>
                      </Tip>
                    ) : null}
                    <Tip label="保存到本地">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="保存结果"
                        onClick={() => void save()}
                      >
                        {saved ? <Check className="text-success" /> : <Download />}
                      </Button>
                    </Tip>
                  </span>
                </div>
                <div className="mt-1.5 min-h-0 flex-1 overflow-hidden rounded-md border border-border/50 bg-foreground/[0.02]">
                  <img src={result.dataUrl} alt="处理结果" className="max-h-full max-w-full object-contain" />
                </div>
              </>
            ) : (
              <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-md border border-dashed border-border/60 text-[11.5px] text-muted-foreground">
                结果会显示在这里
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
