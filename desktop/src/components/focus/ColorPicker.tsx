import { useState } from 'react'
import { Check, Plus, RotateCcw } from 'lucide-react'
import { cn } from 'cn'
import {
  TASK_COLOR_OPTIONS,
  UNSET_TASK_COLOR,
  displayTaskColor,
} from '@/components/focus/calendar-utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

function parseHexColor(input: string): string | null {
  const raw = input.trim().replace(/^#/, '')
  const expanded = /^[0-9a-fA-F]{3}$/.test(raw)
    ? raw.split('').map((char) => char + char).join('')
    : raw
  return /^[0-9a-fA-F]{6}$/.test(expanded) ? `#${expanded.toUpperCase()}` : null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`
}

/** 任务和习惯共用的调色入口：圆点 + 预设色 + 自定义 HEX/RGB */
export function ColorPicker({
  value,
  onChange,
  label = '颜色',
  title = '选择颜色',
  disabled = false,
}: {
  value?: string
  onChange: (value: string | undefined) => void
  label?: string
  title?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customHex, setCustomHex] = useState('#5F7F4F')

  const isCustomColor = Boolean(
    value && !TASK_COLOR_OPTIONS.some((option) => option.value === value),
  )
  const parsedCustom = parseHexColor(customHex)
  const customRgb = hexToRgb(parsedCustom ?? '#5F7F4F')

  const openCustom = () => {
    setCustomHex(value ?? '#5F7F4F')
    setCustomOpen(true)
  }

  const applyCustom = () => {
    const next = parseHexColor(customHex)
    if (!next) return
    onChange(next)
    setCustomOpen(false)
    setOpen(false)
  }

  const setChannel = (channel: 'r' | 'g' | 'b', raw: string) => {
    const channelValue = Math.max(0, Math.min(255, Number(raw) || 0))
    setCustomHex(rgbToHex({ ...customRgb, [channel]: channelValue }))
  }

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        title={title}
        aria-label={title}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span
          className="size-3 rounded-full border border-foreground/15"
          style={{ background: displayTaskColor(value) }}
          aria-hidden
        />
        {label}
      </button>

      {/* 叠在主表单上的两层窗必须保持非模态，模态子窗会把主窗置为 pointer-events:none */}
      <Dialog
        open={open}
        modal={false}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setCustomOpen(false)
        }}
      >
        <DialogContent
          className="max-w-[400px]"
          onFocusOutside={(event) => event.preventDefault()}
        >
          <div className="flex items-center gap-1.5">
            <DialogTitle className="text-[15px]">选择颜色</DialogTitle>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => onChange(undefined)}
              disabled={!value}
              aria-label="重置颜色"
              title="重置颜色"
            >
              <RotateCcw className="size-3.5" aria-hidden />
            </Button>
          </div>
          <div className="flex flex-col gap-4 px-1 py-1">
            <div className="grid grid-cols-5 place-items-center gap-3">
              {TASK_COLOR_OPTIONS.map((option) => {
                const selected = value === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.name}
                    aria-label={option.name}
                    aria-pressed={selected}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full border transition-transform',
                      selected
                        ? 'scale-110 border-foreground/30 ring-2 ring-primary/45'
                        : 'border-foreground/10 hover:scale-105',
                    )}
                    style={{ background: option.value }}
                  >
                    {selected ? <Check className="size-4 text-white drop-shadow" aria-hidden /> : null}
                  </button>
                )
              })}
              <button
                type="button"
                title={isCustomColor ? '编辑自定义颜色' : '自定义颜色'}
                aria-label={isCustomColor ? '编辑自定义颜色' : '自定义颜色'}
                onClick={openCustom}
                className={cn(
                  'flex size-10 items-center justify-center rounded-full border transition-transform',
                  isCustomColor
                    ? 'border-foreground/30 ring-2 ring-primary/45'
                    : 'border-foreground/10 hover:scale-105',
                )}
                style={
                  isCustomColor
                    ? { background: value }
                    : {
                        background:
                          'conic-gradient(from 0deg, #b65f5f, #b69a5f, #7fa85f, #5f9fb6, #6f5fb6, #b65f8f, #b65f5f)',
                      }
                }
              >
                {isCustomColor ? (
                  <Check className="size-4 text-white drop-shadow" aria-hidden />
                ) : (
                  <Plus className="size-4 text-white drop-shadow" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={customOpen} modal={false} onOpenChange={setCustomOpen}>
        <DialogContent
          className="max-w-[400px]"
          onFocusOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-[15px]">自定义颜色</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-1 py-1">
            <div className="flex items-center gap-3">
              <span
                className="h-14 flex-1 rounded-md border border-foreground/10"
                style={{ background: parsedCustom ?? UNSET_TASK_COLOR }}
                aria-hidden
              />
              <label className="flex w-[86px] shrink-0 flex-col items-center gap-1 text-[9.5px] text-muted-foreground">
                <input
                  type="color"
                  value={parsedCustom ?? '#5F7F4F'}
                  onChange={(event) => setCustomHex(event.target.value.toUpperCase())}
                  className="h-8 w-full cursor-pointer rounded-md border border-foreground/15 bg-transparent p-0.5"
                  aria-label="系统取色"
                />
                系统取色
              </label>
            </div>
            <Field
              label="十六进制"
              error={
                customHex.trim() && !parsedCustom
                  ? '请输入有效的十六进制颜色，例如 #5F7F4F'
                  : null
              }
            >
              <Input
                value={customHex}
                onChange={(event) => setCustomHex(event.target.value)}
                placeholder="#5F7F4F"
                maxLength={7}
                className="font-mono uppercase"
              />
            </Field>
            <Field label="RGB">
              <div className="grid grid-cols-3 gap-2">
                {(['r', 'g', 'b'] as const).map((channel) => (
                  <label key={channel} className="flex flex-col gap-1">
                    <span className="text-[9.5px] uppercase text-muted-foreground">{channel}</span>
                    <Input
                      type="number"
                      min={0}
                      max={255}
                      value={customRgb[channel]}
                      onChange={(event) => setChannel(channel, event.target.value)}
                      className="h-8 text-center font-mono tabular-nums"
                    />
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>
              取消
            </Button>
            <Button onClick={applyCustom} disabled={!parsedCustom}>
              应用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
