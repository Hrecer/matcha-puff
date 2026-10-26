import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { pluginIcon } from '@/lib/plugin-tools'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

export interface LookupColumn {
  key: string
  label: string
  /** 列宽（像素），第一列默认等宽字体 */
  width?: number
  mono?: boolean
}

export interface LookupWorkbenchProps {
  toolId: string
  hint: string
  placeholder: string
  columns: LookupColumn[]
  /** 展开后展示长文本的字段 */
  detailKey?: string
  /** 统计口径的字段名，默认 total */
  unit?: string
}

interface LookupRow {
  [key: string]: string | number
}

/** 查询类工具的共用工作台：顶部搜索、下方表格，点行展开长说明 */
export function LookupWorkbench({
  toolId,
  hint,
  placeholder,
  columns,
  detailKey,
  unit = '条',
}: LookupWorkbenchProps) {
  const Icon = pluginIcon(toolId)
  const [keyword, setKeyword] = useState('')
  const [rows, setRows] = useState<LookupRow[] | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      void runTool<{ total: number; items: LookupRow[] }>(toolId, {
        keyword: keyword.trim() || undefined,
      }).then((result) => {
        if (!alive) return
        setRows(result.ok ? result.data.items : [])
      })
    }, 160)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [keyword, toolId])

  const total = rows?.length ?? 0
  const gridTemplate = useMemo(
    () => columns.map((column) => (column.width ? `${column.width}px` : 'minmax(0,1fr)')).join(' '),
    [columns],
  )

  const copyRow = async (row: LookupRow) => {
    const text = columns.map((column) => String(row[column.key] ?? '')).join('\t')
    try {
      await copyText(text)
      setCopied(text)
      window.setTimeout(() => setCopied((current) => (current === text ? null : current)), 1200)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={placeholder}
            className="h-8 pl-8 text-[12px]"
            spellCheck={false}
          />
        </div>
        <span className="text-[11px] text-muted-foreground">
          {total} {unit}
        </span>
        {copied ? (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-success">
            <Check className="size-3" />
            已复制
          </span>
        ) : null}
      </div>

      <section className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel">
        <header
          className="grid shrink-0 items-center gap-2 border-b border-border/40 px-3 py-1.5 text-[10.5px] text-muted-foreground"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((column) => (
            <span key={column.key}>{column.label}</span>
          ))}
          <span className="w-6" />
        </header>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin">
          {rows === null ? (
            <p className="py-10 text-center text-[12px] text-muted-foreground">正在读取…</p>
          ) : rows.length === 0 ? (
            <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-1">
              <Icon className="size-6 text-muted-foreground/50" />
              <p className="text-[12px] text-muted-foreground">没有匹配的条目，换个关键词试试。</p>
            </div>
          ) : (
            rows.map((row, index) => {
              const key = `${index}-${String(row[columns[0]?.key ?? ''] ?? '')}`
              const open = openKey === key
              return (
                <div key={key} className="border-b border-border/25 last:border-0">
                  <div
                    role={detailKey ? 'button' : undefined}
                    tabIndex={detailKey ? 0 : undefined}
                    onClick={() => detailKey && setOpenKey(open ? null : key)}
                    onKeyDown={(event) => {
                      if (detailKey && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault()
                        setOpenKey(open ? null : key)
                      }
                    }}
                    className={cn(
                      'group grid items-center gap-2 px-3 py-1.5 text-[12px] transition-colors',
                      detailKey && 'cursor-pointer',
                      open ? 'bg-primary/[0.07]' : 'hover:bg-foreground/[0.03]',
                    )}
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {columns.map((column) => (
                      <span
                        key={column.key}
                        className={cn(
                          'truncate',
                          column.mono ? 'font-mono text-[11.5px] tabular-nums' : '',
                          column === columns[0] ? 'text-foreground' : 'text-muted-foreground',
                        )}
                        title={String(row[column.key] ?? '')}
                      >
                        {String(row[column.key] ?? '')}
                      </span>
                    ))}
                    <Tip label="复制这一行">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void copyRow(row)
                        }}
                        aria-label="复制这一行"
                        className="flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                      >
                        <Copy className="size-3" />
                      </button>
                    </Tip>
                  </div>
                  {detailKey && open ? (
                    <p className="whitespace-pre-line px-3 pb-2.5 pt-0.5 text-[11.5px] leading-5 text-muted-foreground">
                      {String(row[detailKey] ?? '')}
                    </p>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </section>

      <p className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground/70">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/40" />
        {hint}
      </p>
    </main>
  )
}
