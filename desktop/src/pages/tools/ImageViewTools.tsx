import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Images,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { saveDialog, writeFileBytes } from '@/ipc/bridge'
import {
  dataUrlToBytes,
  loadImageElement,
  readClipboardImageDataUrl,
  readFileDataUrl,
} from './shared/ImageWorkbench'

interface PreviewImage {
  name: string
  dataUrl: string
  width: number
  height: number
}

async function fileToPreview(file: File): Promise<PreviewImage> {
  const dataUrl = await readFileDataUrl(file)
  const image = await loadImageElement(dataUrl)
  return { name: file.name, dataUrl, width: image.naturalWidth, height: image.naturalHeight }
}

function PreviewOverlay({
  images,
  index,
  onIndex,
  onClose,
  action,
}: {
  images: PreviewImage[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
  action?: ReactNode
}) {
  const current = images[index]
  const step = useCallback(
    (delta: number) => {
      if (images.length < 2) return
      onIndex((index + delta + images.length) % images.length)
    },
    [images.length, index, onIndex],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step])

  if (!current) return null
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-sm"
      onDoubleClick={onClose}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 px-4 text-white/80">
        <span className="truncate text-xs">{current.name}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-white/45">
          {current.width} × {current.height}
        </span>
        {images.length > 1 ? (
          <span className="ml-1 text-[10.5px] tabular-nums text-white/45">
            {index + 1} / {images.length}
          </span>
        ) : null}
        <Tip label="关闭">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="关闭预览"
            className="ml-auto text-white/75 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <X />
          </Button>
        </Tip>
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-14">
        <img
          src={current.dataUrl}
          alt={current.name}
          className="max-h-full max-w-full object-contain"
        />
        {images.length > 1 ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="上一张"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => step(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="下一张"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => step(1)}
            >
              <ChevronRight />
            </Button>
          </>
        ) : null}
        {action ? <div className="absolute bottom-5 right-5">{action}</div> : null}
      </div>
    </div>
  )
}

export function ImageViewerTool() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [images, setImages] = useState<PreviewImage[]>([])
  const [preview, setPreview] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const addFiles = async (files: File[]) => {
    const imagesOnly = files.filter((file) => file.type.startsWith('image/'))
    if (!imagesOnly.length) {
      toast('请选择图片文件', 'error')
      return
    }
    try {
      const next = await Promise.all(imagesOnly.map(fileToPreview))
      setImages((current) => [...current, ...next])
    } catch (error) {
      toast(error instanceof Error ? error.message : '读取图片失败', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/gif,image/png,image/jpeg,image/webp,image/bmp,image/x-icon,image/tiff"
        multiple
        hidden
        onChange={(event) => {
          void addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />

      {images.length === 0 ? (
        <div
          className={
            dragging
              ? 'glass mt-6 flex flex-1 items-center justify-center rounded-panel ring-2 ring-primary/40'
              : 'glass mt-6 flex flex-1 items-center justify-center rounded-panel'
          }
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void addFiles(Array.from(event.dataTransfer.files))
          }}
        >
          <Empty
            icon={Images}
            title="图片预览"
            description="选择图片后在此处进行展示，右下角可关闭已打开的文件"
            action={
              <Button variant="default" onClick={() => inputRef.current?.click()}>
                选择文件进行预览
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-2 py-2.5">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              <ImagePlus />
              继续添加
            </Button>
            <span className="text-[11px] text-muted-foreground">
              共 {images.length} 张，点击图片全屏查看
            </span>
          </div>
          <div className="relative min-h-0 flex-1 overflow-auto">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 pb-2">
              {images.map((image, index) => (
                <button
                  key={`${image.name}-${index}`}
                  type="button"
                  className="group flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-[repeating-conic-gradient(#00000008_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-2 outline-none transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  title={`${image.name} · ${image.width} × ${image.height}`}
                  onClick={() => setPreview(index)}
                >
                  <img
                    src={image.dataUrl}
                    alt={image.name}
                    className="max-h-full max-w-full object-contain transition-transform duration-150 group-hover:scale-[1.02]"
                  />
                </button>
              ))}
            </div>
          </div>
          <Tip label="关闭已打开的文件">
            <Button
              variant="default"
              size="icon-lg"
              aria-label="关闭已打开的文件"
              className="fixed bottom-5 right-5 z-30 rounded-full shadow-lg"
              onClick={() => setImages([])}
            >
              <X />
            </Button>
          </Tip>
        </>
      )}

      {preview !== null && images.length > 0 ? (
        <PreviewOverlay
          images={images}
          index={Math.min(preview, images.length - 1)}
          onIndex={setPreview}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </main>
  )
}

export function PasteImageViewTool() {
  const [image, setImage] = useState<PreviewImage | null>(null)
  const [busy, setBusy] = useState(false)

  const readClipboard = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const dataUrl = await readClipboardImageDataUrl()
      if (!dataUrl) {
        toast('剪贴板里没有图片', 'error')
        return
      }
      const element = await loadImageElement(dataUrl)
      setImage({
        name: '剪切板图片',
        dataUrl,
        width: element.naturalWidth,
        height: element.naturalHeight,
      })
    } catch (error) {
      toast(error instanceof Error ? `读取剪切板失败：${error.message}` : '读取剪切板失败', 'error')
    } finally {
      setBusy(false)
    }
  }, [busy])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((entry) =>
        entry.type.startsWith('image/'),
      )
      const file = item?.getAsFile()
      if (!file) return
      void (async () => {
        try {
          const next = await fileToPreview(file)
          setImage(next)
        } catch (error) {
          toast(error instanceof Error ? error.message : '读取图片失败', 'error')
        }
      })()
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const save = async () => {
    if (!image) return
    try {
      const path = await saveDialog({
        defaultPath: '头像.png',
        filters: [{ name: '图片', extensions: ['png'] }],
      })
      if (!path) return
      await writeFileBytes(path, dataUrlToBytes(image.dataUrl))
      toast('图片已保存')
    } catch (error) {
      toast(error instanceof Error ? `保存失败：${error.message}` : '保存失败', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      {!image ? (
        <div className="glass mt-6 flex flex-1 items-center justify-center rounded-panel">
          <Empty
            icon={Images}
            title="剪切板图片预览"
            description="选择图片后在此处进行展示，右下角可对图片进行保存"
            action={
              <Button variant="default" disabled={busy} onClick={() => void readClipboard()}>
                读取剪切板图片
              </Button>
            }
          />
        </div>
      ) : null}

      {image ? (
        <PreviewOverlay
          images={[image]}
          index={0}
          onIndex={() => {}}
          onClose={() => setImage(null)}
          action={
            <Tip label="保存图片">
              <Button
                variant="default"
                size="icon-lg"
                aria-label="保存图片"
                className="rounded-full shadow-lg"
                onClick={() => void save()}
              >
                <Download />
              </Button>
            </Tip>
          }
        />
      ) : null}
    </main>
  )
}
