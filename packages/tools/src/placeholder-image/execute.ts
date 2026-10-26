import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { PlaceholderImageInput, PlaceholderImageOutput } from './schema'

const WATERMARK_TEXT = '当前图片由 抹茶泡芙 生成'

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export function buildSvg(input: PlaceholderImageInput): string {
  const text = input.text ?? ''
  const background = input.background ?? '#e5e7eb'
  const foreground = input.foreground ?? '#6b7280'
  const label = text.trim() || `${input.width} × ${input.height}`
  const fontSize = input.fontSize ?? Math.max(12, Math.round(Math.min(input.width, input.height) / 6))
  const watermarkSize = Math.max(10, Math.round(Math.min(input.width, input.height) / 20))
  const backgroundImage = input.backgroundImage
    ? `<image href="${escapeXml(input.backgroundImage)}" x="0" y="0" width="${input.width}" height="${input.height}" preserveAspectRatio="xMidYMid slice"/>`
    : ''
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}">`,
    `<rect width="100%" height="100%" fill="${escapeXml(background)}"/>`,
    backgroundImage,
    `<text x="50%" y="50%" fill="${escapeXml(foreground)}" font-family="system-ui, 'Microsoft YaHei', sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>`,
    `<text x="${input.width - 10}" y="${input.height - 8}" fill="${escapeXml(foreground)}" font-family="system-ui, 'Microsoft YaHei', sans-serif" font-size="${watermarkSize}" text-anchor="end" opacity="0.85">${escapeXml(WATERMARK_TEXT)}</text>`,
    `</svg>`,
  ].join('')
}

export const svgDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

export async function execute(
  input: PlaceholderImageInput,
  context: ToolExecutionContext,
): Promise<ToolResult<PlaceholderImageOutput>> {
  const svg = buildSvg(input)
  const format = input.format ?? 'svg'
  const label = (input.text ?? '').trim() || `${input.width} × ${input.height}`

  let dataUrl = svgDataUrl(svg)
  if (format === 'png') {
    if (!context.services.image) {
      return toolFail(
        'EXECUTION_FAILED',
        '当前宿主不支持生成 PNG（没有图像处理能力），请改用 SVG 格式',
      )
    }
    try {
      dataUrl = await context.services.image.transform(svgDataUrl(svg), { format: 'png' })
    } catch (error) {
      return toolFail(
        'EXECUTION_FAILED',
        error instanceof Error ? `PNG 渲染失败：${error.message}` : 'PNG 渲染失败',
      )
    }
  }

  return toolOk({
    width: input.width,
    height: input.height,
    format,
    svg,
    dataUrl,
    text: label,
  })
}

export { WATERMARK_TEXT }
