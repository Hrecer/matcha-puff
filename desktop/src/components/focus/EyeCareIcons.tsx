/** 动作图标：睁眼 = 护眼遮罩关闭（点一下开启） */
export function EyeCareOffIcon({ className }: { className?: string }) {
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
      <path d="M2.2 12S5.8 5.6 12 5.6 21.8 12 21.8 12 18.2 18.4 12 18.4 2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="2.9" />
    </svg>
  )
}

/** 动作图标：实心瞳孔 = 护眼遮罩开启（点一下关闭） */
export function EyeCareOnIcon({ className }: { className?: string }) {
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
      <path d="M2.2 12S5.8 5.6 12 5.6 21.8 12 21.8 12 18.2 18.4 12 18.4 2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="3.1" fill="currentColor" stroke="none" />
    </svg>
  )
}
