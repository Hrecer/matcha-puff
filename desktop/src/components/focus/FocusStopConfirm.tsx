import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { closeStopConfirm, useStopConfirmOpen } from '@/lib/focus-stop-ask'
import { refreshFocusSnapshot, stopFocus, useFocusStore } from '@/lib/focus-store'

/**
 * 停止专注 / 休息的确认弹窗。
 *
 * 挂在主窗口上（不在某个页面里），所以在哪个页面按停止都能弹出来；
 * 挂件和托盘按停止时，主窗口会先被唤起再弹这个。
 */
export function FocusStopConfirm() {
  const open = useStopConfirmOpen()
  const { snapshot } = useFocusStore()
  const inRest =
    snapshot?.phase === 'rest' ||
    (snapshot?.phase === 'paused' && snapshot.pausedFrom === 'rest')

  // 从托盘 / 挂件唤起时主窗可能刚显示，先补一次真状态再决定文案
  useEffect(() => {
    if (open) void refreshFocusSnapshot()
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeStopConfirm()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{inRest ? '停止这一段休息？' : '停止这一段专注？'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {inRest
            ? '停止会直接结束这段休息，不记录这次休息，也不会自动开始下一段专注。想保留当前任务、按设置进入下一段，请用「跳过休息」。'
            : '停止后已走过的时间会按实际时长入账，这一段不会再计入「完成」。'}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={closeStopConfirm}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              closeStopConfirm()
              void stopFocus()
            }}
          >
            {inRest ? '停止休息' : '确定停止'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
