"use client"

import * as React from "react"
import { cn } from "cn"
import { Tooltip as TooltipPrimitive } from "radix-ui"

function TooltipProvider({
  delayDuration = 700,
  skipDelayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-[6px] border border-primary/45 bg-background px-3 py-1.5 text-[12px] font-medium leading-none text-primary animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/** 奶油风提示：替代浏览器原生 title（原生样式是黑底白边，和界面不搭） */
function Tip({
  label,
  children,
  side = "bottom",
  align = "center",
  sideOffset = 4,
}: {
  label: React.ReactNode
  children: React.ReactElement
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"]
  align?: React.ComponentProps<typeof TooltipPrimitive.Content>["align"]
  sideOffset?: number
}) {
  const [open, setOpen] = React.useState(false)
  /** 窗口刚失焦/刚回来时压住悬停触发：否则最小化再恢复，指针还停在按钮上，提示会立刻弹出 */
  const suppressUntil = React.useRef(0)

  React.useEffect(() => {
    const close = () => {
      suppressUntil.current = performance.now() + 500
      setOpen(false)
    }
    const hold = () => {
      suppressUntil.current = performance.now() + 500
    }
    const onVisibility = () => {
      if (document.hidden) close()
    }
    window.addEventListener("blur", close)
    window.addEventListener("focus", hold)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("blur", close)
      window.removeEventListener("focus", hold)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const onOpenChange = (next: boolean) => {
    if (next && performance.now() < suppressUntil.current) return
    setOpen(next)
  }

  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} sideOffset={sideOffset}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Tip }
