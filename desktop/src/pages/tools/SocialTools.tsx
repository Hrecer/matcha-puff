import { useState } from 'react'
import { Check, Copy, Search, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { runTool } from '@/lib/tool-core'

interface WeiboResult {
  uid: string
  homepage: string
  code: string
  note: string
}

export function WeiboUserTool() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<WeiboResult | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<'uid' | 'homepage' | null>(null)

  const query = async () => {
    const value = input.trim()
    if (!value) {
      toast('请输入微博图片地址', 'error')
      return
    }
    setError('')
    const response = await runTool<WeiboResult>('weibo-user', { url: value })
    if (!response.ok) {
      setResult(null)
      setError(response.error.message)
      return
    }
    setResult(response.data)
  }

  const copy = async (key: 'uid' | 'homepage', value: string) => {
    try {
      await copyText(value)
      setCopied(key)
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <section className="glass shrink-0 rounded-panel p-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] text-muted-foreground">微博图片地址</span>
          <Input
            value={input}
            spellCheck={false}
            placeholder="请输入微博图片地址"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void query()
              }
            }}
            className="h-9 flex-1 font-mono text-[12px]"
          />
          <Button size="icon" aria-label="查询用户" title="查询用户" onClick={() => void query()}>
            <Search />
          </Button>
        </div>
        {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}
      </section>

      <section className="glass flex min-h-0 flex-1 items-center rounded-panel p-4">
        <div className="flex w-full items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Share2 className="size-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-1.5 text-[11.5px]">
              <span className="shrink-0 text-muted-foreground">用户ID：</span>
              <button
                type="button"
                className="truncate font-mono text-[13px] font-medium text-foreground hover:text-primary"
                title={result ? '点击复制用户ID' : ''}
                onClick={() => result && void copy('uid', result.uid)}
              >
                {copied === 'uid' ? '已复制' : (result?.uid ?? '获取成功后将在此处显示')}
              </button>
              {result ? (
                copied === 'uid' ? (
                  <Check className="size-3 shrink-0 text-success" />
                ) : (
                  <Copy className="size-3 shrink-0 text-muted-foreground" />
                )
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 text-[11.5px]">
              <span className="shrink-0 text-muted-foreground">用户主页：</span>
              <button
                type="button"
                className="truncate text-left text-[13px] font-medium text-primary hover:underline"
                title={result ? '点击复制用户主页' : ''}
                onClick={() => result && void copy('homepage', result.homepage)}
              >
                {copied === 'homepage' ? '已复制' : (result?.homepage ?? '获取成功后将在此处显示')}
              </button>
              {result ? (
                copied === 'homepage' ? (
                  <Check className="size-3 shrink-0 text-success" />
                ) : (
                  <Copy className="size-3 shrink-0 text-muted-foreground" />
                )
              ) : null}
            </div>
            <p className="text-[10.5px] text-muted-foreground">
              {result ? `文件名代码：${result.code} · 全程离线解析` : '仅从图片文件名解析，不访问微博。'}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
