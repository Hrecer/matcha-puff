import { useEffect, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { ColorPicker, type ColorFormat } from './shared/ColorPicker'
import { FormWorkbench } from './shared/FormWorkbench'

interface RandomStringData {
  items: string[]
  charsetSize: number
  charset: string
}

export function RandomStringTool() {
  return (
    <FormWorkbench<RandomStringData>
      toolId="random-string"
      hint="按字符集批量生成随机字符串；勾掉不需要的字符集即可缩小范围。"
      formTitle="生成规则"
      runLabel="生成"
      emptyTitle="等待生成"
      emptyDescription="选择字符集与长度后生成。"
      fields={[
        { key: 'length', label: '长度', type: 'number', defaultValue: '16', min: '1', max: '256', step: '1' },
        { key: 'count', label: '数量', type: 'number', defaultValue: '5', min: '1', max: '100', step: '1' },
        { key: 'uppercase', label: '大写字母 A-Z', type: 'switch', defaultValue: 'true' },
        { key: 'lowercase', label: '小写字母 a-z', type: 'switch', defaultValue: 'true' },
        { key: 'digits', label: '数字 0-9', type: 'switch', defaultValue: 'true' },
        { key: 'allowDuplicates', label: '允许重复结果', type: 'switch', defaultValue: 'false' },
        {
          key: 'symbols',
          label: '附加符号（可留空）',
          type: 'text',
          placeholder: '例如 !@#$%^&*',
          defaultValue: '!@#$%^&*',
          wide: true,
        },
      ]}
      toText={(data) => data.items.join('\n')}
      renderResult={(data) => (
        <div className="flex h-full flex-col">
          <p className="text-[11px] text-muted-foreground">
            共 {data.items.length} 条 · 字符集 {data.charsetSize} 个字符
          </p>
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto pr-0.5 scroll-thin">
            {data.items.map((item) => (
              <button
                key={item}
                type="button"
                onClick={async () => {
                  try {
                    await copyText(item)
                    toast('已复制')
                  } catch {
                    toast('复制失败，请手动选择内容', 'error')
                  }
                }}
                className="group flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-left transition-colors hover:border-primary/40"
              >
                <span className="min-w-0 flex-1 break-all font-mono text-[13px] text-foreground">
                  {item}
                </span>
                <Copy className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
              </button>
            ))}
          </div>
        </div>
      )}
    />
  )
}

const SCREEN_CHECK_PALETTE = [
  { name: '蓝', value: 'blue', hex: '#0000ff' },
  { name: '白', value: 'white', hex: '#ffffff' },
  { name: '黑', value: 'black', hex: '#000000' },
  { name: '红', value: 'red', hex: '#ff0000' },
  { name: '绿', value: 'green', hex: '#008000' },
  { name: '黄', value: 'yellow', hex: '#ffff00' },
  { name: '亮绿', value: '#0F0', hex: '#00ff00' },
  { name: '亮黄', value: '#FF0', hex: '#ffff00' },
  { name: '洋红', value: '#F0F', hex: '#ff00ff' },
  { name: '青', value: '#0FF', hex: '#00ffff' },
]

/** 屏幕坏点检测：右侧选色，进入全屏后纯色覆盖，ESC 退出 */
export function ScreenCheckTool() {
  const [color, setColor] = useState('#0000ff')
  const [format, setFormat] = useState<ColorFormat>('hex')
  const [testing, setTesting] = useState(false)
  const resolution = useMemo(
    () => `${window.screen.width} x ${window.screen.height}`,
    [],
  )

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setTesting(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    if (!testing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setTesting(false)
      if (document.fullscreenElement) void document.exitFullscreen()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [testing])

  const enter = () => {
    if (!document.documentElement.requestFullscreen) {
      toast('暂不支持全屏，请手动设置窗口全屏', 'error')
      return
    }
    setTesting(true)
    void document.documentElement.requestFullscreen().catch(() => {
      toast('无法进入全屏，纯色将只覆盖当前窗口', 'error')
    })
  }

  if (testing) {
    return <div className="fixed inset-0 z-[9999]" style={{ backgroundColor: color }} role="presentation" />
  }

  return (
    <main className="flex min-h-0 flex-1" style={{ backgroundColor: '#7f8fa6' }}>
      <section className="flex min-w-0 flex-1 flex-col items-center justify-center px-6 text-center text-white">
        <h2 className="text-2xl font-semibold">屏幕坏点测试</h2>
        <span className="mt-3 rounded-full bg-[#87d068] px-3 py-0.5 text-xs leading-5 text-white">
          分辨率：{resolution}
        </span>
        <p className="mt-4 text-xs leading-5 text-white/90">点击右侧选择要测试的颜色，按 ESC 退出测试。</p>
        <Button className="mt-6" onClick={enter}>
          进入全屏查看
        </Button>
      </section>

      <aside className="flex w-[272px] shrink-0 flex-col gap-2.5 overflow-y-auto border-l border-white/25 bg-white p-3 text-zinc-900">
        <div className="grid grid-cols-5 gap-1.5">
          {SCREEN_CHECK_PALETTE.map((item) => (
            <button
              key={item.value}
              type="button"
              title={`${item.name} ${item.hex.toUpperCase()}`}
              aria-label={`${item.name} ${item.hex.toUpperCase()}`}
              onClick={() => setColor(item.hex)}
              className={cn(
                'aspect-square rounded border border-black/15 transition-transform hover:scale-105',
                color === item.hex && 'ring-2 ring-[#0984e3] ring-offset-1',
              )}
              style={{ backgroundColor: item.hex }}
            />
          ))}
        </div>
        <ColorPicker
          color={color}
          onChange={setColor}
          format={format}
          onFormatChange={setFormat}
          minimal
        />
      </aside>
    </main>
  )
}
