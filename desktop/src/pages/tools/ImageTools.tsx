import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import {
  ClipboardPaste,
  Copy,
  Download,
  FileImage,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  IdCard,
  ImagePlus,
  Images,
  Link2,
  Loader2,
  Pipette,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  UserRound,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberField } from '@/components/ui/number-field'
import { SelectField } from '@/components/ui/select-field'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { copyText } from '@/lib/clipboard'
import { openDialog, saveDialog, writeFileBytes } from '@/ipc/bridge'
import { runTool } from '@/lib/tool-core'
import {
  ImageWorkbench,
  copyImageDataUrl,
  dataUrlToBytes,
  loadImageElement,
  readFileDataUrl,
  useImageSource,
} from './shared/ImageWorkbench'
import type { LoadedImage } from './shared/ImageWorkbench'

interface ImageResult {
  dataUrl: string
  width: number
  height: number
  bytes: number
}

const formatBytes = (value: number): string => {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

const clampInt = (value: string | number, min: number, max: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return min
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

const saveImageDataUrl = async (dataUrl: string, defaultPath: string): Promise<boolean> => {
  const path = await saveDialog({
    defaultPath,
    filters: [{ name: '图片', extensions: [defaultPath.split('.').pop() ?? 'png'] }],
  })
  if (!path) return false
  await writeFileBytes(path, dataUrlToBytes(dataUrl))
  return true
}

// ---------------------------------------------------------------------------
// 图片裁剪 / 头像裁剪 / 证件照
// ---------------------------------------------------------------------------

type CropMode = 'free' | 'avatar' | 'id'

interface SourceStageProps {
  source: LoadedImage | null
  onFile: (file: File) => void
  onClipboard: () => void
  children: ReactNode
  hint: string
}

/** 左侧选图区：点选 / 拖入 / 读剪贴板 */
function SourceStage({ source, onFile, onClipboard, children, hint }: SourceStageProps) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <section className="glass flex min-h-0 flex-col rounded-panel p-3">
      <header className="flex h-8 shrink-0 items-center gap-2">
        <ImagePlus className="size-4 text-primary" />
        <h2 className="text-[13px] font-medium text-foreground">原图</h2>
        {source ? (
          <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {source.width} × {source.height}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          <Tip label="读取剪贴板图片">
            <Button variant="ghost" size="icon-xs" aria-label="读取剪贴板图片" onClick={onClipboard}>
              <ClipboardPaste />
            </Button>
          </Tip>
          <Tip label="选择图片文件">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="选择图片文件"
              onClick={() => fileRef.current?.click()}
            >
              <FolderOpen />
            </Button>
          </Tip>
        </span>
      </header>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files?.[0]
          if (file) onFile(file)
        }}
        className={cn(
          'relative mt-2 flex min-h-0 flex-1 overflow-hidden rounded-md border border-dashed border-border/60 bg-foreground/[0.02]',
          dragging && 'border-primary/60 bg-primary/5',
        )}
      >
        {source ? (
          children
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-center text-muted-foreground">
            <ImagePlus className="size-6" />
            <p className="text-[12px]">把图片拖进来，或点右上角选文件</p>
            <p className="text-[10.5px] text-muted-foreground/70">也支持直接 Ctrl+V 粘贴剪贴板里的图</p>
          </div>
        )}
        {dragging ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-primary/5 text-[12px] font-medium text-primary">
            松开即可载入图片
          </div>
        ) : null}
      </div>
      <p className="mt-1.5 shrink-0 text-[10.5px] text-muted-foreground">{hint}</p>
    </section>
  )
}

const freeRatioPresets = [
  { key: '16:9', label: '16:9', width: 16, height: 9 },
  { key: '4:3', label: '4:3', width: 4, height: 3 },
  { key: '1:1', label: '1:1', width: 1, height: 1 },
  { key: '2:3', label: '2:3', width: 2, height: 3 },
  { key: 'custom', label: '自定义', width: 3, height: 2 },
] as const

type RatioKey = (typeof freeRatioPresets)[number]['key']

const idPhotoPresets = [
  { key: '1', label: '1 寸', width: 295, height: 413 },
  { key: '2', label: '2 寸', width: 413, height: 626 },
  { key: 'small2', label: '小 2 寸', width: 390, height: 567 },
  { key: 'custom', label: '自定义', width: 295, height: 413 },
] as const

type IdPhotoKey = (typeof idPhotoPresets)[number]['key']

/** 翻转图片（react-easy-crop 没有内置翻转，先把源图翻好再送进去） */
async function flipImageDataUrl(
  dataUrl: string,
  horizontal: boolean,
  vertical: boolean,
): Promise<string> {
  const image = await loadImageElement(dataUrl)
  const width = image.naturalWidth
  const height = image.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('拿不到 canvas 上下文')
  ctx.translate(horizontal ? width : 0, vertical ? height : 0)
  ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1)
  ctx.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

/** 按 react-easy-crop 给出的像素区域裁剪，并处理 rotation / 目标尺寸 / 圆形遮罩 */
async function cropImageCanvas(
  dataUrl: string,
  area: Area,
  rotation: number,
  target: { width: number; height: number } | undefined,
  circular: boolean,
  fillWhite: boolean,
): Promise<HTMLCanvasElement> {
  const image = await loadImageElement(dataUrl)
  const radians = (rotation * Math.PI) / 180
  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  const cropWidth = Math.max(1, Math.round(area.width))
  const cropHeight = Math.max(1, Math.round(area.height))
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = cropWidth
  cropCanvas.height = cropHeight
  const cropCtx = cropCanvas.getContext('2d')
  if (!cropCtx) throw new Error('拿不到 canvas 上下文')

  if (Math.abs(rotation % 360) < 0.001) {
    // 未旋转时直接按源图坐标裁剪，避免为超大图创建整张画布
    cropCtx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, cropWidth, cropHeight)
  } else {
    const boundWidth = Math.max(
      1,
      Math.ceil(Math.abs(naturalWidth * Math.cos(radians)) + Math.abs(naturalHeight * Math.sin(radians))),
    )
    const boundHeight = Math.max(
      1,
      Math.ceil(Math.abs(naturalWidth * Math.sin(radians)) + Math.abs(naturalHeight * Math.cos(radians))),
    )
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = boundWidth
    sourceCanvas.height = boundHeight
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) throw new Error('拿不到 canvas 上下文')
    sourceCtx.translate(boundWidth / 2, boundHeight / 2)
    sourceCtx.rotate(radians)
    sourceCtx.drawImage(image, -naturalWidth / 2, -naturalHeight / 2)
    cropCtx.drawImage(sourceCanvas, area.x, area.y, area.width, area.height, 0, 0, cropWidth, cropHeight)
  }

  const outWidth = Math.max(1, Math.round(target?.width ?? cropWidth))
  const outHeight = Math.max(1, Math.round(target?.height ?? cropHeight))
  const output = document.createElement('canvas')
  output.width = outWidth
  output.height = outHeight
  const outCtx = output.getContext('2d')
  if (!outCtx) throw new Error('拿不到 canvas 上下文')
  if (fillWhite) {
    outCtx.fillStyle = '#ffffff'
    outCtx.fillRect(0, 0, outWidth, outHeight)
  }
  if (circular) {
    outCtx.save()
    outCtx.beginPath()
    outCtx.ellipse(outWidth / 2, outHeight / 2, outWidth / 2, outHeight / 2, 0, 0, Math.PI * 2)
    outCtx.clip()
  }
  outCtx.drawImage(cropCanvas, 0, 0, outWidth, outHeight)
  if (circular) outCtx.restore()
  return output
}

interface CropWorkspaceProps {
  mode: CropMode
  source: LoadedImage | null
  onFile: (file: File) => void
  onClipboard: () => void
}

