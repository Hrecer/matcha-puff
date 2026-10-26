import { useEffect, useState } from 'react'
import type { Habit, HabitCycle, TaskQuadrant } from '@matcha-puff/pomodoro-core'
import { HABIT_CYCLE_LABELS, HABIT_CYCLE_ORDER } from '@matcha-puff/pomodoro-core'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DescTextarea } from '@/components/ui/desc-textarea'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NumberField } from '@/components/ui/number-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ColorPicker } from '@/components/focus/ColorPicker'
import { QUADRANT_OPTIONS, normalizeQuadrant } from '@/components/focus/quadrants'
import { newHabit, saveHabit } from '@/lib/focus-data'

export function HabitFormDialog({
  habit,
  onOpenChange,
}: {
  habit: Habit | null
  onOpenChange: (open: boolean) => void
}) {
  const open = habit !== null
  const editing = Boolean(habit && habit.name)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [quadrant, setQuadrant] = useState<TaskQuadrant>(2)
  const [cycle, setCycle] = useState<HabitCycle>('daily')
  const [time, setTime] = useState(25)
  const [color, setColor] = useState<string | undefined>(undefined)
  const [anchorMonth, setAnchorMonth] = useState(() => new Date().getMonth() + 1)
  const [anchorDay, setAnchorDay] = useState(() => new Date().getDate())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!habit) return
    setName(habit.name)
    setDesc(habit.desc)
    setQuadrant(normalizeQuadrant(habit.quadrant))
    setCycle(habit.cycle)
    setTime(habit.time)
    setColor(habit.color)
    setAnchorMonth(habit.anchorMonth ?? new Date().getMonth() + 1)
    setAnchorDay(habit.anchorDay ?? new Date().getDate())
    setError(null)
  }, [habit])

  const submit = async () => {
    if (!habit) return
    if (!name.trim()) return setError('请填写习惯名称')
    if (!desc.trim()) return setError('请填写习惯简介')
    if (!Number.isFinite(time) || time < 1) return setError('专注时长至少 1 分钟')
    if (cycle === 'yearly') {
      const maxDay = new Date(2000, anchorMonth, 0).getDate()
      if (anchorMonth < 1 || anchorMonth > 12 || anchorDay < 1 || anchorDay > maxDay) {
        return setError('请选择有效的每年日期')
      }
    }

    const base = editing ? habit : newHabit(name, desc, cycle, time)
    await saveHabit({
      ...base,
      name: name.trim(),
      desc: desc.trim(),
      quadrant,
      cycle,
      time: Math.round(time),
      color,
      anchorMonth: cycle === 'yearly' ? anchorMonth : undefined,
      anchorDay: cycle === 'yearly' ? anchorDay : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{editing ? '编辑习惯' : '新建习惯'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-1 py-1">
          <Field
            label="习惯名称"
            required
            htmlFor="focus-habit-name"
            action={<ColorPicker value={color} onChange={setColor} title="选择习惯颜色" />}
          >
            <Input
              id="focus-habit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：读书 30 分钟"
            />
          </Field>

          <Field label="简介" required htmlFor="focus-habit-desc" error={error}>
            <DescTextarea
              id="focus-habit-desc"
              value={desc}
              onChange={(event) => setDesc(event.target.value)}
              placeholder="为什么做这件事"
            />
          </Field>

          <Field label="四象限">
            <Select
              value={String(quadrant)}
              onValueChange={(value) => setQuadrant(Number(value) as TaskQuadrant)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start" sideOffset={4}>
                {QUADRANT_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-[minmax(0,1fr)_124px] gap-3">
            <Field label="周期">
              <Select value={cycle} onValueChange={(value) => setCycle(value as HabitCycle)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start" sideOffset={4}>
                  {HABIT_CYCLE_ORDER.map((item) => (
                    <SelectItem key={item} value={item}>
                      {HABIT_CYCLE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="单次时长" htmlFor="focus-habit-time">
              <div className="flex items-center gap-1.5">
                <NumberField
                  id="focus-habit-time"
                  className="min-w-0 flex-1"
                  value={time}
                  onChange={setTime}
                  min={1}
                  max={200}
                  placeholder="1"
                />
                <span className="shrink-0 text-[12px] text-muted-foreground">分钟</span>
              </div>
            </Field>
          </div>

          {cycle === 'yearly' ? (
            <Field label="每年日期" htmlFor="focus-habit-anchor-month">
              <div className="flex items-center gap-1.5">
                <NumberField
                  id="focus-habit-anchor-month"
                  className="w-[76px]"
                  value={anchorMonth}
                  onChange={(next) => {
                    setAnchorMonth(next)
                    setAnchorDay((current) => Math.min(current, new Date(2000, next, 0).getDate()))
                  }}
                  min={1}
                  max={12}
                />
                <span className="shrink-0 text-[12px] text-muted-foreground">月</span>
                <NumberField
                  className="w-[76px]"
                  value={anchorDay}
                  onChange={setAnchorDay}
                  min={1}
                  max={new Date(2000, anchorMonth, 0).getDate()}
                />
                <span className="shrink-0 text-[12px] text-muted-foreground">日</span>
              </div>
            </Field>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void submit()}>{editing ? '保存' : '创建'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
