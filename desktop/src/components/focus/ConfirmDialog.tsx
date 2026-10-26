import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** 统一确认弹窗：删除、清空这类不可逆操作都走这里。 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '删除',
  confirmVariant = 'destructive',
  onConfirm,
  onOpenChange,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmText?: string
  /** 只是提醒、不是破坏性改动时传 default，别把确认按钮弄成红色 */
  confirmVariant?: 'destructive' | 'default'
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{title}</DialogTitle>
        </DialogHeader>
        <p className="px-1 pb-2 text-[12.5px] leading-6 text-muted-foreground">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