function CropWorkspace({ mode, source, onFile, onClipboard }: CropWorkspaceProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [displaySrc, setDisplaySrc] = useState('')
  const [area, setArea] = useState<Area | null>(null)
  const [result, setResult] = useState<ImageResult | null>(null)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState('')

  const [ratioKey, setRatioKey] = useState<RatioKey>('16:9')
  const [ratioWidth, setRatioWidth] = useState('16')
  const [ratioHeight, setRatioHeight] = useState('9')
  const [avatarShape, setAvatarShape] = useState<'circle' | 'square'>('circle')
  const [idKey, setIdKey] = useState<IdPhotoKey>('1')
  const [customWidth, setCustomWidth] = useState('295')
  const [customHeight, setCustomHeight] = useState('413')

  const idPreset = idPhotoPresets.find((preset) => preset.key === idKey) ?? idPhotoPresets[0]
  const idWidth = idKey === 'custom' ? clampInt(customWidth, 10, 4000) : idPreset.width
  const idHeight = idKey === 'custom' ? clampInt(customHeight, 10, 4000) : idPreset.height
  const aspect =
    mode === 'free'
      ? ratioKey === 'custom'
        ? clampInt(ratioWidth, 1, 100) / clampInt(ratioHeight, 1, 100)
        : (freeRatioPresets.find((preset) => preset.key === ratioKey) ?? freeRatioPresets[0]).width /
          (freeRatioPresets.find((preset) => preset.key === ratioKey) ?? freeRatioPresets[0]).height
      : mode === 'avatar'
        ? 1
        : idWidth / idHeight

  useEffect(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setArea(null)
    setResult(null)
    setRendering(false)
    setError('')
  }, [source?.dataUrl, mode])

  useEffect(() => {
    if (!source) {
      setDisplaySrc('')
      return
    }
    if (mode !== 'free' || (!flipH && !flipV)) {
      setDisplaySrc(source.dataUrl)
      return
    }
    let cancelled = false
    void flipImageDataUrl(source.dataUrl, flipH, flipV)
      .then((flipped) => {
        if (cancelled) return
        setDisplaySrc(flipped)
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setArea(null)
        setResult(null)
      })
      .catch(() => toast('翻转图片失败', 'error'))
    return () => {
      cancelled = true
    }
  }, [source, flipH, flipV, mode])

  const renderOutput = useCallback(async (): Promise<ImageResult | null> => {
    if (!displaySrc || !area || area.width < 1 || area.height < 1) return null
    const target = mode === 'id' ? { width: idWidth, height: idHeight } : undefined
    const canvas = await cropImageCanvas(
      displaySrc,
      area,
      rotation,
      target,
      mode === 'avatar' && avatarShape === 'circle',
      mode === 'id',
    )
    const dataUrl = canvas.toDataURL('image/png')
    return {
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      bytes: Math.round((dataUrl.length * 3) / 4),
    }
  }, [displaySrc, area, rotation, mode, idWidth, idHeight, avatarShape])

  useEffect(() => {
    if (!displaySrc || !area) return
    let cancelled = false
    setRendering(true)
    const timer = window.setTimeout(() => {
      void renderOutput()
        .then((output) => {
          if (cancelled) return
          if (output) {
            setResult(output)
            setError('')
          }
        })
        .catch((renderError) => {
          if (cancelled) return
          setResult(null)
          setError(renderError instanceof Error ? renderError.message : '生成预览失败')
        })
        .finally(() => {
          if (!cancelled) setRendering(false)
        })
    }, 140)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [renderOutput, displaySrc, area])

  const currentOutput = async (): Promise<ImageResult | null> => {
    try {
      const output = await renderOutput()
      if (!output) {
        toast('请先选择图片并调整裁剪框', 'error')
        return null
      }
      setResult(output)
      return output
    } catch (renderError) {
      toast(renderError instanceof Error ? `生成失败：${renderError.message}` : '生成失败', 'error')
      return null
    }
  }

  const copyResult = async () => {
    const output = await currentOutput()
    if (!output) return
    try {
      await copyImageDataUrl(output.dataUrl)
      toast('图片已复制')
    } catch (copyError) {
      toast(copyError instanceof Error ? `复制失败：${copyError.message}` : '复制失败', 'error')
    }
  }

  const downloadResult = async () => {
    const output = await currentOutput()
    if (!output) return
    const name =
      mode === 'free' ? 'cropped.png' : mode === 'avatar' ? 'avatar.png' : `id-photo-${idWidth}x${idHeight}.png`
    try {
      if (await saveImageDataUrl(output.dataUrl, name)) toast('图片已保存')
    } catch (saveError) {
      toast(saveError instanceof Error ? `保存失败：${saveError.message}` : '保存失败', 'error')
    }
  }

  const rotate = (delta: number) => {
    setRotation((current) => current + delta)
  }

  const outputArea =
    mode === 'id'
      ? { width: idWidth, height: idHeight }
      : area
        ? { width: Math.round(area.width), height: Math.round(area.height) }
        : null

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-3">
      <SourceStage source={source} onFile={onFile} onClipboard={onClipboard} hint="拖动画面移动取景，滚轮或下方滑杆缩放。">
        {displaySrc ? (
          <div className="flex h-full w-full flex-col">
            <div className="relative min-h-0 flex-1">
              <Cropper
                image={displaySrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                cropShape={mode === 'avatar' && avatarShape === 'circle' ? 'round' : 'rect'}
                showGrid={mode === 'free'}
                minZoom={1}
                maxZoom={5}
                zoomWithScroll
                restrictPosition
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={(_croppedArea, croppedAreaPixels) => setArea(croppedAreaPixels)}
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/50 bg-card/60 px-2 py-1.5">
              <ZoomOut className="size-3.5 text-muted-foreground" aria-hidden />
              <input
                type="range"
                min={1}
                max={5}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                aria-label="缩放"
                className="h-1 min-w-[70px] flex-1 cursor-pointer appearance-none rounded-full bg-foreground/15 accent-primary"
              />
              <ZoomIn className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="w-9 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {zoom.toFixed(1)}x
              </span>
              <Tip label="左转 90°">
                <Button variant="ghost" size="icon-xs" aria-label="左转 90 度" onClick={() => rotate(-90)}>
                  <RotateCcw />
                </Button>
              </Tip>
              <Tip label="右转 90°">
                <Button variant="ghost" size="icon-xs" aria-label="右转 90 度" onClick={() => rotate(90)}>
                  <RotateCw />
                </Button>
              </Tip>
              {mode === 'free' ? (
                <>
                  <Tip label="水平翻转">
                    <Button
                      variant={flipH ? 'default' : 'ghost'}
                      size="icon-xs"
                      aria-label="水平翻转"
                      onClick={() => setFlipH((value) => !value)}
                    >
                      <FlipHorizontal2 />
                    </Button>
                  </Tip>
                  <Tip label="垂直翻转">
                    <Button
                      variant={flipV ? 'default' : 'ghost'}
                      size="icon-xs"
                      aria-label="垂直翻转"
                      onClick={() => setFlipV((value) => !value)}
                    >
                      <FlipVertical2 />
                    </Button>
                  </Tip>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </SourceStage>

      <section className="glass flex min-h-0 flex-col rounded-panel p-3">
        <header className="flex h-8 shrink-0 items-center gap-2">
          {mode === 'free' ? <Scissors className="size-4 text-primary" /> : null}
          {mode === 'avatar' ? <UserRound className="size-4 text-primary" /> : null}
          {mode === 'id' ? <IdCard className="size-4 text-primary" /> : null}
          <h2 className="text-[13px] font-medium text-foreground">
            {mode === 'free' ? '交互裁剪' : mode === 'avatar' ? '头像裁剪' : '证件照'}
          </h2>
          {rendering ? <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" /> : null}
        </header>

        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 scroll-thin">
          {mode === 'free' ? (
            <>
              <p className="text-[10.5px] text-muted-foreground">裁剪比例</p>
              <SlidingSegmented
                options={freeRatioPresets.map((preset) => ({ value: preset.key, label: preset.label }))}
                value={ratioKey}
                onValueChange={(value) => {
                  setRatioKey(value)
                  setCrop({ x: 0, y: 0 })
                  setZoom(1)
                }}
                ariaLabel="裁剪比例"
              />
              {ratioKey === 'custom' ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] text-muted-foreground">比例宽</span>
                    <NumberField
                      min={1}
                      max={100}
                      value={Number(ratioWidth)}
                      onChange={(next) => setRatioWidth(String(next))}
                      className="h-8 text-[11.5px]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] text-muted-foreground">比例高</span>
                    <NumberField
                      min={1}
                      max={100}
                      value={Number(ratioHeight)}
                      onChange={(next) => setRatioHeight(String(next))}
                      className="h-8 text-[11.5px]"
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === 'avatar' ? (
            <>
              <p className="text-[10.5px] text-muted-foreground">头像形状</p>
              <SlidingSegmented
                options={[
                  { value: 'circle', label: '圆形' },
                  { value: 'square', label: '方形' },
                ]}
                value={avatarShape}
                onValueChange={setAvatarShape}
                ariaLabel="头像形状"
              />
              <div className="mt-1 flex items-center gap-3 rounded-md border border-border/60 bg-foreground/[0.02] p-2.5">
                <div
                  className="shrink-0 overflow-hidden border border-border/60 bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]"
                  style={{ width: 100, height: 100, borderRadius: avatarShape === 'circle' ? '50%' : 8 }}
                >
                  {result ? (
                    <img src={result.dataUrl} alt="100 像素头像预览" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">100px</div>
                  )}
                </div>
                <p className="text-[10.5px] leading-5 text-muted-foreground">
                  100 × 100 实时预览
                  <br />
                  输出 PNG，圆形模式保留透明角
                </p>
              </div>
            </>
          ) : null}

          {mode === 'id' ? (
            <>
              <p className="text-[10.5px] text-muted-foreground">证件照尺寸</p>
              <div className="grid grid-cols-2 gap-1.5">
                {idPhotoPresets.map((preset) => {
                  const active = idKey === preset.key
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        setIdKey(preset.key)
                        setCrop({ x: 0, y: 0 })
                        setZoom(1)
                      }}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-center transition-colors',
                        active
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                      )}
                    >
                      <span className="block text-[11.5px] font-medium">{preset.label}</span>
                      <span className="mt-0.5 block font-mono text-[9.5px] opacity-75">
                        {preset.key === 'custom' ? '手动设置' : `${preset.width} × ${preset.height}`}
                      </span>
                    </button>
                  )
                })}
              </div>
              {idKey === 'custom' ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] text-muted-foreground">宽度（px）</span>
                    <NumberField
                      min={10}
                      max={4000}
                      value={Number(customWidth)}
                      onChange={(next) => setCustomWidth(String(next))}
                      className="h-8 text-[11.5px]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] text-muted-foreground">高度（px）</span>
                    <NumberField
                      min={10}
                      max={4000}
                      value={Number(customHeight)}
                      onChange={(next) => setCustomHeight(String(next))}
                      className="h-8 text-[11.5px]"
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="flex items-center justify-between rounded-md border border-border/60 bg-foreground/[0.02] px-2.5 py-1.5">
            <span className="text-[10.5px] text-muted-foreground">输出尺寸</span>
            <span className="font-mono text-[11.5px] tabular-nums text-foreground">
              {outputArea ? `${outputArea.width} × ${outputArea.height}` : '—'}
            </span>
          </div>

          {error ? (
            <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] leading-5 text-destructive">{error}</p>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col justify-end">
            {mode !== 'avatar' && result ? (
              <div className="mb-2 grid min-h-[100px] flex-1 place-items-center overflow-hidden rounded-md border border-border/50 bg-[repeating-conic-gradient(#00000008_0%_25%,transparent_0%_50%)] bg-[length:14px_14px] p-2">
                <img src={result.dataUrl} alt="裁剪结果预览" className="max-h-full max-w-full object-contain" />
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5" onClick={() => void copyResult()}>
                <Copy className="size-3.5" aria-hidden />
                复制图片
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => void downloadResult()}>
                <Download className="size-3.5" aria-hidden />
                下载
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export function ImageCropTool() {
  const { source, loadFile, loadClipboard } = useImageSource()
  const [mode, setMode] = useState<CropMode>('free')

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <SlidingSegmented
          options={[
            { value: 'free', label: '交互裁剪' },
            { value: 'avatar', label: '头像' },
            { value: 'id', label: '证件照' },
          ]}
          value={mode}
          onValueChange={setMode}
          ariaLabel="裁剪模式"
        />
        <p className="text-[11px] text-muted-foreground">
          {mode === 'free'
            ? '选图后拖动取景，支持缩放、旋转与水平/垂直翻转'
            : mode === 'avatar'
              ? '固定 1:1，可切换圆形/方形，实时查看 100px 头像效果'
              : '1 寸 295×413、2 寸 413×626、小 2 寸 390×567，也可自定义尺寸'}
        </p>
      </div>
      <CropWorkspace
        key={mode}
        mode={mode}
        source={source}
        onFile={loadFile}
        onClipboard={loadClipboard}
      />
    </main>
  )
}

// ---------------------------------------------------------------------------
// 图片压缩（多图批量）
// ---------------------------------------------------------------------------

interface CompressResult {
  dataUrl: string
  width: number
  height: number
  bytes: number
  beforeBytes: number
  savedPercent: number
}

type CompressFormat = 'jpeg' | 'webp' | 'png'

interface CompressSettings {
  quality: string
  maxEdge: string
  format: CompressFormat
}

interface CompressItem {
  id: string
  name: string
  size: number
  dataUrl: string
  status: 'pending' | 'running' | 'done' | 'error'
  format?: CompressFormat
  result?: CompressResult
  error?: string
}

const COMPRESS_STORAGE_KEY = 'matcha-puff/image-compress'
const QUALITY_PRESETS = [20, 30, 40, 50, 60, 70, 80] as const

const readCompressSettings = (): CompressSettings => {
  const fallback: CompressSettings = { quality: '80', maxEdge: '', format: 'jpeg' }
  try {
    const raw = window.localStorage.getItem(COMPRESS_STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as Partial<CompressSettings>) : null
    if (!saved || typeof saved !== 'object') return fallback
    const quality = Number(saved.quality)
    const format = saved.format
    return {
      quality: Number.isFinite(quality) ? String(Math.min(100, Math.max(5, Math.round(quality)))) : fallback.quality,
      maxEdge: typeof saved.maxEdge === 'string' ? saved.maxEdge : fallback.maxEdge,
      format: format === 'webp' || format === 'png' || format === 'jpeg' ? format : fallback.format,
    }
  } catch {
    return fallback
  }
}

const extensionOfFormat = (format: CompressFormat): string => (format === 'jpeg' ? 'jpg' : format)

const joinPath = (directory: string, name: string): string => {
  const separator = directory.includes('\\') ? '\\' : '/'
  return `${directory.replace(/[\\/]+$/, '')}${separator}${name}`
}

export function ImageCompressTool() {
  const [settings, setSettings] = useState<CompressSettings>(readCompressSettings)
  const [items, setItems] = useState<CompressItem[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const idRef = useRef(0)

  useEffect(() => {
    try {
      window.localStorage.setItem(COMPRESS_STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // 忽略存储异常
    }
  }, [settings])

  const addFiles = async (files: FileList | File[]) => {
    const images = [...files].filter((file) => file.type.startsWith('image/'))
    if (!images.length) {
      toast('请选择图片文件', 'error')
      return
    }
    const next: CompressItem[] = []
    for (const file of images) {
      try {
        const dataUrl = await readFileDataUrl(file)
        idRef.current += 1
        next.push({
          id: `image-${idRef.current}`,
          name: file.name,
          size: file.size,
          dataUrl,
          status: 'pending',
        })
      } catch {
        toast(`读取 ${file.name} 失败`, 'error')
      }
    }
    setItems((current) => [...current, ...next])
  }

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  const compressAll = async () => {
    if (!items.length || busy) {
      if (!items.length) toast('请先添加图片', 'error')
      return
    }
    setBusy(true)
    const edge =
      settings.maxEdge.trim() === '' ? undefined : clampInt(settings.maxEdge, 16, 20_000)
    const quality = Math.min(1, Math.max(0.05, clampInt(settings.quality, 5, 100) / 100))
    let success = 0

    for (const item of items) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, status: 'running', result: undefined, error: undefined } : entry,
        ),
      )
      try {
        const response = await runTool<CompressResult>('image-compress', {
          dataUrl: item.dataUrl,
          scale: 1,
          quality,
          ...(edge === undefined ? {} : { maxEdge: edge }),
          format: settings.format,
        })
        if (response.ok) {
          success += 1
          setItems((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: 'done', result: response.data, format: settings.format, error: undefined }
                : entry,
            ),
          )
        } else {
          setItems((current) =>
            current.map((entry) =>
              entry.id === item.id ? { ...entry, status: 'error', result: undefined, error: response.error.message } : entry,
            ),
          )
        }
      } catch (error) {
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: 'error', result: undefined, error: error instanceof Error ? error.message : '压缩失败' }
              : entry,
          ),
        )
      }
    }

    setBusy(false)
    toast(`压缩完成：成功 ${success} / ${items.length}`)
  }

  const saveItem = async (item: CompressItem) => {
    if (!item.result) return
    const format = item.format ?? settings.format
    const extension = extensionOfFormat(format)
    const base = item.name.replace(/\.[^.]+$/, '')
    try {
      const path = await saveDialog({
        defaultPath: `compressed_${base}.${extension}`,
        filters: [{ name: '图片', extensions: [extension] }],
      })
      if (!path) return
      await writeFileBytes(path, dataUrlToBytes(item.result.dataUrl))
      toast('图片已保存')
    } catch (error) {
      toast(error instanceof Error ? `保存失败：${error.message}` : '保存失败', 'error')
    }
  }

  const saveAll = async () => {
    const ready = items.filter((item) => item.status === 'done' && item.result)
    if (!ready.length) {
      toast('还没有可保存的结果', 'error')
      return
    }
    const directory = await openDialog({ title: '选择保存目录', directory: true })
    if (!directory || typeof directory !== 'string') {
      toast('未选择保存目录', 'error')
      return
    }
    const used = new Set<string>()
    let saved = 0
    for (const item of ready) {
      const format = item.format ?? settings.format
      const extension = extensionOfFormat(format)
      const base = item.name.replace(/\.[^.]+$/, '')
      let name = `compressed_${base}.${extension}`
      let suffix = 2
      while (used.has(name)) {
        name = `compressed_${base}_${suffix}.${extension}`
        suffix += 1
      }
      used.add(name)
      try {
        await writeFileBytes(joinPath(directory, name), dataUrlToBytes(item.result!.dataUrl))
        saved += 1
      } catch {
        toast(`保存 ${name} 失败`, 'error')
      }
    }
    if (saved) toast(`已保存 ${saved} 张图片`)
  }

  const doneCount = items.filter((item) => item.status === 'done').length

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        支持多选/拖入多张图片；按画质与最大边长压缩，逐张或一键全部保存。
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Images className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">待压缩图片</h2>
            <span className="ml-auto flex items-center gap-1">
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">{items.length}</span>
              <Tip label="添加图片（可多选）">
                <Button variant="ghost" size="icon-xs" aria-label="添加图片" onClick={() => fileRef.current?.click()}>
                  <Plus />
                </Button>
              </Tip>
            </span>
          </header>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files)
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'mt-2 flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 bg-foreground/[0.015] px-2 py-3 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground',
              dragging && 'border-primary/60 bg-primary/5',
            )}
          >
            <ImagePlus className="size-5" />
            <p className="text-[11px]">拖入多张图片或点击添加</p>
            <p className="text-[10px] text-muted-foreground/70">PNG / JPG / WEBP</p>
          </div>

          <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 scroll-thin">
            {items.length ? (
              items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 p-1.5">
                  <img src={item.dataUrl} alt="" className="size-9 shrink-0 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-foreground" title={item.name}>
                      {item.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted-foreground">
                      <span className="font-mono tabular-nums">{formatBytes(item.size)}</span>
                      {item.status === 'running' ? <Loader2 className="size-2.5 animate-spin" /> : null}
                      {item.status === 'done' && item.result ? (
                        <span className="text-success">
                          → {formatBytes(item.result.bytes)}（-{Math.max(0, item.result.savedPercent)}%）
                        </span>
                      ) : null}
                      {item.status === 'error' ? <span className="text-destructive">失败</span> : null}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-xs" aria-label={`移除 ${item.name}`} onClick={() => removeItem(item.id)}>
                    <Trash2 />
                  </Button>
                </li>
              ))
            ) : (
              <li className="grid flex-1 place-items-center rounded-md border border-dashed border-border/50 text-[11px] text-muted-foreground">
                还没有添加图片
              </li>
            )}
          </ul>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <FileImage className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">压缩设置与结果</h2>
            <span className="ml-auto text-[10.5px] text-muted-foreground">已完成 {doneCount} / {items.length}</span>
          </header>

          <div className="mt-2 grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,150px)_minmax(0,110px)_auto] items-end gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10.5px] text-muted-foreground">压缩质量（%）</span>
              <div className="flex flex-wrap gap-1">
                {QUALITY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, quality: String(preset) }))}
                    className={cn(
                      'h-6 rounded-full border px-2 text-[10.5px] transition-colors',
                      Number(settings.quality) === preset
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    )}
                  >
                    {preset}
                  </button>
                ))}
                <NumberField
                  min={5}
                  max={100}
                  value={Number(settings.quality)}
                  onChange={(next) =>
                    setSettings((current) => ({
                      ...current,
                      quality: String(next),
                    }))
                  }
                  className="h-6 w-14 px-1.5 text-[10.5px]"
                  ariaLabel="自定义压缩质量"
                />
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-muted-foreground">最大边长（px）</span>
              {/* 空 = 不限制：用 NaN 让控件显示占位符，清空时回写空串 */}
              <NumberField
                min={16}
                max={20_000}
                placeholder="不限制"
                allowEmpty
                emptyValue={Number.NaN}
                value={settings.maxEdge.trim() === '' ? Number.NaN : Number(settings.maxEdge)}
                onChange={(next) =>
                  setSettings((current) => ({
                    ...current,
                    maxEdge: Number.isFinite(next) ? String(next) : '',
                  }))
                }
                className="h-7 text-[11px]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-muted-foreground">格式</span>
              <SelectField
                value={settings.format}
                onValueChange={(value) =>
                  setSettings((current) => ({ ...current, format: value as CompressFormat }))
                }
                options={[
                  { value: 'jpeg', label: 'JPEG' },
                  { value: 'webp', label: 'WebP' },
                  { value: 'png', label: 'PNG' },
                ]}
                ariaLabel="格式"
                size="sm"
                className="h-7 w-full px-2 text-[11px]"
              />
            </label>
            <Button size="sm" className="gap-1.5" disabled={busy || !items.length} onClick={() => void compressAll()}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />}
              开始压缩
            </Button>
          </div>

          <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/60">
            <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-foreground/[0.02] px-2 py-1.5">
              <span className="text-[10.5px] text-muted-foreground">
                {settings.maxEdge ? `长边不超过 ${clampInt(settings.maxEdge, 16, 20_000)}px` : '保持原始边长'}
              </span>
              <Button
                size="xs"
                variant="outline"
                className="ml-auto gap-1"
                disabled={busy || !doneCount}
                onClick={() => void saveAll()}
              >
                <Download className="size-3" aria-hidden />
                全部保存
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto scroll-thin">
              <table className="w-full table-fixed border-collapse text-left text-[11px]">
                <thead className="sticky top-0 bg-card/95 text-[10px] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">名称</th>
                    <th className="w-20 px-2 py-1.5 font-medium">原始大小</th>
                    <th className="w-20 px-2 py-1.5 font-medium">压缩后</th>
                    <th className="w-16 px-2 py-1.5 font-medium">压缩率</th>
                    <th className="w-11 px-2 py-1.5 font-medium">保存</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? (
                    items.map((item) => (
                      <tr key={item.id} className="border-t border-border/40 align-middle">
                        <td className="max-w-0 px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <img
                              src={item.result?.dataUrl ?? item.dataUrl}
                              alt=""
                              className="size-7 shrink-0 rounded object-cover"
                            />
                            <span className="min-w-0 flex-1 truncate" title={item.name}>{item.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 font-mono tabular-nums text-muted-foreground">
                          {formatBytes(item.size)}
                        </td>
                        <td className="px-2 py-1.5 font-mono tabular-nums">
                          {item.result ? formatBytes(item.result.bytes) : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          {item.result ? (
                            <span
                              className={cn(
                                'font-mono tabular-nums',
                                item.result.savedPercent > 0 ? 'text-success' : 'text-muted-foreground',
                              )}
                            >
                              {item.result.savedPercent > 0
                                ? `-${item.result.savedPercent}%`
                                : `+${Math.abs(item.result.savedPercent)}%`}
                            </span>
                          ) : item.status === 'error' ? (
                            <span className="text-[10px] text-destructive" title={item.error}>失败</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`保存 ${item.name}`}
                            disabled={!item.result}
                            onClick={() => void saveItem(item)}
                          >
                            <Download />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="h-28 text-center text-[11px] text-muted-foreground">
                        添加图片并开始压缩后，结果会显示在这里
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// 圆角图片（滑块实时预览）
// ---------------------------------------------------------------------------

interface RoundResult extends ImageResult {
  radius: number
}

export function ImageRoundTool() {
  const { source, loadFile, loadClipboard } = useImageSource()
  const [radius, setRadius] = useState(24)
  const [byPercent, setByPercent] = useState(false)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setResult(null)
    setError('')
  }, [source])

  useEffect(() => {
    if (!source) {
      setResult(null)
      setBusy(false)
      return
    }
    let cancelled = false
    setBusy(true)
    const timer = window.setTimeout(() => {
      void runTool<RoundResult>('image-round', {
        dataUrl: source.dataUrl,
        radius: byPercent ? Math.min(50, radius) : radius,
        byPercent,
      })
        .then((response) => {
          if (cancelled) return
          if (response.ok) {
            setResult(response.data)
            setError('')
          } else {
            setResult(null)
            setError(response.error.message)
          }
        })
        .catch((runError) => {
          if (cancelled) return
          setResult(null)
          setError(runError instanceof Error ? runError.message : '圆角处理失败')
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 140)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [source, radius, byPercent])

  const copy = async () => {
    if (!result) return
    try {
      await copyImageDataUrl(result.dataUrl)
      toast('图片已复制')
    } catch (copyError) {
      toast(copyError instanceof Error ? `复制失败：${copyError.message}` : '复制失败', 'error')
    }
  }

  const download = async () => {
    if (!result) return
    try {
      if (await saveImageDataUrl(result.dataUrl, 'rounded.png')) toast('图片已保存')
    } catch (saveError) {
      toast(saveError instanceof Error ? `保存失败：${saveError.message}` : '保存失败', 'error')
    }
  }

  const maxRadius = byPercent ? 50 : 2000

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        拖动滑块即可实时重绘；「按短边百分比」拉到 50 就是圆形裁切，输出 PNG 保留透明。
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-3">
        <SourceStage source={source} onFile={loadFile} onClipboard={loadClipboard} hint="预览会随着右侧圆角参数实时更新。">
          <div className="grid h-full w-full place-items-center overflow-hidden bg-[repeating-conic-gradient(#00000008_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-3">
            <img
              src={result?.dataUrl ?? source?.dataUrl ?? ''}
              alt="圆角预览"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </SourceStage>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">圆角设置</h2>
            {busy ? <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" /> : null}
          </header>

          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={maxRadius}
                step={1}
                value={Math.min(radius, maxRadius)}
                onChange={(event) => setRadius(Number(event.target.value))}
                className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-foreground/15 accent-primary"
                aria-label="圆角大小"
              />
              <span className="w-14 shrink-0 text-right font-mono text-[12px] tabular-nums text-foreground">
                {Math.min(radius, maxRadius)}
                {byPercent ? '%' : 'px'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NumberField
                min={0}
                max={maxRadius}
                value={radius}
                onChange={setRadius}
                className="h-8 w-24 text-[11.5px]"
                ariaLabel="圆角数值"
              />
              <button
                type="button"
                aria-pressed={byPercent}
                onClick={() => {
                  if (!byPercent) setRadius((value) => Math.min(50, value))
                  setByPercent((value) => !value)
                }}
                className={cn(
                  'h-8 flex-1 rounded-md border px-2 text-[11.5px] transition-colors',
                  byPercent
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground',
                )}
              >
                按短边百分比
              </button>
            </div>

            {error ? (
              <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] leading-5 text-destructive">{error}</p>
            ) : null}

            <div className="flex items-center justify-between rounded-md border border-border/60 bg-foreground/[0.02] px-2.5 py-1.5">
              <span className="text-[10.5px] text-muted-foreground">实际圆角</span>
              <span className="font-mono text-[11.5px] tabular-nums text-foreground">
                {result ? `${result.radius}px` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
              <span>输出尺寸</span>
              <span className="font-mono tabular-nums">
                {result ? `${result.width} × ${result.height} · ${formatBytes(result.bytes)}` : '—'}
              </span>
            </div>

            <div className="mt-auto flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5" disabled={!result || busy} onClick={() => void copy()}>
                <Copy className="size-3.5" aria-hidden />
                复制图片
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                disabled={!result || busy}
                onClick={() => void download()}
              >
                <Download className="size-3.5" aria-hidden />
                下载
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// 全屏水印
// ---------------------------------------------------------------------------

export function ImageWatermarkTool() {
  return (
    <ImageWorkbench<ImageResult>
      toolId="image-watermark"
      hint="X/Y 间距控制疏密，偏移量微调平铺起点；可关闭重复平铺或错开排列。"
      fileName="watermarked.png"
      storageKey="matcha-puff/image-watermark"
      autoRun
      showCopy
      controls={[
        { key: 'text', label: '水印文字', type: 'text', defaultValue: '抹茶泡芙', placeholder: '例如 仅内部使用', span: 2 },
        { key: 'fontSize', label: '字号', type: 'number', defaultValue: '24', min: '8', max: '200', step: '1' },
        { key: 'color', label: '颜色', type: 'text', defaultValue: '#333333' },
        {
          key: 'opacity',
          label: '透明度 0.02–1',
          type: 'range',
          defaultValue: '0.2',
          min: '0.02',
          max: '1',
          step: '0.02',
          span: 2,
        },
        { key: 'angle', label: '旋转角度 ±180', type: 'range', defaultValue: '-30', min: '-180', max: '180', step: '1', span: 2 },
        { key: 'gapX', label: 'X 间距', type: 'number', defaultValue: '220', min: '0', max: '2000', step: '10' },
        { key: 'gapY', label: 'Y 间距', type: 'number', defaultValue: '220', min: '0', max: '2000', step: '10' },
        { key: 'offsetX', label: 'X 偏移', type: 'number', defaultValue: '0', min: '-4000', max: '4000', step: '1' },
        { key: 'offsetY', label: 'Y 偏移', type: 'number', defaultValue: '0', min: '-4000', max: '4000', step: '1' },
        { key: 'repeat', label: '重复平铺', type: 'switch', defaultValue: 'true' },
        { key: 'staggered', label: '错开排列', type: 'switch', defaultValue: 'true' },
      ]}
      buildInput={({ dataUrl, values }) => ({
        dataUrl,
        text: String(values.text ?? ''),
        fontSize: Number(values.fontSize ?? 24),
        color: String(values.color ?? '#333333'),
        opacity: Number(values.opacity ?? 0.2),
        angle: Number(values.angle ?? -30),
        gap: Math.max(Number(values.gapX ?? 220), Number(values.gapY ?? 220)),
        gapX: Number(values.gapX ?? 220),
        gapY: Number(values.gapY ?? 220),
        offsetX: Number(values.offsetX ?? 0),
        offsetY: Number(values.offsetY ?? 0),
        repeat: values.repeat === true,
        staggered: values.staggered === true,
      })}
    />
  )
}


const base64Bytes = (base64: string): number[] => {
  const binary = atob(base64)
  return Array.from(binary, (char) => char.charCodeAt(0))
}

export function Base64ImageTool() {
  const [mode, setMode] = useState<'decode' | 'encode'>('decode')
  const [input, setInput] = useState('')
  const [dataUrl, setDataUrl] = useState('')
  const [base64, setBase64] = useState('')
  const [mime, setMime] = useState('image/png')
  const [bytes, setBytes] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const reset = () => {
    setInput('')
    setDataUrl('')
    setBase64('')
    setBytes(0)
    setError('')
  }

  const switchMode = (next: string) => {
    setMode(next as 'decode' | 'encode')
    reset()
  }

  const convert = async (text: string, operation: 'decode' | 'encode') => {
    if (!text.trim()) return
    setBusy(true)
    setError('')
    const result = await runTool<{
      dataUrl: string
      base64: string
      mime: string
      bytes: number
    }>('base64-image', { operation, text })
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      setDataUrl('')
      setBase64('')
      setBytes(0)
      return
    }
    setDataUrl(result.data.dataUrl)
    setBase64(result.data.base64)
    setMime(result.data.mime)
    setBytes(result.data.bytes)
  }

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const next = String(reader.result ?? '')
      setInput(next)
      setDataUrl(next)
      setError('')
      void convert(next, 'encode')
    }
    reader.onerror = () => setError('读取图片失败')
    reader.readAsDataURL(file)
  }

  const copyBase64 = () => {
    void copyText(base64).then(
      () => toast(`已复制 ${base64.length.toLocaleString()} 个字符`),
      () => toast('复制失败', 'error'),
    )
  }

  const saveImage = async () => {
    if (!dataUrl) return
    const extension = mime.includes('jpeg') ? 'jpg' : mime.includes('gif') ? 'gif' : mime.includes('webp') ? 'webp' : mime.includes('svg') ? 'svg' : 'png'
    const path = await saveDialog({
      title: '保存图片',
      defaultPath: `image.${extension}`,
      filters: [{ name: '图片', extensions: [extension] }],
    })
    if (!path) return
    await writeFileBytes(path, base64Bytes(base64))
    toast('图片已保存')
  }

  const saveBase64Text = async () => {
    if (!base64) return
    const path = await saveDialog({
      title: '保存 Base64 文本',
      defaultPath: 'image.base64.txt',
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    })
    if (!path) return
    await writeFileBytes(path, Array.from(new TextEncoder().encode(base64)))
    toast('Base64 文本已保存')
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <SlidingSegmented
          options={[
            { value: 'decode', label: 'Base64 转图片' },
            { value: 'encode', label: '图片转 Base64' },
          ]}
          value={mode}
          onValueChange={switchMode}
          ariaLabel="转换方向"
        />
        <p className="text-[11px] text-muted-foreground">
          {mode === 'decode' ? '可粘贴 Base64 或 data URL，转换后可直接保存图片' : '选择图片后自动转成 Base64，可复制或保存文本'}
        </p>
      </div>

      <section className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="flex min-h-0 flex-col rounded-lg border border-border/60 bg-card/40 p-3">
          <p className="mb-2 shrink-0 text-[11px] font-medium text-foreground">
            {mode === 'decode' ? 'Base64 / data URL' : '选择图片'}
          </p>
          {mode === 'decode' ? (
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="粘贴 data:image/png;base64,... 或纯 Base64 串"
              spellCheck={false}
              className="min-h-0 flex-1 resize-none rounded-md bg-foreground/[0.025] p-2 font-mono text-[11.5px] leading-relaxed outline-none scroll-thin focus-visible:ring-1 focus-visible:ring-primary/40"
            />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-foreground/[0.015] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ImagePlus className="size-7" aria-hidden />
              <span className="text-[11.5px]">点击选择图片文件</span>
              <span className="text-[10.5px] text-muted-foreground/70">支持 PNG / JPG / GIF / WEBP / SVG</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) readFile(file)
              event.target.value = ''
            }}
          />
          {mode === 'decode' ? (
            <Button className="mt-2 shrink-0" disabled={!input.trim() || busy} onClick={() => void convert(input, 'decode')}>
              {busy ? '转换中…' : '转换为图片'}
            </Button>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-border/60 bg-card/40 p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <p className="text-[11px] font-medium text-foreground">{mode === 'decode' ? '图片预览' : 'Base64 结果'}</p>
            <span className="text-[10.5px] text-muted-foreground">{bytes ? `${bytes.toLocaleString()} 字节` : ''}</span>
          </div>
          {error ? (
            <p className="rounded-md bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">{error}</p>
          ) : mode === 'decode' ? (
            dataUrl ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="grid min-h-0 flex-1 place-items-center overflow-hidden rounded-md border border-border/50 bg-[repeating-conic-gradient(#00000008_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-3">
                  <img src={dataUrl} alt="Base64 图片预览" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="mt-2 flex shrink-0 gap-2">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={() => void saveImage()}>
                    <Download className="size-3.5" aria-hidden />
                    保存图片
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={copyBase64}>
                    复制 Base64
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 place-items-center rounded-md border border-dashed border-border/60 text-[11px] text-muted-foreground">
                转换后在这里预览
              </div>
            )
          ) : base64 ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <textarea
                readOnly
                value={base64}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none rounded-md bg-foreground/[0.025] p-2 font-mono text-[11px] leading-relaxed outline-none scroll-thin"
              />
              <div className="mt-2 flex shrink-0 gap-2">
                <Button size="sm" className="flex-1" onClick={copyBase64}>
                  复制 Base64
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => void saveBase64Text()}>
                  保存文本
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center rounded-md border border-dashed border-border/60 text-[11px] text-muted-foreground">
              选择图片后自动转换
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

interface PlaceholderData {
  width: number
  height: number
  format: 'svg' | 'png'
  svg: string
  dataUrl: string
  text: string
}

interface PlaceholderParams {
  width: string
  height: string
  background: string
  foreground: string
  text: string
  format: 'svg' | 'png'
}

const PLACEHOLDER_STORAGE_KEY = 'matcha-puff/placeholder-image'

const defaultPlaceholderParams: PlaceholderParams = {
  width: '360',
  height: '200',
  background: '#a7a7a7',
  foreground: '#ffffff',
  text: '',
  format: 'png',
}

const readPlaceholderParams = (): PlaceholderParams => {
  try {
    const raw = window.localStorage.getItem(PLACEHOLDER_STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as Partial<PlaceholderParams>) : null
    if (!saved || typeof saved !== 'object') return defaultPlaceholderParams
    return {
      width: typeof saved.width === 'string' ? saved.width : defaultPlaceholderParams.width,
      height: typeof saved.height === 'string' ? saved.height : defaultPlaceholderParams.height,
      background: typeof saved.background === 'string' ? saved.background : defaultPlaceholderParams.background,
      foreground: typeof saved.foreground === 'string' ? saved.foreground : defaultPlaceholderParams.foreground,
      text: typeof saved.text === 'string' ? saved.text : defaultPlaceholderParams.text,
      format: saved.format === 'svg' || saved.format === 'png' ? saved.format : defaultPlaceholderParams.format,
    }
  } catch {
    return defaultPlaceholderParams
  }
}

const svgToBase64DataUrl = (svg: string): string => {
  const bytes = new TextEncoder().encode(svg)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`
}

const placeholderServices = (width: number, height: number) => [
  { name: 'placeholder.com', url: `https://via.placeholder.com/${width}x${height}` },
  { name: 'temp.im', url: `https://temp.im/${width}x${height}` },
  { name: 'picsum.photos', url: `https://picsum.photos/${width}/${height}/` },
  { name: 'fpoimg.com', url: `https://fpoimg.com/${width}x${height}` },
  { name: 'fakeimg.pl', url: `https://fakeimg.pl/${width}x${height}` },
]

export function PlaceholderImageTool() {
  const [tab, setTab] = useState<'local' | 'online'>('local')
  const [params, setParams] = useState<PlaceholderParams>(readPlaceholderParams)
  const [backgroundImage, setBackgroundImage] = useState('')
  const [result, setResult] = useState<PlaceholderData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bgFileRef = useRef<HTMLInputElement | null>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    try {
      window.localStorage.setItem(PLACEHOLDER_STORAGE_KEY, JSON.stringify(params))
    } catch {
      // 忽略存储异常
    }
  }, [params])

  function update<K extends keyof PlaceholderParams>(key: K, value: PlaceholderParams[K]) {
    setParams((current) => ({ ...current, [key]: value }))
  }

  const generate = useCallback(async () => {
    const request = ++requestRef.current
    setBusy(true)
    try {
      const response = await runTool<PlaceholderData>('placeholder-image', {
        width: clampInt(params.width, 10, 4000),
        height: clampInt(params.height, 10, 4000),
        background: params.background,
        foreground: params.foreground,
        text: params.text,
        format: params.format,
        ...(backgroundImage ? { backgroundImage } : {}),
      })
      if (request !== requestRef.current) return
      if (response.ok) {
        setResult(response.data)
        setError('')
      } else {
        setResult(null)
        setError(response.error.message)
      }
    } catch (runError) {
      if (request !== requestRef.current) return
      setResult(null)
      setError(runError instanceof Error ? runError.message : '生成失败')
    } finally {
      if (request === requestRef.current) setBusy(false)
    }
  }, [params, backgroundImage])

  useEffect(() => {
    if (tab !== 'local') return
    const timer = window.setTimeout(() => {
      void generate()
    }, 180)
    return () => window.clearTimeout(timer)
  }, [tab, generate])

  const loadBackground = async (file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件', 'error')
      return
    }
    try {
      setBackgroundImage(await readFileDataUrl(file))
    } catch {
      toast('背景图片读取失败', 'error')
    }
  }

  const copyBase64 = async () => {
    if (!result) return
    const text = result.format === 'svg' ? svgToBase64DataUrl(result.svg) : result.dataUrl
    try {
      await copyText(text)
      toast('已复制 base64 data URL')
    } catch {
      toast('复制失败', 'error')
    }
  }

  const save = async () => {
    if (!result) return
    try {
      if (await saveImageDataUrl(result.dataUrl, `placeholder.${result.format}`)) toast('图片已保存')
    } catch (saveError) {
      toast(saveError instanceof Error ? `保存失败：${saveError.message}` : '保存失败', 'error')
    }
  }

  const width = clampInt(params.width, 10, 4000)
  const height = clampInt(params.height, 10, 4000)
  const services = placeholderServices(width, height)

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <SlidingSegmented
          options={[
            { value: 'local', label: '本地占位图生成' },
            { value: 'online', label: '在线占位图' },
          ]}
          value={tab}
          onValueChange={setTab}
          ariaLabel="占位图模式"
        />
        <p className="text-[11px] text-muted-foreground">
          {tab === 'local'
            ? '可上传背景图；水印固定为「当前图片由 抹茶泡芙 生成」，参数会自动记住'
            : '只拼接各家服务的 URL，方便复制引用，不会发起网络请求'}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            {tab === 'local' ? <ImagePlus className="size-4 text-primary" /> : <Link2 className="size-4 text-primary" />}
            <h2 className="text-[13px] font-medium text-foreground">
              {tab === 'local' ? '本地预览' : '在线占位图 URL'}
            </h2>
            {tab === 'local' && result ? (
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {result.width} × {result.height} · {result.format.toUpperCase()}
              </span>
            ) : null}
            {busy ? <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" /> : null}
          </header>

          {tab === 'local' ? (
            <>
              <div className="mt-2 grid min-h-0 flex-1 place-items-center overflow-hidden rounded-md border border-border/50 bg-[repeating-conic-gradient(#00000008_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-3">
                {result ? (
                  <img src={result.dataUrl} alt={result.text} className="max-h-full max-w-full object-contain" />
                ) : (
                  <p className="text-[11.5px] text-muted-foreground">设置参数后自动生成预览</p>
                )}
              </div>
              {error ? (
                <p className="mt-2 shrink-0 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] leading-5 text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="mt-2 flex shrink-0 gap-2">
                <Button size="sm" className="flex-1 gap-1.5" disabled={!result} onClick={() => void copyBase64()}>
                  <Copy className="size-3.5" aria-hidden />
                  复制 base64
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" disabled={!result} onClick={() => void save()}>
                  <Download className="size-3.5" aria-hidden />
                  保存图片
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 scroll-thin">
              <p className="shrink-0 rounded-md border border-border/50 bg-foreground/[0.02] px-2.5 py-1.5 text-[10.5px] text-muted-foreground">
                当前尺寸 {width} × {height}；以下均为纯文本 URL，预览不会联网加载。
              </p>
              {services.map((service) => (
                <div key={service.name} className="shrink-0 rounded-md border border-border/60 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-medium text-foreground">{service.name}</span>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="ml-auto gap-1"
                      onClick={() => {
                        void copyText(service.url).then(
                          () => toast(`已复制 ${service.name} URL`),
                          () => toast('复制失败', 'error'),
                        )
                      }}
                    >
                      <Copy className="size-3" aria-hidden />
                      复制
                    </Button>
                  </div>
                  <code className="mt-1 block break-all font-mono text-[10px] leading-4 text-muted-foreground">
                    {service.url}
                  </code>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">占位图参数</h2>
          </header>

          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 scroll-thin">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted-foreground">宽度（px）</span>
                <NumberField
                  min={10}
                  max={4000}
                  value={Number(params.width)}
                  onChange={(next) => update('width', String(next))}
                  className="h-8 text-[11.5px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted-foreground">高度（px）</span>
                <NumberField
                  min={10}
                  max={4000}
                  value={Number(params.height)}
                  onChange={(next) => update('height', String(next))}
                  className="h-8 text-[11.5px]"
                />
              </label>
            </div>

            {tab === 'local' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] text-muted-foreground">底色</span>
                    <Input
                      value={params.background}
                      onChange={(event) => update('background', event.target.value)}
                      className="h-8 font-mono text-[11.5px]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] text-muted-foreground">文字色</span>
                    <Input
                      value={params.foreground}
                      onChange={(event) => update('foreground', event.target.value)}
                      className="h-8 font-mono text-[11.5px]"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-muted-foreground">文字（留空显示尺寸）</span>
                  <Input
                    value={params.text}
                    onChange={(event) => update('text', event.target.value)}
                    placeholder={`${width} × ${height}`}
                    className="h-8 text-[11.5px]"
                  />
                </label>
                <div className="rounded-md border border-border/60 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] text-muted-foreground">背景图片</span>
                    <span className="ml-auto flex items-center gap-1">
                      <Button size="xs" variant="outline" onClick={() => bgFileRef.current?.click()}>
                        选择
                      </Button>
                      {backgroundImage ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label="移除背景图片"
                          onClick={() => setBackgroundImage('')}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </span>
                  </div>
                  <input
                    ref={bgFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void loadBackground(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                  {backgroundImage ? (
                    <img src={backgroundImage} alt="背景图" className="mt-2 h-16 w-full rounded object-cover" />
                  ) : (
                    <p className="mt-1 text-[10px] text-muted-foreground/80">不上传时使用底色填充。</p>
                  )}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-muted-foreground">输出格式</span>
                  <SelectField
                    value={params.format}
                    onValueChange={(value) => update('format', value as 'svg' | 'png')}
                    options={[
                      { value: 'png', label: 'PNG' },
                      { value: 'svg', label: 'SVG' },
                    ]}
                    ariaLabel="输出格式"
                    size="sm"
                    className="h-8 w-full px-2 text-[11.5px]"
                  />
                </label>
                <p className="rounded-md border border-border/50 bg-foreground/[0.02] px-2.5 py-1.5 text-[10px] leading-4 text-muted-foreground">
                  水印文案固定为「当前图片由 抹茶泡芙 生成」，显示在右下角。
                </p>
                <Button size="sm" className="mt-auto gap-1.5" disabled={busy} onClick={() => void generate()}>
                  {busy ? <Loader2 className="animate-spin" /> : <Play />}
                  生成预览
                </Button>
              </>
            ) : (
              <p className="rounded-md border border-border/50 bg-foreground/[0.02] px-2.5 py-2 text-[10.5px] leading-5 text-muted-foreground">
                在线模式只使用宽高拼接 URL；修改尺寸后，左侧五种服务的地址会同步更新。
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

interface ColorSample {
  hex: string
  rgb: string
  r: number
  g: number
  b: number
}

interface ColorThiefOutput {
  dominant: ColorSample
  palette: ColorSample[]
}

interface RoundedRectArgs {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

const fillRoundedRect = (ctx: CanvasRenderingContext2D, { x, y, width, height, radius }: RoundedRectArgs) => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.arcTo(x + width, y, x + width, y + r, r)
  ctx.lineTo(x + width, y + height - r)
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r)
  ctx.lineTo(x + r, y + height)
  ctx.arcTo(x, y + height, x, y + height - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** 图片主色提取 */
export function ColorThiefTool() {
  const [source, setSource] = useState<string>('')
  const [colorCount, setColorCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ColorThiefOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const requestRef = useRef(0)

  const extract = useCallback(async (src: string, count: number) => {
    const request = ++requestRef.current
    setLoading(true)
    try {
      const response = await runTool<ColorThiefOutput>('getcolorthief', { dataUrl: src, colorCount: count })
      if (request !== requestRef.current) return
      if (response.ok) {
        setResult(response.data)
        setError(null)
      } else {
        setResult(null)
        setError(response.error.message)
      }
    } catch (runError) {
      if (request !== requestRef.current) return
      setResult(null)
      setError(runError instanceof Error ? runError.message : '取色失败')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [])

  const loadFile = useCallback((file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setSource(String(reader.result ?? ''))
      setResult(null)
      setError(null)
    }
    reader.onerror = () => toast('图片读取失败', 'error')
    reader.readAsDataURL(file)
  }, [])

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

  // 选图后自动按当前颜色数量提取，改数量也会自动重跑
  useEffect(() => {
    if (!source) return
    const timer = window.setTimeout(() => {
      void extract(source, colorCount)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [source, colorCount, extract])

  const copy = (sample: ColorSample) => {
    void copyText(sample.hex).then(
      () => toast(`已复制 ${sample.hex}`),
      () => toast('复制失败', 'error'),
    )
  }

  /** 截图式色卡：原图 + 右侧主色/配色板 */
  const exportCard = async () => {
    if (!result || !source) return
    try {
      const image = await loadImageElement(source)
      const W = 1000
      const H = 760
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const font = '"Microsoft YaHei", system-ui, sans-serif'

      ctx.fillStyle = '#f4f4f5'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#18181b'
      ctx.font = `bold 24px ${font}`
      ctx.fillText('图片色卡', 28, 44)

      // 原图区域（完整等比显示）
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(28, 64, 600, 660)
      const scale = Math.min(576 / image.naturalWidth, 636 / image.naturalHeight)
      const drawWidth = Math.max(1, image.naturalWidth * scale)
      const drawHeight = Math.max(1, image.naturalHeight * scale)
      ctx.drawImage(
        image,
        28 + (600 - drawWidth) / 2,
        64 + (660 - drawHeight) / 2,
        drawWidth,
        drawHeight,
      )

      // 色板卡片
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'
      ctx.shadowBlur = 18
      ctx.shadowOffsetY = 6
      fillRoundedRect(ctx, { x: 650, y: 64, width: 322, height: 660, radius: 16 })
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.restore()

      ctx.fillStyle = '#71717a'
      ctx.font = `12px ${font}`
      ctx.fillText('主要颜色', 674, 96)

      const dominant = result.dominant
      fillRoundedRect(ctx, { x: 674, y: 108, width: 274, height: 120, radius: 10 })
      ctx.fillStyle = dominant.hex
      ctx.fill()
      const light = dominant.r * 0.299 + dominant.g * 0.587 + dominant.b * 0.114 > 160
      ctx.fillStyle = light ? '#18181b' : '#ffffff'
      ctx.font = `bold 26px ${font}`
      ctx.fillText(dominant.hex.toUpperCase(), 692, 162)
      ctx.font = `13px ${font}`
      ctx.fillText(dominant.rgb, 692, 188)

      ctx.fillStyle = '#71717a'
      ctx.font = `12px ${font}`
      ctx.fillText(`配色板（${result.palette.length} 色）`, 674, 254)

      result.palette.forEach((sample, index) => {
        const column = index % 4
        const row = Math.floor(index / 4)
        const x = 674 + column * 68
        const y = 268 + row * 64
        fillRoundedRect(ctx, { x, y, width: 60, height: 44, radius: 6 })
        ctx.fillStyle = sample.hex
        ctx.fill()
        ctx.fillStyle = '#52525b'
        ctx.font = `9px ${font}`
        ctx.fillText(sample.hex.toUpperCase(), x, y + 55)
      })

      ctx.fillStyle = '#a1a1aa'
      ctx.font = `11px ${font}`
      ctx.fillText('色卡由 抹茶泡芙 生成', 674, 700)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      const binary = atob(base64)
      const bytes = Array.from({ length: binary.length }, (_, i) => binary.charCodeAt(i))
      const path = await saveDialog({
        defaultPath: '色卡.jpg',
        filters: [{ name: '图片', extensions: ['jpg'] }],
      })
      if (!path) return
      await writeFileBytes(path, bytes)
      toast('色卡已保存')
    } catch (saveError) {
      toast(saveError instanceof Error ? `导出失败：${saveError.message}` : '导出失败', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        选图后自动提取 10 色（可调 2–20）；点色块复制十六进制值，导出的 JPG 同时包含原图与色板。
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Pipette className="size-4 text-primary" />
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
            onChange={(event) => {
              loadFile(event.target.files?.[0])
              event.target.value = ''
            }}
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
              <img src={source} alt="原图预览" className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                <ImagePlus className="size-6" />
                <p className="text-[12px]">把图片拖进来，或点右上角选文件</p>
                <p className="text-[10.5px] text-muted-foreground/70">也支持直接 Ctrl+V 粘贴剪贴板里的图</p>
              </div>
            )}
          </div>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">配色</h2>
            {result ? (
              <Tip label="导出色卡 JPG（含原图）">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="导出色卡"
                  onClick={() => void exportCard()}
                >
                  <Download />
                </Button>
              </Tip>
            ) : null}
            <label className="ml-auto flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              数量
              <NumberField
                min={2}
                max={20}
                value={colorCount}
                onChange={setColorCount}
                className="h-7 w-14 text-[11.5px]"
              />
            </label>
          </header>

          <Button size="sm" className="mt-2" disabled={!source || loading} onClick={() => void extract(source, colorCount)}>
            {loading ? <Loader2 className="animate-spin" /> : <Pipette />}
            {loading ? '提取中…' : result ? '重新提取' : '提取主色'}
          </Button>

          {error ? (
            <p className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] leading-5 text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-1 scroll-thin">
            {result ? (
              <>
                <div className="shrink-0">
                  <p className="mb-1.5 text-[10.5px] text-muted-foreground">主要颜色</p>
                  <button
                    type="button"
                    onClick={() => copy(result.dominant)}
                    className="flex w-full items-center gap-3 rounded-md border border-border/60 p-2.5 text-left transition-colors hover:border-primary/40"
                  >
                    <span
                      className="size-12 shrink-0 rounded-md border border-black/10"
                      style={{ backgroundColor: result.dominant.hex }}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-[14px] text-foreground">{result.dominant.hex}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                        {result.dominant.rgb}
                      </span>
                    </span>
                  </button>
                </div>
                <div className="shrink-0">
                  <p className="mb-1.5 text-[10.5px] text-muted-foreground">
                    其他颜色（{Math.max(0, result.palette.length - 1)}）
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {result.palette.slice(1).map((sample, index) => (
                      <button
                        key={`${sample.hex}-${index}`}
                        type="button"
                        onClick={() => copy(sample)}
                        title={sample.hex + '，点击复制'}
                        className="group flex aspect-square flex-col justify-end rounded-md border border-black/10 p-1 transition-transform hover:scale-[1.04]"
                        style={{ backgroundColor: sample.hex }}
                      >
                        <span className="rounded bg-black/45 px-1 py-0.5 text-center font-mono text-[9px] leading-3 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {sample.hex}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-md border border-dashed border-border/60 text-[11.5px] text-muted-foreground">
                色板会显示在这里
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
