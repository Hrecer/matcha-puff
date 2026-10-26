import { useEffect, useState } from 'react'
import { Check, Copy, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

interface SymbolGroupView {
  id: string
  title: string
  symbols: string[]
}

interface SymbolOutput {
  total: number
  groups: SymbolGroupView[]
}

interface KaomojiItemView {
  name: string
  value: string
}

interface KaomojiOutput {
  total: number
  items: KaomojiItemView[]
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (key: string, text: string) => {
    try {
      await copyText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1200)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }
  return { copied, copy }
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border px-2.5 py-1 text-left text-[11.5px] transition-colors',
        active
          ? 'border-primary/35 bg-primary/10 text-primary'
          : 'border-border/60 bg-background/40 text-muted-foreground hover:border-primary/25 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** 数据量大，输入停下来再查，避免每敲一个字都跑一次 runtime */
function useDebounced<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** 特殊符号：左侧分组、右侧符号墙，点一下即复制 */
export function SpecialSymbolsTool() {
  const [keyword, setKeyword] = useState('')
  const [group, setGroup] = useState('')
  const [output, setOutput] = useState<SymbolOutput | null>(null)
  const [titles, setTitles] = useState<{ id: string; title: string }[]>([])
  const { copied, copy } = useCopy()

  const query = useDebounced(keyword)

  useEffect(() => {
    let alive = true
    void runTool<SymbolOutput>('special-symbols', {}).then((result) => {
      if (alive && result.ok) setTitles(result.data.groups.map((item) => ({ id: item.id, title: item.title })))
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    void runTool<SymbolOutput>('special-symbols', {
      keyword: query.trim() || undefined,
      group: group || undefined,
    }).then((result) => {
      if (!alive) return
      if (result.ok) setOutput(result.data)
      else setOutput({ total: 0, groups: [] })
    })
    return () => {
      alive = false
    }
  }, [query, group])

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜符号或分组名，例如 → 或 货币"
            className="h-8 pl-8 text-[12px]"
            spellCheck={false}
          />
        </div>
        <span className="text-[11px] text-muted-foreground">
          {output?.groups.length ?? 0} 组 · {output?.total ?? 0} 个符号
        </span>
        {copied ? (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-success">
            <Check className="size-3" />
            已复制
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="glass flex w-36 shrink-0 flex-col gap-1 overflow-auto rounded-panel p-2 scroll-thin">
          <Chip active={!group} onClick={() => setGroup('')}>
            全部分组
          </Chip>
          {titles.map((item) => (
            <Chip
              key={item.id}
              active={group === item.id}
              onClick={() => setGroup(item.id === group ? '' : item.id)}
            >
              {item.title}
            </Chip>
          ))}
        </aside>

        <section className="glass min-h-0 flex-1 overflow-auto rounded-panel p-3 scroll-thin">
          {!output ? (
            <p className="py-10 text-center text-[12px] text-muted-foreground">正在读取符号表…</p>
          ) : output.groups.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-muted-foreground">
              没有匹配的符号，换个关键词试试。
            </p>
          ) : (
            output.groups.map((item) => (
              <div key={item.id} className="mb-3 last:mb-0">
                <h3 className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                  {item.title}
                  <span className="ml-1.5 text-muted-foreground/60">{item.symbols.length}</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {item.symbols.map((symbol, index) => (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      onClick={() => void copy(symbol, symbol)}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-md border border-border/60 bg-background/40 text-[15px] text-foreground transition-colors hover:border-primary/40 hover:text-primary',
                        copied === symbol && 'border-primary/50 bg-primary/10 text-primary',
                      )}
                    >
                      {copied === symbol ? <Copy className="size-3.5" /> : symbol}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

/** 颜文字：搜索 + 卡片墙，点卡片复制表情 */
export function KaomojiTool() {
  const [keyword, setKeyword] = useState('')
  const [output, setOutput] = useState<KaomojiOutput | null>(null)
  const { copied, copy } = useCopy()
  const query = useDebounced(keyword)

  useEffect(() => {
    let alive = true
    void runTool<KaomojiOutput>('kaomoji', { keyword: query.trim() || undefined }).then((result) => {
      if (!alive) return
      setOutput(result.ok ? result.data : { total: 0, items: [] })
    })
    return () => {
      alive = false
    }
  }, [query])

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜名称或表情，例如 摔桌"
            className="h-8 pl-8 text-[12px]"
            spellCheck={false}
          />
        </div>
        <span className="text-[11px] text-muted-foreground">{output?.total ?? 0} 个表情</span>
        {copied ? (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-success">
            <Check className="size-3" />
            已复制
          </span>
        ) : null}
      </div>

      <section className="glass min-h-0 flex-1 overflow-auto rounded-panel p-3 scroll-thin">
        {!output ? (
          <p className="py-10 text-center text-[12px] text-muted-foreground">正在读取表情表…</p>
        ) : output.items.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-muted-foreground">没有匹配的颜文字。</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2">
            {output.items.map((item, index) => (
              <button
                key={`${item.name}-${index}`}
                type="button"
                onClick={() => void copy(item.value, item.value)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-md border border-border/60 bg-background/40 px-2.5 py-2 text-left transition-colors hover:border-primary/40',
                  copied === item.value && 'border-primary/50 bg-primary/10',
                )}
              >
                <span className="line-clamp-1 text-[10.5px] text-muted-foreground">{item.name}</span>
                <span className="line-clamp-2 font-mono text-[13px] leading-snug text-foreground">
                  {item.value}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
