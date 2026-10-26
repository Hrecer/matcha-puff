/**
 * 数字控件：自绘步进器。
 *
 * 不用 `<input type="number">`：原生上下箭头是 WebView2 画的白色小块，样式改不了，
 * 与全站观感不一致。这里中间保留可打字的输入框（宽范围参数直接输入更顺手），
 * 两侧是抹茶绿的加减按钮；支持小数与「可留空」。
 *
 * `showSteppers={false}` 只给紧凑场合（例如取色器的 R/G/B 三兄弟）用：
 * 保留统一样式的输入框，但不塞加减按钮，免得一行三列被按钮挤爆。
 */
import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from 'cn'

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision = 0,
  placeholder = '',
  disabled = false,
  allowEmpty = false,
  emptyLabel,
  emptyValue = 0,
  showSteppers = true,
  className,
  id,
  ariaLabel,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  /** 小数位数；>0 时允许输入小数点 */
  precision?: number
  placeholder?: string
  disabled?: boolean
  /** 允许清空成「未填」；清空时回调 emptyValue */
  allowEmpty?: boolean
  /**
   * 值为「未填」（＝ emptyValue）时不显示数字，而是显示这段文字。
   * 给了它才启用这套渲染 —— 例如番茄数：0 就是「不定」，不该显示成 0。
   */
  emptyLabel?: string
  emptyValue?: number
  showSteppers?: boolean
  className?: string
  id?: string
  ariaLabel?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const format = (next: number) => (precision > 0 ? next.toFixed(precision) : String(next))

  const clamp = (next: number) => {
    let out = next
    if (min !== undefined) out = Math.max(min, out)
    if (max !== undefined) out = Math.min(max, out)
    return precision > 0 ? Number(out.toFixed(precision)) : Math.round(out)
  }

  const sanitize = (text: string) => {
    let out = ''
    let dot = false
    for (const char of text) {
      if (char >= '0' && char <= '9') out += char
      else if (precision > 0 && char === '.' && !dot) {
        out += char
        dot = true
      }
    }
    return out
  }

  const shift = (delta: number) => {
    setDraft(null)
    // 空值（NaN）时从下限起步，否则按 +/－ 会一直算不出结果、按钮看起来没反应
    const base = Number.isFinite(value) ? value : (min ?? emptyValue)
    onChange(clamp(base + delta))
  }

  const isEmpty = allowEmpty && emptyLabel !== undefined && value === emptyValue
  const shown = draft ?? (isEmpty ? '' : Number.isFinite(value) ? format(value) : '')

  return (
    <div
      className={cn(
        'flex h-9 items-center gap-0.5 rounded-md border border-input transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        showSteppers ? 'px-0.5' : 'px-2.5',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {showSteppers ? (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="减一个"
          className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          disabled={min !== undefined && Number.isFinite(value) && value <= min}
          onClick={() => shift(-step)}
        >
          <Minus className="size-3" aria-hidden />
        </Button>
      ) : null}
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={shown}
        placeholder={isEmpty ? emptyLabel : placeholder}
        onChange={(event) => {
          const text = sanitize(event.target.value)
          setDraft(text)
          if (text === '' || text === '.') {
            if (allowEmpty) onChange(emptyValue)
            return
          }
          const parsed = Number(text)
          if (Number.isFinite(parsed)) onChange(clamp(parsed))
        }}
        onBlur={() => setDraft(null)}
        className="min-w-0 flex-1 bg-transparent text-center font-mono text-[13px] tabular-nums text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground"
      />
      {showSteppers ? (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="加一个"
          className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          disabled={max !== undefined && Number.isFinite(value) && value >= max}
          onClick={() => shift(step)}
        >
          <Plus className="size-3" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
