import { toolFail } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { execute as timeDiff } from './timeDiff'
import { execute as holidayCountdown } from './holidayCountdown'
import { execute as lunarConvert } from './lunarConvert'
import { execute as lunarZodiac } from './lunarZodiac'
import { execute as restOfLife } from './restOfLife'
import { execute as solarTerm } from './solarTerm'
import { execute as stopwatch } from './stopwatch'
import { execute as timeCalc } from './timeCalc'
import { execute as clock } from './clock'

/** 页面内功能不需要插件运行时，只给日期类逻辑提供当前时间 */
const context = {
  services: { now: () => Date.now() },
} as unknown as ToolExecutionContext

export async function runTimeTool<T>(toolId: string, input: unknown): Promise<ToolResult<T>> {
  const value = input as never
  switch (toolId) {
    case 'time-diff':
      return timeDiff(value, context) as ToolResult<T>
    case 'holiday-countdown':
      return holidayCountdown(value, context) as ToolResult<T>
    case 'lunar-convert':
      return lunarConvert(value, context) as ToolResult<T>
    case 'lunar-zodiac':
      return lunarZodiac(value, context) as ToolResult<T>
    case 'rest-of-life':
      return restOfLife(value, context) as ToolResult<T>
    case 'solar-term':
      return solarTerm(value, context) as ToolResult<T>
    case 'stopwatch':
      return stopwatch(value, context) as ToolResult<T>
    case 'time-calc':
      return timeCalc(value, context) as ToolResult<T>
    case 'clock':
      return clock(value, context) as ToolResult<T>
    default:
      return toolFail('TOOL_NOT_FOUND', `未知时间功能：${toolId}`) as ToolResult<T>
  }
}

/** 纯函数工具走同步路径：首屏直接出结果，避免切页回来时文字分批出现 */
export function runTimeToolSync<T>(toolId: string, input: unknown): ToolResult<T> {
  const value = input as never
  switch (toolId) {
    case 'time-diff':
      return timeDiff(value, context) as ToolResult<T>
    case 'rest-of-life':
      return restOfLife(value, context) as ToolResult<T>
    default:
      return toolFail('TOOL_NOT_FOUND', `未知同步时间功能：${toolId}`) as ToolResult<T>
  }
}
