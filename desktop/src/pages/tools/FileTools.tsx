import { useRef, useState, type ReactNode } from 'react'
import { Check, Copy, Download, FileUp, Loader2, Play, X } from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { saveDialog, writeFileBytes } from '@/ipc/bridge'
import { copyText } from '@/lib/clipboard'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

interface PickedFile {
  name: string
  size: number
  dataUrl: string
}

const humanSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`
}

export interface FileWorkbenchProps<TResult> {
  toolId: string
  hint: string
  runLabel: string
  /** 顶部开关，例如「折行」「大写输出」 */
  toggle?: { key: string; label: string; defaultValue: boolean }
  /** 额外入参（除 dataUrl 与开关以外） */
  extra?: Record<string, unknown>
  
  autoRun?: boolean
  renderResult: (data: TResult, copy: (text: string, key: string) => void, copied: string | null) => ReactNode
  canRun?: (data: TResult) => boolean
}

/** 文件类工具共用工作台：选文件 → 出结果 */
export function FileWorkbench<TResult>({
  toolId,
  hint,
  runLabel,
  toggle,
  extra,
  autoRun = false,
  renderResult,
}: FileWorkbenchProps<TResult>) {
  const Icon = pluginIcon(toolId)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<PickedFile | null>(null)
  const [flag, setFlag] = useState(toggle?.defaultValue ?? false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult<TResult> | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const output = result?.ok ? result.data : null

  const run = async (source: PickedFile | null = file) => {
    if (!source || loading) return
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        ...extra,
        dataUrl: source.dataUrl,
        ...(toggle ? { [toggle.key]: flag } : {}),
      }
      setResult(await runTool<TResult>(toolId, payload))
    } finally {
      setLoading(false)
    }
  }

  const readFile = (picked: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const next = { name: picked.name, size: picked.size, dataUrl: String(reader.result ?? '') }
      setFile(next)
      setResult(null)
      if (autoRun) void run(next)
    }
    reader.onerror = () => toast('读取文件失败', 'error')
    reader.readAsDataURL(picked)
  }

  const copy = async (text: string, key: string) => {
    try {
      await copyText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1400)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        {hint}
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Icon className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">选文件</h2>
          </header>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              const picked = event.dataTransfer.files?.[0]
              if (picked) readFile(picked)
            }}
            className={cn(
              'mt-1 flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-center transition-colors',
              dragOver
                ? 'border-primary bg-primary/[0.08]'
                : 'border-border/70 bg-background/30 hover:border-primary/60 hover:bg-primary/[0.04]',
            )}
          >
            <FileUp className="size-5 text-muted-foreground" aria-hidden />
            <span className="text-[12px] text-foreground">点击选择文件</span>
            <span className="text-[10.5px] leading-4 text-muted-foreground">
              也可以把文件拖进来；大文件读取会占用较多内存
            </span>
          </button>

          {file ? (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-border/50 bg-background/40 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] text-foreground" title={file.name}>
                  {file.name}
                </p>
                <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                  {humanSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                aria-label="移除文件"
                onClick={() => {
                  setFile(null)
                  setResult(null)
                }}
                className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}

          {toggle ? (
            <div className="mt-2 flex h-9 items-center justify-between rounded-md border border-border/60 bg-background/40 px-3">
              <span className="text-[11.5px] text-foreground">{toggle.label}</span>
              <Switch checked={flag} onCheckedChange={setFlag} aria-label={toggle.label} />
            </div>
          ) : null}

          <div className="mt-auto pt-3">
            <Button className="w-full" size="sm" disabled={!file || loading} onClick={() => void run()}>
              {loading ? <Loader2 className="animate-spin" /> : <Play />}
              {loading ? '处理中…' : runLabel}
            </Button>
          </div>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="text-[13px] font-medium text-foreground">结果</h2>
            {output ? (
              <span className="text-[10.5px] text-muted-foreground">已完成</span>
            ) : null}
          </header>
          <div className="mt-1 min-h-0 flex-1">
            {result && !result.ok ? (
              <ErrorState message={result.error.message} />
            ) : output ? (
              renderResult(output, copy, copied)
            ) : (
              <Empty
                icon={Icon}
                title="还没有结果"
                description={file ? '点左下角开始处理。' : '先选一个文件。'}
              />
            )}
          </div>
        </section>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0]
          if (picked) readFile(picked)
          event.target.value = ''
        }}
      />
    </main>
  )
}

/** 一行结果 + 复制按钮 */
export function CopyRow({
  label,
  value,
  copyKey,
  copy,
  copied,
  mono = true,
}: {
  label: string
  value: string
  copyKey: string
  copy: (text: string, key: string) => void
  copied: string | null
  mono?: boolean
}) {
  return (
    <div className="group flex items-center gap-2 border-b border-border/40 py-1.5 last:border-b-0">
      <span className="w-20 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 flex-1 break-all text-[12px] text-foreground', mono && 'font-mono')}>
        {value}
      </span>
      <button
        type="button"
        aria-label={`复制${label}`}
        onClick={() => copy(value, copyKey)}
        className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
      >
        {copied === copyKey ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

interface Base64Output {
  mime: string
  bytes: number
  humanSize: string
  base64: string
  dataUrl: string
  base64Length: number
  overheadPercent: number
}

/** 文件转 Base64 */
export function FileBase64Tool() {
  const download = async (data: Base64Output) => {
    try {
      const path = await saveDialog({
        title: '保存 Base64 文本',
        defaultPath: 'base64.txt',
        filters: [{ name: '文本文件', extensions: ['txt'] }],
      })
      if (!path) return
      await writeFileBytes(path, Array.from(new TextEncoder().encode(data.base64)))
      toast('Base64 文本已保存')
    } catch (saveError) {
      toast(saveError instanceof Error ? `保存失败：${saveError.message}` : '保存失败', 'error')
    }
  }

  return (
    <FileWorkbench<Base64Output>
      toolId="file-base64"
      hint="选任意文件，转成 Base64 或 data URL；可折行，也可把 Base64 文本直接下载为 txt。"
      runLabel="转 Base64"
      toggle={{ key: 'wrap', label: '每 76 字符折行', defaultValue: false }}
      renderResult={(data, copy, copied) => (
        <div className="flex h-full flex-col gap-2">
          <p className="flex shrink-0 items-center gap-2 rounded-md bg-primary/[0.08] px-3 py-2 text-[11.5px] text-foreground/80">
            <span className="font-mono">{data.mime}</span>
            <span className="text-muted-foreground">{data.humanSize}</span>
            <span className="ml-auto font-mono text-muted-foreground">
              {data.base64Length} 字符 · 膨胀 {data.overheadPercent}%
            </span>
          </p>
          <pre
            className={cn(
              'min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border/50',
              'bg-background/40 p-2.5 font-mono text-[12px] leading-6 text-foreground scroll-thin',
            )}
          >
            {data.base64}
          </pre>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => copy(data.base64, 'base64')}>
              {copied === 'base64' ? <Check /> : <Copy />}
              复制 Base64
            </Button>
            <Button size="sm" variant="secondary" onClick={() => copy(data.dataUrl, 'dataUrl')}>
              {copied === 'dataUrl' ? <Check /> : <Copy />}
              复制 data URL
            </Button>
            <Button size="sm" variant="outline" onClick={() => void download(data)}>
              <Download />
              下载 Base64 文本
            </Button>
          </div>
        </div>
      )}
    />
  )
}

interface HashOutput {
  mime: string
  bytes: number
  humanSize: string
  hashes: { algorithm: string; hex: string; length: number }[]
}

/** 文件哈希校验 */
export function FileHashTool() {
  return (
    <FileWorkbench<HashOutput>
      toolId="file-hash"
      hint="选文件，一次算出 MD5 / SHA-1 / SHA-256 三种校验值，点右侧图标复制。"
      runLabel="算哈希"
      toggle={{ key: 'uppercase', label: '大写输出', defaultValue: false }}
      extra={{ algorithms: ['MD5', 'SHA1', 'SHA256'] }}
      renderResult={(data, copy, copied) => (
        <div className="flex h-full flex-col">
          <p className="mb-2 flex shrink-0 items-center gap-2 rounded-md bg-primary/[0.08] px-3 py-2 text-[11.5px] text-foreground/80">
            <span className="font-mono">{data.mime}</span>
            <span className="text-muted-foreground">{data.humanSize}</span>
            <span className="ml-auto text-muted-foreground">{data.bytes} 字节</span>
          </p>
          <div className="min-h-0 flex-1 overflow-auto pr-1 scroll-thin">
            {data.hashes.map((item) => (
              <CopyRow
                key={item.algorithm}
                label={item.algorithm}
                value={item.hex}
                copyKey={item.algorithm}
                copy={copy}
                copied={copied}
              />
            ))}
          </div>
        </div>
      )}
    />
  )
}
