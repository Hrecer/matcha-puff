import { patchEyeCare, useEyeCare } from '@/lib/eye-care'
import { cn } from 'cn'

/**
 * 五档强度条：越靠右越浓。
 *
 * 只读当前档位，点击即改 —— 改动直接落到遮罩上，肉眼立刻能看到深浅变化，
 * 不需要"确定"这一步。未开启遮罩时也允许调，方便先调好再开。
 */
export function EyeCareStrengthBar({ className }: { className?: string }) {
  const strength = useEyeCare((value) => value.strength)

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="group"
      aria-label="护眼强度"
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const active = strength >= level
        return (
          <button
            key={level}
            type="button"
            aria-label={`强度 ${level}`}
            aria-pressed={strength === level}
            title={`强度 ${level}`}
            onClick={() => {
              void patchEyeCare({ strength: level }).catch(() => {})
            }}
            className="group/bar flex h-5 w-[6px] items-end justify-center outline-none"
          >
            <span
              className={cn(
                'w-full rounded-full transition-colors',
                active
                  ? 'bg-primary/70 group-hover/bar:bg-primary'
                  : 'bg-border group-hover/bar:bg-muted-foreground/40',
              )}
              style={{ height: `${6 + level * 2}px` }}
            />
          </button>
        )
      })}
    </div>
  )
}
