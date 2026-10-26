import { useId } from 'react'

/** 动作图标：显示器里出现小卡 = 打开挂件 */
export function WidgetShowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <rect x="10.5" y="9" width="9.2" height="6.3" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** 动作图标：划掉的显示器 = 关闭挂件 */
export function WidgetHideIcon({ className }: { className?: string }) {
  const maskId = `focus-widget-hide-gap-${useId().replace(/:/g, '')}`
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="24"
          height="24"
        >
          <rect width="24" height="24" fill="white" />
          <path d="M2.8 20.4 21.2 2.6" stroke="black" strokeWidth={5} strokeLinecap="round" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </g>
      <path d="M2.8 20.4 21.2 2.6" />
    </svg>
  )
}
