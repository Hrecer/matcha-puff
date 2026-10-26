import { useCallback, useRef, useState } from 'react'
import { decompressFrames, parseGIF, type ParsedFrame } from 'gifuct-js'
import { CheckSquare, Clipboard, Download, Grid3X3, Loader2, Plus, Square, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { toast } from '@/components/ui/toast'
import {
  createDirectory,
  fileExists,
  inTauri,
  openDialog,
  pathJoin,
  readFileBase64,
  writeFileBytes,
} from '@/ipc/bridge'
import { copyImageDataUrl, dataUrlToBytes } from './shared/ImageWorkbench'

interface GifFrame {
  dataUrl: string
  delayMs: number
}

interface GifInfo {
  name: string
  path: string
  width: number
  height: number
}

function parseFrameDelays(buffer: ArrayBuffer): { frames: ParsedFrame[]; width: number; height: number } {
  const parsed = parseGIF(buffer)
  const frames = decompressFrames(parsed, true)
  return { frames, width: parsed.lsd.width, height: parsed.lsd.height }
}

async function extractFrames(buffer: ArrayBuffer): Promise<{ info: { width: number; height: number }; frames: GifFrame[] }> {
  const { frames, width, height } = parseFrameDelays(buffer)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('无法创建画布')

  const patchCanvas = document.createElement('canvas')
  const patchContext = patchCanvas.getContext('2d')
  if (!patchContext) throw new Error('无法创建帧画布')

  const output: GifFrame[] = []
  let restore: ImageData | null = null
  let previous: { left: number; top: number; width: number; height: number; disposal: number } | null = null

  for (const frame of frames) {
    if (previous) {
      if (previous.disposal === 2) {
        context.clearRect(previous.left, previous.top, previous.width, previous.height)
      } else if (previous.disposal === 3 && restore) {
        context.putImageData(restore, 0, 0)
      }
    }

    if (frame.disposalType === 3) restore = context.getImageData(0, 0, width, height)

    patchCanvas.width = Math.max(1, frame.dims.width)
    patchCanvas.height = Math.max(1, frame.dims.height)
    patchContext.clearRect(0, 0, patchCanvas.width, patchCanvas.height)
    patchContext.putImageData(
      new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height),
      0,
      0,
    )
    context.drawImage(patchCanvas, frame.dims.left, frame.dims.top)

    output.push({ dataUrl: canvas.toDataURL('image/png'), delayMs: frame.delay * 10 })
    previous = {
      left: frame.dims.left,
      top: frame.dims.top,
      width: frame.dims.width,
      height: frame.dims.height,
      disposal: frame.disposalType,
    }
  }
  return { info: { width, height }, frames: output }
}

function browserDownload(dataUrl: string, name: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = name
  link.click()
}

