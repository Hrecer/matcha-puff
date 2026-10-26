import type { CSSProperties } from 'react'
import { cn } from 'cn'
import '@/styles/playing-bars.css'

/** 三根柱子的静态高度：错落成一枚小波形，动画停掉时也认得出是「在响」 */
const BAR_HEIGHTS = [0.58, 1, 0.76]

/**
 * 播放中律动条
 *
 * 声音正在播放的抽象标识：三条圆头短柱依次起伏 + 整组轻呼吸。
 * 不写死尺寸与颜色 —— 高度由调用方通过 className 给（如 `h-3.5`），
 * 颜色默认跟随 primary，也可用 text-* 覆盖，柱子本身是 bg-current。
 */
export function PlayingBars({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'playing-bars-breathe inline-flex items-end gap-[2px] text-primary',
        className,
      )}
    >
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className="playing-bars-bar w-[2px] rounded-full bg-current"
          style={{ height: `${height * 100}%`, '--pb-i': index } as CSSProperties}
        />
      ))}
    </span>
  )
}
