import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EyeCareStrengthBar } from '@/components/focus/EyeCareStrengthBar'
import { patchEyeCare, useEyeCare } from '@/lib/eye-care'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

/** 当天第几分钟 → HH:MM */
export function formatMinute(value: number): string {
  const h = Math.floor(value / 60) % 24
  const m = value % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 时段文案：跨午夜时标出「次日」 */
export function rangeText(start: number, end: number): string {
  return start <= end
    ? `${formatMinute(start)} - ${formatMinute(end)}`
    : `${formatMinute(start)} - 次日 ${formatMinute(end)}`
}

const MODE_OPTIONS: { value: 'always' | 'scheduled'; label: string }[] = [
  { value: 'always', label: '持续开启' },
  { value: 'scheduled', label: '定时开启' },
]

export function EyeCareSettings() {
  const enabled = useEyeCare((value) => value.enabled)
  const mode = useEyeCare((value) => value.mode)
  const startMinute = useEyeCare((value) => value.start_minute)
  const endMinute = useEyeCare((value) => value.end_minute)
  const [rangeOpen, setRangeOpen] = useState(false)

  const scheduled = mode === 'scheduled'

  return (
    <div className="flex max-w-2xl flex-col gap-7 px-6 py-7">
      <section className="flex flex-col gap-4">
        <h2 className="text-[13px] font-semibold text-foreground">护眼模式</h2>

        <div className="flex items-center gap-4">
          <Label className="w-32 shrink-0">开启护眼模式</Label>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => {
              void patchEyeCare({ enabled: checked }).catch(() => {})
            }}
          />
          <span className="text-[11.5px] text-muted-foreground">轻微暖色覆盖，降低屏幕刺眼感</span>
        </div>

        <div className="flex items-center gap-4">
          <Label className="w-32 shrink-0">强度</Label>
          <EyeCareStrengthBar />
          <span className="text-[11.5px] text-muted-foreground">越靠右越浓</span>
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-border/50 pt-6">
        <h2 className="text-[13px] font-semibold text-foreground">生效时间</h2>

        <div className="flex items-center gap-4">
          <Label className="w-32 shrink-0">模式</Label>
          <SlidingSegmented
            options={MODE_OPTIONS}
            value={mode}
            onValueChange={(value) => {
              void patchEyeCare({ mode: value }).catch(() => {})
            }}
            size="md"
            ariaLabel="护眼生效模式"
          />
        </div>

        <div className="flex items-center gap-4">
          <Label className="w-32 shrink-0">时间段</Label>
          <Button
            variant="outline"
            className="min-w-[164px] justify-start font-normal tabular-nums"
            disabled={!scheduled}
            onClick={() => setRangeOpen(true)}
          >
            {rangeText(startMinute, endMinute)}
          </Button>
          <span className="text-[11.5px] text-muted-foreground">
            {scheduled ? '只在这段时间内生效' : '切到「定时开启」后可设置'}
          </span>
        </div>
      </section>

      <EyeCareRangeDialog
        open={rangeOpen}
        start={startMinute}
        end={endMinute}
        onClose={() => setRangeOpen(false)}
        onConfirm={(nextStart, nextEnd) => {
          void patchEyeCare({ start_minute: nextStart, end_minute: nextEnd }).catch(() => {})
          setRangeOpen(false)
        }}
      />
    </div>
  )
}

function EyeCareRangeDialog({
  open,
  start,
  end,
  onClose,
  onConfirm,
}: {
  open: boolean
  start: number
  end: number
  onClose: () => void
  onConfirm: (start: number, end: number) => void
}) {
  const [startHour, setStartHour] = useState(Math.floor(start / 60))
  const [startMin, setStartMin] = useState(start % 60)
  const [endHour, setEndHour] = useState(Math.floor(end / 60))
  const [endMin, setEndMin] = useState(end % 60)

  // 每次打开都以当前生效值为起点，取消后重开不会残留上次的草稿
  const onOpenChange = (next: boolean) => {
    if (next) {
      setStartHour(Math.floor(start / 60))
      setStartMin(start % 60)
      setEndHour(Math.floor(end / 60))
      setEndMin(end % 60)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : onClose())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>设置生效时间段</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <TimeRow
            label="开始时间"
            hour={startHour}
            minute={startMin}
            onHour={setStartHour}
            onMinute={setStartMin}
          />
          <TimeRow
            label="结束时间"
            hour={endHour}
            minute={endMin}
            onHour={setEndHour}
            onMinute={setEndMin}
          />
          <p className="rounded-lg bg-accent/50 py-2 text-center text-[12.5px] font-medium tabular-nums text-accent-foreground">
            {rangeText(startHour * 60 + startMin, endHour * 60 + endMin)}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onConfirm(startHour * 60 + startMin, endHour * 60 + endMin)}>
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TimeRow({
  label,
  hour,
  minute,
  onHour,
  onMinute,
}: {
  label: string
  hour: number
  minute: number
  onHour: (value: number) => void
  onMinute: (value: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="shrink-0">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Select value={String(hour)} onValueChange={(value) => onHour(Number(value))}>
          <SelectTrigger className="w-[76px] tabular-nums">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {String(h).padStart(2, '0')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">:</span>
        <Select value={String(minute)} onValueChange={(value) => onMinute(Number(value))}>
          <SelectTrigger className="w-[76px] tabular-nums">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {String(m).padStart(2, '0')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
