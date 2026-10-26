import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { GifFramesInput, GifFramesOutput } from './schema'

export function execute(
  input: GifFramesInput,
  _context: ToolExecutionContext,
): ToolResult<GifFramesOutput> {
  const totalDurationMs = input.delays.reduce((sum, delay) => sum + delay, 0)
  return toolOk({
    width: input.width,
    height: input.height,
    count: input.delays.length,
    totalDurationMs,
    averageDelayMs: Math.round(totalDurationMs / input.delays.length),
  })
}
