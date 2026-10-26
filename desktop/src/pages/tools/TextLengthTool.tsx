import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Eraser, Ruler, WandSparkles } from 'lucide-react'
import type { ToolResult } from '@matcha-puff/tool-contracts'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

interface LengthOutput {
  chars: number
  codePoints: number
  bytes: number
  lines: number
  words: number
  chineseChars: number
}

const EXAMPLE = '抹茶泡芙 · Make it simple.\n第二行有一段中文，也有 emoji 😀。'

const STATS: { key: keyof LengthOutput; label: string; note: string }[] = [
  { key: 'chars', label: '字符数', note: 'UTF-16 长度' },
  { key: 'codePoints', label: '码点数', note: 'emoji 记 1 个' },
  { key: 'bytes', label: 'UTF-8 字节', note: '按字节存储' },
  { key: 'lines', label: '行数', note: '按换行拆分' },
  { key: 'words', label: '单词数', note: '按空白分词' },
  { key: 'chineseChars', label: '中文字数', note: '汉字字符' },
]

const ZERO: LengthOutput = { chars: 0, codePoints: 0, bytes: 0, lines: 0, words: 0, chineseChars: 0 }

/** 字符串长度计算：输入即统计，但每次统计仍走统一 Runtime */
export function TextLengthTool() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ToolResult<LengthOutput> | null>(null)
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(timer.current)
    let cancelled = false
    timer.current = window.setTimeout(() => {
      runTool<LengthOutput>('text-length', { text })
        .then((next) => {
          if (!cancelled) setResult(next)
        })
        .catch(() => {})
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer.current)
    }
  }, [text])

  const output = result?.ok ? result.data : null
  const stats = output ?? ZERO

  const copy = async () => {
    const summary = STATS.map((item) => `${item.label}：${stats[item.key]}`).join('\n')
    try {
      await copyText(summary)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        输入即统计：字符、码点、字节、行、单词与中文字数。
      </p>

      <section className="glass flex min-h-0 flex-1 flex-col rounded-panel p-3">
        <header className="flex h-8 shrink-0 items-center gap-2">
          <Ruler className="size-4 text-primary" />
          <h2 className="text-[13px] font-medium text-foreground">文本</h2>
          <span className="rounded-full bg-primary/[0.08] px-2 py-0.5 text-[10.5px] text-primary">
            实时统计
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <Tip label="填入示例">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="填入示例"
                onClick={() => setText(EXAMPLE)}
              >
                <WandSparkles />
              </Button>
            </Tip>
            <Tip label="清空">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="清空"
                disabled={!text}
                onClick={() => setText('')}
              >
                <Eraser />
              </Button>
            </Tip>
          </div>
        </header>

        <textarea
          value={text}
          spellCheck={false}
          placeholder="粘贴或输入需要统计的文本"
          onChange={(event) => setText(event.target.value)}
          className="mt-1.5 min-h-0 flex-1 resize-none rounded-md bg-transparent p-2 font-mono text-[12.5px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:bg-foreground/[0.025] scroll-thin"
        />
      </section>

      <section className="glass shrink-0 rounded-panel p-3">
        <header className="flex h-7 items-center gap-2">
          <h2 className="text-[13px] font-medium text-foreground">统计</h2>
          {result && !result.ok ? (
            <span className="text-[11px] font-medium text-destructive">执行失败</span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-success">
              <Check className="size-3" />
              已更新
            </span>
          )}
          <Tip label="复制统计">
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              aria-label="复制统计"
              onClick={() => void copy()}
            >
              {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
          </Tip>
        </header>

        {result && !result.ok ? (
          <ErrorState
            compact
            code={result.error.code}
            message={result.error.message}
            className="mt-2"
          />
        ) : text === '' && !result ? (
          <div className="mt-2">
            <Empty size="sm" icon={Ruler} title="等待输入" description="输入文本后会自动统计。" />
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {STATS.map((item) => (
              <div
                key={item.key}
                className={cn(
                  'rounded-lg bg-foreground/[0.035] px-3 py-2.5',
                  item.key === 'chars' && 'bg-primary/[0.08]',
                )}
              >
                <p className="text-[10.5px] text-muted-foreground">{item.label}</p>
                <p className="mt-0.5 font-mono text-[22px] leading-7 tabular-nums text-foreground">
                  {stats[item.key]}
                </p>
                <p className="text-[9.5px] text-muted-foreground/70">{item.note}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
