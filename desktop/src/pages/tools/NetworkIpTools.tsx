import { useEffect, useState } from 'react'
import {
  Check,
  Globe,
  Loader2,
  MapPin,
  Network,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { httpGet, inTauri, invoke } from '@/ipc/bridge'
import { copyText } from '@/lib/clipboard'
import { runTool } from '@/lib/tool-core'

interface IpApiResponse {
  status?: string
  message?: string
  query?: string
  country?: string
  regionName?: string
  city?: string
  zip?: string
  lat?: number
  lon?: number
  timezone?: string
  isp?: string
  org?: string
}

function normalizeCountry(country: string | undefined): string {
  if (!country) return ''
  return ['香港', '台湾', '澳门'].includes(country) ? '中国' : country
}

async function fetchText(url: string): Promise<string> {
  if (inTauri()) return httpGet<string>(url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function fetchIpApi(url: string): Promise<IpApiResponse> {
  if (inTauri()) return httpGet<IpApiResponse>(url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as IpApiResponse
}

/** 当前 IP：本机网卡列表 + 出口 IP/归属地 */
export function CurrentIpTool() {
  const [locals, setLocals] = useState<Array<[string, string]>>([])
  const [exitIp, setExitIp] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (text: string) => {
    try {
      await copyText(text)
      setCopied(text)
      window.setTimeout(() => setCopied((current) => (current === text ? null : current)), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const refresh = async () => {
    setLoading(true)
    setError('')
    if (inTauri()) {
      try {
        const raw = await invoke<string>('get_local_ip')
        const parsed = JSON.parse(raw) as Array<[string, string]>
        setLocals(Array.isArray(parsed) ? parsed : [])
      } catch {
        setLocals([])
      }
    } else {
      setLocals([])
    }
    try {
      const text = await fetchText('http://myip.ipip.net')
      const match = text.match(/(\d{1,3}\.){3}\d{1,3}/)
      setExitIp(match?.[0] ?? '')
      setLocation(text.split('来自于：')[1]?.trim() ?? '')
    } catch (fetchError) {
      setError(fetchError instanceof Error ? `出口 IP 查询失败：${fetchError.message}` : '出口 IP 查询失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <p className="flex shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/60" />
        本机网卡地址来自宿主枚举；出口 IP 与归属地需要联网查询。
        <Button variant="ghost" size="xs" className="ml-auto" disabled={loading} onClick={() => void refresh()}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          刷新
        </Button>
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Network className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">本地网络信息</h2>
            <span className="ml-auto text-[10.5px] tabular-nums text-muted-foreground">
              {locals.length ? `${locals.length} 条` : ''}
            </span>
          </header>
          <div className="mt-2 min-h-0 flex-1 overflow-auto scroll-thin">
            {loading && locals.length === 0 ? (
              <div className="flex h-full min-h-[160px] items-center justify-center gap-2 text-[11.5px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在读取网卡…
              </div>
            ) : locals.length === 0 ? (
              <div className="flex h-full min-h-[160px] items-center justify-center rounded-md border border-dashed border-border/60">
                <Empty size="sm" icon={Network} title="暂无数据" description="桌面端可读取本机网卡地址。" />
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {locals.map(([name, ip]) => (
                  <li key={`${name}-${ip}`} className="flex items-center gap-2 py-2">
                    <span className="max-w-[46%] truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-medium text-primary">
                      {name}
                    </span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left font-mono text-[11.5px] text-muted-foreground hover:text-foreground"
                      title={`点击复制 ${ip}`}
                      onClick={() => void copy(ip)}
                    >
                      {copied === ip ? '已复制' : ip}
                    </button>
                    {copied === ip ? <Check className="size-3 text-success" /> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="glass flex min-h-0 flex-col rounded-panel p-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <Globe className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium text-foreground">出口IP信息</h2>
            {loading ? <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" /> : null}
          </header>

          {error ? (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/[0.05] px-3 py-2 text-[11px] leading-relaxed text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Globe className="size-7" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-foreground">您的出口IP地址为</p>
            {exitIp ? (
              <button
                type="button"
                className="mt-2 break-all font-mono text-xl tabular-nums text-primary hover:underline"
                title="点击复制"
                onClick={() => void copy(exitIp)}
              >
                {copied === exitIp ? '已复制' : exitIp}
              </button>
            ) : (
              <p className="mt-2 font-mono text-xl text-muted-foreground">—</p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">{location || ' '}</p>
          </div>
        </section>
      </div>
    </main>
  )
}


export function IpQueryTool() {
  const [ip, setIp] = useState('')
  const [data, setData] = useState<IpApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const query = async () => {
    const value = ip.trim()
    if (!value || loading) return
    setLoading(true)
    setError('')
    try {
      const validation = await runTool<{ ip: string; queryUrl: string }>('ip-query', { ip: value })
      if (!validation.ok) {
        setData(null)
        setError(validation.error.message)
        return
      }
      const result = await fetchIpApi(validation.data.queryUrl)
      if (result.status === 'fail') {
        setData(null)
        setError(result.message ?? '获取IP信息失败，请稍后重试。')
        return
      }
      setData(result)
    } catch (queryError) {
      setData(null)
      setError(
        queryError instanceof Error
          ? `获取IP信息失败：${queryError.message}`
          : '获取IP信息失败，请稍后重试。',
      )
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!data?.query) return
    try {
      await copyText(data.query)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const country = normalizeCountry(data?.country)

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <section className="glass shrink-0 rounded-panel p-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] text-muted-foreground">要查询的IP地址:</span>
          <Input
            value={ip}
            spellCheck={false}
            placeholder="请输入要查询的IP地址"
            onChange={(event) => setIp(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void query()
              }
            }}
            className="h-9 flex-1 font-mono text-[13px]"
          />
          <Button size="sm" disabled={!ip.trim() || loading} onClick={() => void query()}>
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
            {loading ? '查询中…' : '获取IP信息'}
          </Button>
        </div>
      </section>

      <section className="glass flex min-h-0 flex-1 flex-col rounded-panel p-3">
        {error ? (
          <p className="shrink-0 rounded-md border border-destructive/30 bg-destructive/[0.05] px-3 py-2 text-[11px] leading-relaxed text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-auto pt-4 scroll-thin">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="size-8" />
          </div>
          {data ? (
            <button
              type="button"
              className="mt-3 break-all font-mono text-2xl font-medium text-primary hover:underline"
              title="点击复制 IP"
              onClick={() => void copy()}
            >
              {copied ? '已复制' : data.query}
            </button>
          ) : (
            <p className="mt-3 text-lg font-medium text-foreground">输入 IP 查询归属地</p>
          )}
          <p className="mt-1 text-[12px] text-muted-foreground">
            {data ? (country ? `(${country}) ${data.city ?? ''}` : '') : '支持 IPv4，结果来自 ip-api.com。'}
          </p>
          <div className="mx-auto mt-5 w-full max-w-sm space-y-1 text-center text-[11.5px] leading-relaxed text-muted-foreground">
            <p>
              经度: {data?.lon || '未知'} 纬度: {data?.lat || '未知'}
            </p>
            <p>时区: {data?.timezone || '未知'}</p>
            <p>运营商: {data?.isp || '未知'}</p>
            <p>组织: {data?.org || '未知'}</p>
            <p>邮编: {data?.zip || '未知'}</p>
            <p>地区: {data?.regionName || '未知'}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
