import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SlidingSegmented } from '@/components/ui/sliding'
import { writeSessionState } from '@/lib/session-state'

type WorkbenchTab = 'search' | 'recent' | 'favorites'

const TABS: { value: WorkbenchTab; label: string }[] = [
  { value: 'search', label: '搜索' },
  { value: 'recent', label: '最近' },
  { value: 'favorites', label: '收藏' },
]

const TAB_BY_PATH: Record<string, WorkbenchTab> = {
  '/index': 'search',
  '/recent': 'recent',
  '/favorites': 'favorites',
}

const PATH_BY_TAB: Record<WorkbenchTab, string> = {
  search: '/index',
  recent: '/recent',
  favorites: '/favorites',
}

/** 会话内记住上次停在工作台的哪个分区；侧栏点「工作台」时回到这里，重启回搜索 */
export const WORKBENCH_PATH_KEY = 'workbench/path'

export function WorkbenchSection({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const tab = TAB_BY_PATH[pathname] ?? 'search'

  useEffect(() => {
    writeSessionState(WORKBENCH_PATH_KEY, pathname)
  }, [pathname])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-7">
        <h1 className="truncate pr-[2px] text-[19px] font-bold tracking-tight text-foreground">工作台</h1>
        <SlidingSegmented
          options={TABS}
          value={tab}
          onValueChange={(next) => nav(PATH_BY_TAB[next])}
          ariaLabel="工作台分区"
          className="shrink-0"
        />
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
