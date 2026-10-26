import { FormWorkbench } from './shared/FormWorkbench'
import { cn } from '@/lib/utils'

interface ZeroWidthOutput {
  mode: 'encode' | 'decode'
  payload: string
  output: string
  plain: string
  bits: number
  visible: number
  zeroWidthCount: number
}

/** 零宽字符隐写 */
export function ZeroWidthCodecTool() {
  return (
    <FormWorkbench<ZeroWidthOutput>
      toolId="zero-width-codec"
      hint="把文字藏进零宽字符：粘贴出去看着是普通句子，解回来才是真正的内容。"
      runLabel="执行"
      example={{ text: '今晚八点老地方', mode: 'encode', carrier: '好的，收到。' }}
      fields={[
        { key: 'text', label: '文本 / 含密文的文本', type: 'textarea', placeholder: '今晚八点老地方', rows: 4, wide: true },
        {
          key: 'mode',
          label: '模式',
          type: 'select',
          defaultValue: 'encode',
          options: [
            { value: 'encode', label: '隐藏（编码）' },
            { value: 'decode', label: '取出（解码）' },
          ],
        },
        { key: 'carrier', label: '载体文字', type: 'text', placeholder: '好的，收到。', optional: true, hint: '填了就把密文夹在这句话中间' },
      ]}
      toText={(data) => (data.mode === 'encode' ? data.output : data.plain)}
      renderResult={(data) => (
        <div className="flex h-full flex-col gap-2">
          <p className="flex shrink-0 items-center gap-2 rounded-md bg-primary/[0.08] px-3 py-2 text-[11.5px] text-foreground/80">
            <span className="text-muted-foreground">
              {data.mode === 'encode' ? '已隐藏' : '已还原'}
            </span>
            <span className="ml-auto font-mono">
              {data.zeroWidthCount} 个零宽字符 · {data.bits} 位
            </span>
          </p>
          <pre
            className={cn(
              'min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border/50',
              'bg-background/40 p-2.5 font-mono text-[12px] leading-6 text-foreground scroll-thin',
            )}
          >
            {data.mode === 'encode' ? data.output || '（空）' : data.plain || '（空）'}
          </pre>
          {data.mode === 'decode' && data.visible > 0 ? (
            <p className="shrink-0 text-[10.5px] leading-4 text-muted-foreground">
              输入里还有 {data.visible} 个可见字符，已自动跳过。
            </p>
          ) : null}
        </div>
      )}
    />
  )
}

