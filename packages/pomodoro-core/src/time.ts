/** 时间与进度换算：纯函数，输入毫秒，输出展示用字符串。 */

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** makeupTime：小于 10 补零，否则原样 */
export function makeupTime(minutes: number): string {
  return minutes < 10 ? `0${minutes}` : String(minutes)
}

export interface RemainText {
  minutes: string
  seconds: string
}

/** 剩余毫秒 → 分/秒文本（分向下取整，秒取余 60） */
export function formatRemain(remainMs: number): RemainText {
  const safe = Math.max(0, Math.floor(remainMs))
  return {
    minutes: makeupTime(Math.floor(safe / 60_000)),
    seconds: pad2(Math.floor(safe / 1000) % 60),
  }
}

/** 已完成进度：0 → 100，越界夹紧 */
export function progressPercent(elapsedMs: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 100
  const ratio = (elapsedMs / durationMs) * 100
  return Math.min(100, Math.max(0, ratio))
}

/** 统计用的时长文本：不足一小时 mm:ss，超过一小时 h:mm:ss */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`
}

/** 秒 → 分钟（向上取整） */
export function secondsToMinutes(seconds: number): number {
  return Math.ceil(Math.max(0, seconds) / 60)
}
