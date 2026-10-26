import { useState, type ReactNode } from 'react'
import { SlidingSegmented } from '@/components/ui/sliding'
import { useSessionState } from '@/lib/session-state'
import { cn } from '@/lib/utils'
import { CalendarTool } from '@/pages/tools/CalendarTool'
import { ClockTool, TimeDiffTool } from '@/pages/tools/DateTools'
import { RestOfLifeTool } from '@/pages/tools/LifeExtraTools'
import { StopwatchTool, TimerTool } from '@/pages/tools/LifeTimeTools'

type TimeTab =
  | 'timer'
  | 'stopwatch'
  | 'time-diff'
  | 'calendar'
  | 'clock'
  | 'life'

const TABS: { value: TimeTab; label: string }[] = [
  { value: 'calendar', label: '日历' },
  { value: 'clock', label: '时钟' },
  { value: 'timer', label: '计时器' },
  { value: 'stopwatch', label: '秒表' },
  { value: 'time-diff', label: '时间差' },
  { value: 'life', label: '人生' },
]

export function TimePage() {
  const [tabState, setTab] = useSessionState<TimeTab>('time/tab', 'calendar')
  const tab = TABS.some((item) => item.value === tabState) ? tabState : 'calendar'
  const [visited, setVisited] = useState<Set<TimeTab>>(() => new Set([tab]))

  const select = (next: TimeTab) => {
    setTab(next)
    setVisited((current) => (current.has(next) ? current : new Set(current).add(next)))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-7">
        <h1 className="truncate pr-[2px] text-[19px] font-bold tracking-tight text-foreground">
          时间
        </h1>
        <SlidingSegmented
          options={TABS}
          value={tab}
          onValueChange={select}
          ariaLabel="时间分区"
          className="shrink-0"
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <TimePanel active={tab === 'calendar'} show={visited.has('calendar')}>
          <CalendarTool />
        </TimePanel>
        <TimePanel active={tab === 'clock'} show={visited.has('clock')}>
          <ClockTool />
        </TimePanel>
        <TimePanel active={tab === 'timer'} show={visited.has('timer')}>
          <TimerTool />
        </TimePanel>
        <TimePanel active={tab === 'stopwatch'} show={visited.has('stopwatch')}>
          <StopwatchTool />
        </TimePanel>
        <TimePanel active={tab === 'time-diff'} show={visited.has('time-diff')}>
          <TimeDiffTool />
        </TimePanel>
        <TimePanel active={tab === 'life'} show={visited.has('life')}>
          <RestOfLifeTool />
        </TimePanel>
      </div>
    </div>
  )
}

/** 访问过的页签保持挂载：秒表、提醒切页后继续计时 */
function TimePanel({
  active,
  show,
  children,
}: {
  active: boolean
  show: boolean
  children: ReactNode
}) {
  if (!show) return null
  return <div className={cn('min-h-0 flex-1 flex-col', active ? 'flex' : 'hidden')}>{children}</div>
}
