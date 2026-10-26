import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { parseHexColor, rgbToHex } from '../shared/misc'
import type { ColorCodecInput, ColorCodecOutput } from './schema'

export function execute(
  input: ColorCodecInput,
  _context: ToolExecutionContext,
): ToolResult<ColorCodecOutput> {
  try {
    const rgb =
      input.from === 'hex'
        ? parseHexColor(input.hex ?? '')
        : { r: input.r ?? 0, g: input.g ?? 0, b: input.b ?? 0 }
    const hex = rgbToHex(rgb)
    return toolOk({ hex, ...rgb, rgb: 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')' })
  } catch (error) {
    return toolFail('INVALID_INPUT', error instanceof Error ? error.message : '颜色转换失败')
  }
}
