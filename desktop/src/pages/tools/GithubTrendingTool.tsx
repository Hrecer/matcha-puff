import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, GitBranch, GitFork, Loader2, RefreshCw, Star } from 'lucide-react'
import { TRENDING_LANGUAGES } from '@matcha-puff/tools'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { SelectField } from '@/components/ui/select-field'
import { SlidingSegmented } from '@/components/ui/sliding'
import { httpGet, inTauri, openExternal } from '@/ipc/bridge'
import { runTool } from '@/lib/tool-core'

type Since = 'monthly' | 'weekly' | 'daily'

interface TrendingItem {
  url: string
  title: string
  desc: string
  lang: string
  star: string
  fork: string
  today: string
}

interface TrendingPrep {
  url: string
  sinceLabel: string
}

function parseTrending(html: string): TrendingItem[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('article.Box-row'))
    .map((row) => {
      const link = row.querySelector('h2 a')
      const href = link?.getAttribute('href') ?? ''
      const footer = row.querySelector('.f6')
      const anchors = footer ? Array.from(footer.querySelectorAll('a')) : []
      const spans = footer ? Array.from(footer.querySelectorAll('span')) : []
      return {
        url: href ? `https://github.com${href}` : '',
        title: (link?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        desc: (row.querySelector('p')?.textContent ?? '').trim(),
        lang: (row.querySelector('[itemprop="programmingLanguage"]')?.textContent ?? '').trim(),
        star: (anchors[0]?.textContent ?? '').trim(),
        fork: (anchors[1]?.textContent ?? '').trim(),
        today: (spans[spans.length - 1]?.textContent ?? '')
          .replace(/stars (today|this week|this month)/i, '')
          .trim(),
      }
    })
    .filter((item) => item.title)
}

export function GithubTrendingTool() {
  const [language, setLanguage] = useState('')
  const [since, setSince] = useState<Since>('monthly')
  const [activeLabel, setActiveLabel] = useState('本月')
  const [items, setItems] = useState<TrendingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const seq = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const prep = await runTool<TrendingPrep>('github-trending', { language, since })
      if (!prep.ok) throw new Error(prep.error.message)
      setActiveLabel(prep.data.sinceLabel)
      let html = ''
      if (inTauri()) {
        html = await httpGet<string>(prep.data.url)
      } else {
        const response = await fetch(prep.data.url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        html = await response.text()
      }
      const parsed = parseTrending(html)
      if (seq !== requestId.current) return
      if (!parsed.length) throw new Error('未解析到趋势项目')
      setItems(parsed)
    } catch (loadError) {
      if (seq !== requestId.current) return
      setItems([])
      const message =
        !inTauri() && loadError instanceof TypeError
          ? '浏览器预览受跨域限制，桌面端会由宿主请求 GitHub。'
          : loadError instanceof Error
            ? loadError.message
            : '获取 GitHub 趋势榜失败'
      setError(message)
    } finally {
      if (seq === requestId.current) setLoading(false)
    }
  }, [language, since])

  useEffect(() => {
    void load()
  }, [load])

  const open = (url: string) => {
    if (!url) return
    if (inTauri()) void openExternal(url)
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <section className="glass flex shrink-0 flex-wrap items-center gap-2 rounded-panel p-3">
        <div className="flex items-center gap-2">
          <GitBranch className="size-5 text-primary" />
          <div>
            <p className="text-[14px] font-semibold text-foreground">Github项目趋势榜</p>
            <p className="text-[10.5px] text-muted-foreground">
              当前数据来自{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => open('https://github.com/trending')}
              >
                Github Trending
              </button>
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SelectField
            value={language}
            onValueChange={setLanguage}
            options={TRENDING_LANGUAGES.map((item) => ({ value: item.name, label: item.title }))}
            ariaLabel="语言"
            size="sm"
            className="h-8 px-2 text-[11.5px]"
          />
          <SlidingSegmented
            options={[
              { value: 'monthly' as const, label: '月榜' },
              { value: 'weekly' as const, label: '周榜' },
              { value: 'daily' as const, label: '天榜' },
            ]}
            value={since}
            onValueChange={setSince}
            size="sm"
            motion="spring"
            bare
            ariaLabel="榜单周期"
          />
          <Button variant="ghost" size="icon-sm" aria-label="刷新" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        </div>
      </section>

      <section className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在获取数据中...
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <Empty
              icon={GitBranch}
              title="获取 GitHub 趋势榜好像出现点问题"
              description="浏览器预览会受跨域限制；桌面端由宿主请求。也可以直接打开网页版。"
            />
            <p className="text-[10.5px] text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => open('https://github.com/trending')}>
              <ExternalLink />
              https://github.com/trending
            </Button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-2 scroll-thin">
            <div className="flex flex-col gap-2">
              {items.map((item, index) => (
                <article
                  key={`${item.url}-${index}`}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer rounded-lg border border-border/40 bg-foreground/[0.02] px-3 py-2.5 text-left outline-none transition-colors hover:border-primary/35 hover:bg-primary/[0.04] focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  onClick={() => open(item.url)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      open(item.url)
                    }
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {item.lang ? (
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {item.lang}
                      </span>
                    ) : null}
                    <p className="min-w-0 truncate text-[13px] font-medium text-foreground">{item.title}</p>
                    <ExternalLink className="ml-auto size-3 shrink-0 text-muted-foreground/50" />
                  </div>
                  {item.desc ? (
                    <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">{item.desc}</p>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-4 text-[10.5px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3 text-amber-500" />
                      {item.star || '0'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GitFork className="size-3 text-sky-600" />
                      {item.fork || '0'}
                    </span>
                    <span>
                      {activeLabel}新增 <span className="font-medium text-primary">{item.today || '0'}</span> 个关注
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
