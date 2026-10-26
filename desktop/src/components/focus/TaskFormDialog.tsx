import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { SubtaskDraft, TaskDraft, TaskQuadrant } from '@matcha-puff/pomodoro-core'
import { ColorPicker } from '@/components/focus/ColorPicker'
import { QUADRANT_OPTIONS, normalizeQuadrant } from '@/components/focus/quadrants'
import { Button } from '@/components/ui/button'
import { CalendarPanel, DateRangeField } from '@/components/ui/date-field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NumberField } from '@/components/ui/number-field'
import { DescTextarea } from '@/components/ui/desc-textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { newSubtask, newTopTask, saveSubtask, saveTopTask } from '@/lib/focus-data'

export type TaskFormDraft = {
  kind: 'top' | 'subtask'
  /** 编辑时的原始记录；新建时为 null */
  initial: TaskDraft | SubtaskDraft | null
  futureId?: string
  /** 已有子任务时，番茄总数由后代汇总，它自己的数字没有意义 */
  hasSubtasks?: boolean
}

export function TaskFormDialog({
  draft,
  onOpenChange,
  onSaved,
}: {
  draft: TaskFormDraft | null
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const open = draft !== null
  const editing = Boolean(draft?.initial)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  /** 0 = 不定（没设计划）；不预置默认值，避免"凭空冒出来的 3 个番茄" */
  const [total, setTotal] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [color, setColor] = useState<string | undefined>(undefined)
  const [quadrant, setQuadrant] = useState<TaskQuadrant>(2)
  /** 月历是否展开：由弹窗自己管，好让它横跨整行铺开 */
  const [calOpen, setCalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!draft) return
    const initial = draft.initial
    setTitle(initial?.title ?? '')
    setDesc(initial?.desc ?? '')
    setTotal(initial?.pomodoroTotal ?? 0)
    setStart(initial?.startDate ?? 0)
    setEnd(initial?.endDate ?? 0)
    setColor(initial?.color)
    setQuadrant(normalizeQuadrant(initial?.quadrant))
    setError(null)
    setCalOpen(false)
  }, [draft])

  const isSubtask = draft?.kind === 'subtask'
  // 有子任务的任务（容器）：时间按子任务汇总、番茄数是子任务合计，都不是它自己填的。
  // 所以这两栏固定成「不定」且不给改 —— 等子任务全被挪走、它变回叶子才能重新填。
  const locked = Boolean(draft?.hasSubtasks)

  const dateInvalid = start > 0 && end > 0 && end < start
  const canSubmit = title.trim().length > 0 && !dateInvalid

  const submit = async () => {
    if (!canSubmit) return
    if (dateInvalid) return setError('到期日期不能早于开始日期')

    try {
      if (isSubtask) {
        const futureId = draft?.futureId ?? (draft?.initial as SubtaskDraft | null)?.futureId
        if (!futureId) return setError('缺少所属任务')
        const base =
          (draft?.initial as SubtaskDraft | null) ?? newSubtask(futureId, title, desc, total, start, end)
        await saveSubtask({
          ...base,
          title: title.trim(),
          desc: desc.trim(),
          startDate: locked ? 0 : start,
          endDate: locked ? 0 : end,
          pomodoroTotal: locked ? 0 : total,
          quadrant,
          color: undefined,
        })
      } else {
        const base = (draft?.initial as TaskDraft | null) ?? newTopTask(title, desc, total, start, end)
        await saveTopTask({
          ...base,
          title: title.trim(),
          desc: desc.trim(),
          startDate: locked ? 0 : start,
          endDate: locked ? 0 : end,
          pomodoroTotal: locked ? 0 : total,
          quadrant,
          color: color || undefined,
        })
      }
    } catch {
      setError('保存失败，请重试')
      return
    }

    onOpenChange(false)
    onSaved?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[520px] sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{editing ? '编辑任务' : '新建任务'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-1 py-1">
          <Field
            label="任务名称"
            htmlFor="focus-task-title"
            action={
              !isSubtask ? (
                <ColorPicker value={color} onChange={setColor} title="选择任务颜色" />
              ) : undefined
            }
          >
            <Input
              id="focus-task-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setError(null)
              }}
              placeholder="这一步要做什么"
            />
          </Field>

          <Field label="简介" htmlFor="focus-task-desc">
            <DescTextarea
              id="focus-task-desc"
              value={desc}
              onChange={(event) => setDesc(event.target.value)}
              placeholder="一句话说明目标（可留空）"
            />
          </Field>

          {locked ? null : (
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
          )}

          {/* 时间是一个区间控件，展开时一屏铺两个月。
              模态弹窗里不能用浮层（会被 Radix 的外部交互拦截吃掉），所以内联展开；
              月历当整行的子项铺开 —— 缩在左边那一栏的话，右边（番茄数底下）
              就是一整片空白，两个月也被挤得很窄。 */}
          <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-3">
            <Field label="时间">
              <DateRangeField
                inline
                withPanel={false}
                open={calOpen}
                onOpenChange={setCalOpen}
                disabled={locked}
                value={locked ? { start: 0, end: 0 } : { start, end }}
                onChange={(next) => {
                  setStart(next.start)
                  setEnd(next.end)
                  setError(null)
                }}
              />
            </Field>
            <Field
              label="番茄数"
              action={
                locked ? null : (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    aria-label="重置为不定"
                    onClick={() => setTotal(0)}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                  </Button>
                )
              }
            >
              <NumberField
                value={locked ? 0 : total}
                onChange={setTotal}
                min={0}
                max={99}
                disabled={locked}
                allowEmpty
                emptyLabel="不定"
              />
            </Field>
            {calOpen ? (
              <div className="col-span-full">
                <CalendarPanel
                  mode="range"
                  months={2}
                  range={{ start, end }}
                  onPickRange={(next) => {
                    setStart(next.start)
                    setEnd(next.end)
                    setError(null)
                  }}
                />
              </div>
            ) : null}
          </div>

          {locked ? (
            <p className="text-[10px] leading-4 text-muted-foreground/70">
              容器任务的时间和番茄数由子任务汇总，四象限请在叶子任务上设置。
            </p>
          ) : null}

          {error ? (
            <p className="text-xs leading-relaxed text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {editing ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

    </>
  )
}