export function GifFramesTool() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [info, setInfo] = useState<GifInfo | null>(null)
  const [frames, setFrames] = useState<GifFrame[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const loadBuffer = useCallback(
    async (buffer: ArrayBuffer, name: string, path: string) => {
      if (!/gif$/i.test(name)) {
        toast('请选择 GIF 文件', 'error')
        return
      }
      setBusy(true)
      setFrames([])
      setSelected([])
      setInfo(null)
      try {
        const result = await extractFrames(buffer)
        setInfo({
          name,
          path: path || '本地选择',
          width: result.info.width,
          height: result.info.height,
        })
        setFrames(result.frames)
      } catch (error) {
        toast(error instanceof Error ? `GIF 解析失败：${error.message}` : 'GIF 解析失败', 'error')
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const load = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return
      if (!/gif$/i.test(file.name) && file.type !== 'image/gif') {
        toast('请选择 GIF 文件', 'error')
        return
      }
      const fullPath = (file as File & { path?: string }).path ?? ''
      const directory = fullPath ? fullPath.replace(/[\\/][^\\/]*$/, '') : ''
      await loadBuffer(await file.arrayBuffer(), file.name, directory)
    },
    [loadBuffer],
  )

  const pick = useCallback(async () => {
    if (!inTauri()) {
      inputRef.current?.click()
      return
    }
    const path = await openDialog({
      title: '选择 GIF 文件',
      filters: [{ name: 'GIF 图片', extensions: ['gif'] }],
    })
    if (!path || Array.isArray(path)) return
    try {
      const base64 = await readFileBase64(path)
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
      const name = path.split(/[\\/]/).pop() ?? 'image.gif'
      const directory = path.replace(/[\\/][^\\/]*$/, '')
      await loadBuffer(bytes.buffer, name, directory)
    } catch (error) {
      toast(error instanceof Error ? `读取文件失败：${error.message}` : '读取文件失败', 'error')
    }
  }, [loadBuffer])

  const selectAll = () => setSelected(frames.map((_, index) => index))
  const clearSelection = () => setSelected([])
  const toggle = (index: number) =>
    setSelected((current) =>
      current.includes(index) ? current.filter((value) => value !== index) : [...current, index],
    )

  const copy = async () => {
    if (selected.length !== 1) {
      toast('复制仅支持一张图片，请不要多选', 'error')
      return
    }
    const frame = frames[selected[0]!]
    if (!frame) return
    try {
      await copyImageDataUrl(frame.dataUrl)
      toast('图片已复制')
    } catch (error) {
      toast(error instanceof Error ? `复制失败：${error.message}` : '复制失败', 'error')
    }
  }

  const download = async () => {
    if (!selected.length) {
      toast('请至少选择一张图片', 'error')
      return
    }
    const base = (info?.name ?? 'gif').replace(/\.[^.]+$/, '') || 'gif'
    if (!inTauri()) {
      selected.forEach((index, offset) => {
        window.setTimeout(() => browserDownload(frames[index]!.dataUrl, `${base}-${index + 1}.png`), offset * 120)
      })
      return
    }
    try {
      const folder = await openDialog({ directory: true, title: '选择保存文件夹' })
      if (!folder || Array.isArray(folder)) return
      let target = await pathJoin(folder, `${base}-frames`)
      if (await fileExists(target)) target = await pathJoin(folder, `${base}-frames-${Date.now()}`)
      await createDirectory(target)
      setBusy(true)
      for (const index of selected) {
        const frame = frames[index]
        if (!frame) continue
        await writeFileBytes(await pathJoin(target, `${index + 1}.png`), dataUrlToBytes(frame.dataUrl))
      }
      toast('已将选中图片保存到指定文件夹')
    } catch (error) {
      toast(error instanceof Error ? `保存失败：${error.message}` : '保存失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-0 flex-1 gap-3 px-4 pb-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/gif,.gif"
        hidden
        onChange={(event) => {
          void load(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      <section className="glass flex min-h-0 flex-1 flex-col rounded-panel">
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border/40 px-3">
          <Grid3X3 className="size-4 text-primary" />
          <h2 className="text-[13px] font-medium text-foreground">GIF 图片帧列表</h2>
          {busy ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
          <span className="ml-auto text-[10.5px] tabular-nums text-muted-foreground">
            {frames.length ? `已选 ${selected.length} / ${frames.length}` : ''}
          </span>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {frames.length === 0 ? (
            <div
              className={
                dragging
                  ? 'flex h-full min-h-[260px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/[0.04]'
                  : 'flex h-full min-h-[260px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50'
              }
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void load(event.dataTransfer.files?.[0])
              }}
            >
              <Empty
                icon={Upload}
                title="GIF 图片帧列表"
                description="转换成功后的图片帧列表将在此处显示"
              />
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
              {frames.map((frame, index) => {
                const checked = selected.includes(index)
                return (
                  <button
                    key={index}
                    type="button"
                    className={
                      checked
                        ? 'group relative overflow-hidden rounded-lg border-2 border-primary bg-primary/[0.04] text-left outline-none'
                        : 'group relative overflow-hidden rounded-lg border border-border/50 text-left outline-none hover:border-primary/40'
                    }
                    onClick={() => toggle(index)}
                  >
                    <span className="flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#00000008_0%_25%,transparent_0%_50%)] bg-[length:14px_14px] p-2">
                      <img src={frame.dataUrl} alt={`第 ${index + 1} 帧`} className="max-h-full max-w-full object-contain" />
                    </span>
                    <span className="flex items-center gap-1 border-t border-border/40 px-2 py-1.5 text-[10.5px] text-muted-foreground">
                      {checked ? <CheckSquare className="size-3 text-primary" /> : <Square className="size-3" />}
                      第 {index + 1} 帧
                      <span className="ml-auto tabular-nums">{frame.delayMs}ms</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <aside className="glass flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto rounded-panel p-3 scroll-thin">
        <button
          type="button"
          className="group flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/60 px-4 py-7 text-center outline-none transition-colors hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/40"
          onClick={() => void pick()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            void load(event.dataTransfer.files?.[0])
          }}
        >
          <Plus className="mb-2 size-7 text-muted-foreground transition-colors group-hover:text-primary" />
          <span className="text-[12.5px] font-medium text-foreground">点击或拖拽文件来处理</span>
          <span className="mt-1 text-[10.5px] text-muted-foreground">此功能无需网络，文件将在本地进行处理</span>
        </button>

        <div className="rounded-lg border border-border/40">
          <p className="border-b border-border/40 px-3 py-2 text-[12px] font-medium text-foreground">图片信息</p>
          <dl className="grid grid-cols-[68px_minmax(0,1fr)] gap-y-1.5 px-3 py-2.5 text-[11px]">
            {[
              ['文件名', info?.name ?? '-'],
              ['路径', info?.path ?? '-'],
              ['图片宽', info ? String(info.width) : '-'],
              ['图片高', info ? String(info.height) : '-'],
              ['图片张数', frames.length ? String(frames.length) : '-'],
            ].map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate text-right text-foreground" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled={!frames.length} onClick={selectAll}>
            <CheckSquare />
            全选
          </Button>
          <Button variant="outline" size="sm" disabled={!frames.length} onClick={clearSelection}>
            <Square />
            取消选择
          </Button>
          <Button variant="secondary" size="sm" disabled={!frames.length} onClick={() => void copy()}>
            <Clipboard />
            复制选中图片
          </Button>
          <Button size="sm" disabled={!frames.length} onClick={() => void download()}>
            <Download />
            下载选中图片
          </Button>
        </div>
      </aside>
    </main>
  )
}
