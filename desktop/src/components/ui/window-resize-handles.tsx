import { startResizeDragging, type ResizeDirection } from '@/ipc/bridge'
import { cn } from 'cn'

/**
 * 无边框子窗的缩放手柄。
 *
 * 热区只贴窗口最外缘：可见边框 2px、原生缩放边约 4~8px，这里取 6px 边 / 14px 角，
 * 和主窗口的原生手感对齐。**别再往里加宽**：工具窗很窄，标题栏只有 44px 高、
 * 窗口按钮 46px 宽且通高；以前的 22px 边 + 28px 角会吃掉标题栏上半截和三个按钮的上半，
 * 而这层 z-80 又盖在 z-10 的内容之上，pointerdown 被直接拦去 startResizeDragging，
 * 于是鼠标明明还在窗口里、只是靠上一点就变拉伸，拖窗口/点按钮都不听使唤；
 * 26px 圆角外的透明区也被 28px 方角盖住，同样会冒出斜向拉伸光标。
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
      {/* 边 6px、角 14px：inset 与角尺寸对齐，热区之间不叠也不留缝 */}
      {handle('n', 'inset-x-[14px] top-0 h-[6px] cursor-ns-resize')}
      {handle('s', 'inset-x-[14px] bottom-0 h-[6px] cursor-ns-resize')}
      {handle('w', 'inset-y-[14px] left-0 w-[6px] cursor-ew-resize')}
      {handle('e', 'inset-y-[14px] right-0 w-[6px] cursor-ew-resize')}
      {handle('nw', 'left-0 top-0 size-[14px] cursor-nwse-resize')}
      {handle('ne', 'right-0 top-0 size-[14px] cursor-nesw-resize')}
      {handle('sw', 'left-0 bottom-0 size-[14px] cursor-nesw-resize')}
      {handle('se', 'right-0 bottom-0 size-[14px] cursor-nwse-resize')}
    </div>
  )
}
