import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Play, Square } from 'lucide-react'
import { NOISE_ITEMS, NOTIFY_ITEMS } from '@matcha-puff/pomodoro-core'
import type { PomodoroConfig, RingSettings } from '@matcha-puff/pomodoro-core'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberField } from '@/components/ui/number-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { getPreviewOwner, previewSound, stopPreview, subscribePreview } from '@/lib/focus-audio'
import { saveConfig, saveRing } from '@/lib/focus-repo'
import { publishFocusSettings, useFocusStore } from '@/lib/focus-store'

const NUMBER_FIELDS: {
  key: 'pomodoroTime' | 'restTime' | 'longRestTime' | 'longRestInterval'
  label: string
  unit: string
  min: number
  max: number
}[] = [
  { key: 'pomodoroTime', label: '专注时长', unit: '分钟', min: 1, max: 180 },
  { key: 'restTime', label: '短休时长', unit: '分钟', min: 1, max: 60 },
  { key: 'longRestTime', label: '长休时长', unit: '分钟', min: 1, max: 180 },
  { key: 'longRestInterval', label: '长休间隔', unit: '个番茄', min: 2, max: 12 },
]

type BooleanConfigKey = 'autoRest' | 'autoNextPomodoro' | 'disableRest' | 'notify'

const SWITCH_FIELDS: { key: BooleanConfigKey; label: string; hint: string }[] = [
  { key: 'autoRest', label: '自动开始休息', hint: '专注结束后直接进入休息' },
  { key: 'autoNextPomodoro', label: '自动下一个', hint: '休息结束后继续同一任务' },
  { key: 'disableRest', label: '禁用休息', hint: '完成后直接进入下一段专注' },
  { key: 'notify', label: '完成后通知', hint: '到点发送 Windows 通知' },
]

export function FocusSettings() {
  const { config, ring, ready } = useFocusStore()
  const [draft, setDraft] = useState<PomodoroConfig>(config)
  const [sounds, setSounds] = useState<RingSettings>(ring)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 只让最后一次改动回写镜像，避免慢一点的旧保存把新选择顶回去 */
  const saveId = useRef(0)

  useEffect(() => {
    if (ready) setDraft(config)
  }, [ready, config])

  useEffect(() => {
    if (ready) setSounds(ring)
  }, [ready, ring])

  /**
   * 改完立刻落库：这一页没有「保存」这一步。
   * 数字框是逐字符触发的，用 250ms 防抖合并，免得敲一次 120 写三次盘。
   * 恢复默认设置的入口不在这里，在「常规设置」底下（那一个是全局的）。
   */
  const apply = (nextConfig: PomodoroConfig, nextRing: RingSettings) => {
    const id = ++saveId.current
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      Promise.all([saveConfig(nextConfig), saveRing(nextRing)])
        // 直接用刚保存的值更新镜像；再读一次盘会让快速切换时旧值回弹
        .then(() => {
          if (id === saveId.current) publishFocusSettings(nextConfig, nextRing)
        })
        .catch(() => toast('设置保存失败，请稍后重试', 'error'))
    }, 250)
  }

  const patchConfig = (patch: Partial<PomodoroConfig>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    apply(next, sounds)
  }

  const patchRing = (patch: Partial<RingSettings>) => {
    const next = { ...sounds, ...patch }
    setSounds(next)
    apply(draft, next)
  }

  return (
    <div className="flex max-w-2xl flex-col gap-7 px-6 py-7">
      <section className="flex flex-col gap-4">
        <h2 className="text-[13px] font-semibold text-foreground">时长与流转</h2>

        {NUMBER_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center gap-4">
            <Label className="w-32 shrink-0">{field.label}</Label>
            <div className="flex items-center gap-2">
              <NumberField
                className="w-28"
                value={draft[field.key] as number}
                onChange={(next) => patchConfig({ [field.key]: Math.round(next) })}
                min={field.min}
                max={field.max}
              />
              <span className="text-[12px] text-muted-foreground">{field.unit}</span>
            </div>
          </div>
        ))}

        <div className="my-1 border-t border-border/50" />

        {SWITCH_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center gap-4">
            <Label className="w-32 shrink-0">{field.label}</Label>
            <Switch
              checked={Boolean(draft[field.key])}
              onCheckedChange={(checked) => patchConfig({ [field.key]: checked })}
            />
            <span className="text-[11.5px] text-muted-foreground">{field.hint}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[13px] font-semibold text-foreground">声音</h2>

        <SoundRow
          label="完成提示音"
          previewId="notify"
          kind="notify"
          value={sounds.pomodoroNotify}
          items={NOTIFY_ITEMS}
          allowNone={false}
          onChange={(value) => patchRing({ pomodoroNotify: value })}
        />
        <SoundRow
          label="专注白噪音"
          previewId="white-noise"
          kind="noise"
          value={sounds.whiteNoise}
          items={NOISE_ITEMS}
          onChange={(value) => patchRing({ whiteNoise: value })}
        />
        <SoundRow
          label="休息白噪音"
          previewId="rest-noise"
          kind="noise"
          value={sounds.restNoise}
          items={NOISE_ITEMS}
          onChange={(value) => patchRing({ restNoise: value })}
        />
      </section>
    </div>
  )
}

function SoundRow({
  label,
  previewId,
  kind,
  value,
  items,
  onChange,
  allowNone = true,
}: {
  label: string
  previewId: string
  kind: 'notify' | 'noise'
  value: string
  items: readonly { title: string; name: string }[]
  onChange: (value: string) => void
  /** 是否提供「无」选项：完成提示音不允许关掉 */
  allowNone?: boolean
}) {
  const previewing = useSyncExternalStore(subscribePreview, getPreviewOwner) === previewId

  useEffect(
    () => () => {
      if (getPreviewOwner() === previewId) stopPreview()
    },
    [previewId],
  )

  const handleChange = (next: string) => {
    const wasPreviewing = getPreviewOwner() === previewId
    stopPreview()
    onChange(next)
    // 试听中换选项：直接把声音切到新的一项
    if (wasPreviewing && next !== '0') previewSound(kind, next, previewId)
  }

  return (
    <div className="flex items-center gap-4">
      <Label className="w-32 shrink-0">{label}</Label>
      <Select value={value || '0'} onValueChange={handleChange}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          sideOffset={4}
          viewportClassName="scroll-thin"
        >
          {allowNone ? <SelectItem value="0">无</SelectItem> : null}
          {items.map((item) => (
            <SelectItem key={item.name} value={item.name}>
              {item.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          previewing ? stopPreview() : previewSound(kind, value, previewId)
        }
        disabled={!value || value === '0'}
      >
        {previewing ? <Square className="size-3" aria-hidden /> : <Play className="size-3" aria-hidden />}
        {previewing ? '停止' : '试听'}
      </Button>
    </div>
  )
}
