import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { contrastRatio, luminance, parseColor, rgbToCmyk, rgbToHsl, toHex, type Rgb } from './colors'
import type { ColorSelectInput, ColorSelectOutput } from './schema'

const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 }
const BLACK: Rgb = { r: 0, g: 0, b: 0, a: 1 }

export function execute(
  input: ColorSelectInput,
  _context: ToolExecutionContext,
): ToolResult<ColorSelectOutput> {
  const color = parseColor(input.value)
  if (!color) {
    return toolFail('INVALID_INPUT', '认不出这个颜色，支持 #rgb、#rrggbb、rgb()、rgba()、hsl()')
  }

  const hsl = rgbToHsl(color)
  const cmyk = rgbToCmyk(color)
  const luma = Math.round(luminance(color) * 1000) / 1000
  const hex = toHex(color)

  return toolOk({
    hex,
    hex6: hex.slice(0, 7),
    rgb: color,
    rgbText: color.a < 1 ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` : `rgb(${color.r}, ${color.g}, ${color.b})`,
    hsl,
    hslText: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    cmyk,
    cmykText: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,
    luminance: luma,
    contrastOnWhite: contrastRatio(color, WHITE),
    contrastOnBlack: contrastRatio(color, BLACK),
    isLight: luma > 0.5,
  })
}
