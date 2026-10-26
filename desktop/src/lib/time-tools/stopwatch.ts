import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { StopwatchInput, StopwatchOutput } from './stopwatch.schema'

const pad = (value: number, size = 2): string => String(value).padStart(size, '0')

/** 毫秒转「时:分:秒.厘秒」，超过 60 分钟自动进位到小时 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  const centiseconds = Math.floor((total % 1000) / 10)
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`
}

export function execute(
  input: StopwatchInput,
  _context: ToolExecutionContext,
): ToolResult<StopwatchOutput> {
  let cumulative = 0
  const laps = input.laps.map((ms, index) => {
    cumulative += ms
    return {
      index: index + 1,
      ms,
      lapText: formatDuration(ms),
      cumulativeMs: cumulative,
      cumulativeText: formatDuration(cumulative),
    }
  })

  const ranked = laps.filter((lap) => lap.ms > 0)
  const fastest = ranked.reduce<StopwatchOutput['laps'][number] | null>(
    (best, lap) => (!best || lap.ms < best.ms ? lap : best),
    null,
  )
  const slowest = ranked.reduce<StopwatchOutput['laps'][number] | null>(
    (worst, lap) => (!worst || lap.ms > worst.ms ? lap : worst),
    null,
  )

  return toolOk({
    totalMs: cumulative,
    totalText: formatDuration(cumulative),
    averageMs: Math.round(cumulative / input.laps.length),
    fastest: fastest ? { index: fastest.index, ms: fastest.ms, text: fastest.lapText } : null,
    slowest: slowest ? { index: slowest.index, ms: slowest.ms, text: slowest.lapText } : null,
    laps,
  })
}
