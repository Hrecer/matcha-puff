import { create } from 'qrcode/lib/browser.js'
import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { QrCodeInput, QrCodeOutput } from './schema'

const MARGIN = 1
const FINDER = 7

const num = (value: number): string => Number(value.toFixed(3)).toString()

/** 单模块形状：位置与尺寸都以 1 个模块为单位 */
function moduleShape(x: number, y: number, type: QrCodeInput['dotType']): string {
  switch (type) {
    case 'dots':
      return `<circle cx="${num(x + 0.5)}" cy="${num(y + 0.5)}" r="0.45"/>`
    case 'rounded':
      return `<rect x="${x}" y="${y}" width="1" height="1" rx="0.3"/>`
    case 'extra-rounded':
      return `<rect x="${x}" y="${y}" width="1" height="1" rx="0.5"/>`
    case 'classy':
      return `<path d="M${x} ${y + 1}V${y + 0.5}A0.5 0.5 0 0 1 ${x + 0.5} ${y}H${x + 1}V${y + 0.5}A0.5 0.5 0 0 1 ${x + 0.5} ${y + 1}Z"/>`
    case 'classy-rounded':
      return `<rect x="${x}" y="${y}" width="1" height="1" rx="0.5"/>`
    default:
      return `<rect x="${x}" y="${y}" width="1" height="1"/>`
  }
}

/** 定位角：外圈 7×7 空心 + 中心 3×3，按角形换圆角/圆形 */
function finderShape(x: number, y: number, type: QrCodeInput['cornerType']): string {
  if (type === 'dot') {
    return (
      `<path fill-rule="evenodd" d="M${x + 3.5} ${y}A3.5 3.5 0 1 1 ${x + 3.5} ${y + 7}A3.5 3.5 0 1 1 ${x + 3.5} ${y}Z` +
      `M${x + 3.5} ${y + 1}A2.5 2.5 0 1 0 ${x + 3.5} ${y + 6}A2.5 2.5 0 1 0 ${x + 3.5} ${y + 1}Z"/>` +
      `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.5"/>`
    )
  }
  if (type === 'extra-rounded') {
    return (
      `<path fill-rule="evenodd" d="M${x + 2} ${y}H${x + 5}A2 2 0 0 1 ${x + 7} ${y + 2}V${y + 5}A2 2 0 0 1 ${x + 5} ${y + 7}H${x + 2}A2 2 0 0 1 ${x} ${y + 5}V${y + 2}A2 2 0 0 1 ${x + 2} ${y}Z` +
      `M${x + 2} ${y + 1}H${x + 5}A1 1 0 0 1 ${x + 6} ${y + 2}V${y + 5}A1 1 0 0 1 ${x + 5} ${y + 6}H${x + 2}A1 1 0 0 1 ${x + 1} ${y + 5}V${y + 2}A1 1 0 0 1 ${x + 2} ${y + 1}Z"/>` +
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.8"/>`
    )
  }
  return (
    `<path fill-rule="evenodd" d="M${x} ${y}h${FINDER}v${FINDER}h-${FINDER}Z` +
    `M${x + 1} ${y + 1}v5h5v-5Z"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`
  )
}

/** 用 qrcode 的模块矩阵自己拼 SVG，才能支持点形/角形与前景背景色 */
function renderSvg(input: QrCodeInput): string {
  const qr = create(input.text, { errorCorrectionLevel: input.level })
  const count = qr.modules.size
  const total = count + MARGIN * 2
  const offset = MARGIN
  const corners = new Set([
    `${offset},${offset}`,
    `${offset},${offset + count - FINDER}`,
    `${offset + count - FINDER},${offset}`,
  ])
  const inFinder = (x: number, y: number): boolean =>
    (x >= offset && x < offset + FINDER && y >= offset && y < offset + FINDER) ||
    (x >= offset && x < offset + FINDER && y >= offset + count - FINDER && y < offset + count) ||
    (x >= offset + count - FINDER && x < offset + count && y >= offset && y < offset + FINDER)

  const shapes: string[] = []
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.modules.data[row * count + col]) continue
      const x = col + offset
      const y = row + offset
      if (inFinder(x, y)) continue
      shapes.push(moduleShape(x, y, input.dotType))
    }
  }
  for (const key of corners) {
    const [x = 0, y = 0] = key.split(',').map(Number)
    shapes.push(finderShape(x, y, input.cornerType))
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${input.size}" height="${input.size}" viewBox="0 0 ${total} ${total}" ` +
    `shape-rendering="geometricPrecision"><rect width="${total}" height="${total}" fill="${input.background}"/>` +
    `<g fill="${input.foreground}">${shapes.join('')}</g></svg>`
  )
}

export async function execute(
  input: QrCodeInput,
  _context: ToolExecutionContext,
): Promise<ToolResult<QrCodeOutput>> {
  try {
    const svg = renderSvg(input)
    return toolOk({
      svg,
      size: input.size,
      level: input.level,
      dotType: input.dotType,
      cornerType: input.cornerType,
      foreground: input.foreground,
      background: input.background,
    })
  } catch (error) {
    return toolFail(
      'EXECUTION_FAILED',
      error instanceof Error ? `二维码生成失败：${error.message}` : '二维码生成失败',
    )
  }
}
