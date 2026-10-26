import * as React from 'react'
import { cn } from 'cn'











export function Glass({
  frosted = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { frosted?: boolean }) {
  return (
    <div className={cn(frosted ? 'glass-frosted' : 'glass', className)} {...props} />
  )
}
