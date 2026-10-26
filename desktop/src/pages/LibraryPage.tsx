import { History, Star } from 'lucide-react'
import { Empty } from '@/components/ui/empty'
import { RECENT_LIMIT, useLibrary } from '@/lib/library'
import { useUiPlugins } from '@/lib/use-ui-plugins'
import { LibraryCard } from '@/pages/LibraryCard'

export function LibraryPage({ kind }: { kind: 'favorites' | 'recent' }) {
  const { favorites, recent } = useLibrary()
  const pluginTools = useUiPlugins()
  const keys = kind === 'favorites' ? [...favorites].reverse() : recent.slice(0, RECENT_LIMIT)

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="flex flex-col gap-4 px-7 py-5">
        {kind === 'recent' ? (
          <p className="text-[13px] leading-4 text-muted-foreground">最多 {RECENT_LIMIT} 个 · 按最近打开排序</p>
        ) : null}
        {keys.length === 0 ? (
          <Empty
            icon={kind === 'favorites' ? Star : History}
            title={kind === 'favorites' ? '还没有收藏' : '还没有使用记录'}
            description={
              kind === 'favorites'
                ? '在工具卡片右上角点星标，就能把它收进这里。'
                : '点开任意工具后，它会出现在这里，方便下次直接找到。'
            }
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {keys.map((key) => (
              <LibraryCard key={key} libraryKey={key} pluginTools={pluginTools} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
