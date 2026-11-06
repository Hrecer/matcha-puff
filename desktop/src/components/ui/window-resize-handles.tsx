import { startResizeDragging, type ResizeDirection } from '@/ipc/bridge'
import { cn } from 'cn'

/**
 * 无边框子窗的缩放手柄。
 *
 * 子窗窗口矩形 = 可见窗口，可视边框就在窗口最外缘。原生缩放边太窄，
 * 这里把热区加宽到 22px 压在边框内侧，四角放大到 28px，手感对齐主窗口。
 */
export function WindowResizeHandles({ maximized = false }: { maximized?: boolean }) {
  if (maximized) return null

  const handle = (direction: ResizeDirection, className: string) => (
    <div
      key={direction}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        void startResizeDragging(direction)
      }}
      className={cn('pointer-events-auto absolute', className)}
    />
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-[80]" aria-hidden>
      {handle('n', 'inset-x-7 top-0 h-[22px] cursor-ns-resize')}
      {handle('s', 'inset-x-7 bottom-0 h-[22px] cursor-ns-resize')}
      {handle('w', 'inset-y-7 left-0 w-[22px] cursor-ew-resize')}
      {handle('e', 'inset-y-7 right-0 w-[22px] cursor-ew-resize')}
      {handle('nw', 'left-0 top-0 size-7 cursor-nwse-resize')}
      {handle('ne', 'right-0 top-0 size-7 cursor-nesw-resize')}
      {handle('sw', 'left-0 bottom-0 size-7 cursor-nesw-resize')}
      {handle('se', 'right-0 bottom-0 size-7 cursor-nwse-resize')}
    </div>
  )
}
