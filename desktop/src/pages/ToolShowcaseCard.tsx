import type { LucideIcon } from 'lucide-react'
import { Star } from 'lucide-react'
import { cn } from 'cn'

export function ToolShowcaseCard({
  name,
  description,
  Icon,
  disabled = false,
  favorite,
  onOpen,
  onToggleFavorite,
  className,
}: {
  name: string
  description: string
  Icon: LucideIcon
  disabled?: boolean
  favorite: boolean
  onOpen: () => void
  onToggleFavorite: () => void
  className?: string
}) {
  return (
    <div className={cn('group relative h-[176px]', className)}>
      <button
        type="button"
        aria-disabled={disabled}
        onClick={onOpen}
        className={cn(
          'glass flex h-full w-full flex-col rounded-panel border border-transparent p-4 text-left outline-none transition-colors duration-150 hover:border-foreground/20 focus-visible:ring-[3px] focus-visible:ring-ring/40',
          disabled && 'opacity-60',
        )}
      >
        <span className="flex min-w-0 items-start gap-3 pr-12">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-accent text-accent-foreground"
          >
            <Icon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-foreground">{name}</span>
            {disabled ? (
              <span className="shrink-0 rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                已禁用
              </span>
            ) : null}
          </span>
        </span>
        <span className="mt-2 block min-h-0 flex-1 overflow-y-auto pr-1 scroll-thin">
          <span className="block text-[13px] font-medium leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={favorite ? '取消收藏' : '收藏'}
        aria-pressed={favorite}
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite()
        }}
        className={cn(
          'absolute right-2 top-2 flex size-9 cursor-pointer items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40',
          favorite
            ? 'text-warning'
            : 'text-muted-foreground/40 hover:text-foreground focus-visible:text-foreground',
        )}
      >
        <Star className={cn('size-5', favorite && 'fill-warning')} />
      </button>
    </div>
  )
}
