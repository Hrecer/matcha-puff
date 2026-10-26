import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { Text2ImageInput, Text2ImageOutput } from './schema'

const WIDTH = 420
const PADDING = 28
const SIGNATURE_HEIGHT = 52
const FONT_FAMILY = "system-ui, 'Microsoft YaHei', sans-serif"

/** 粗略字宽：CJK 按 1 个字号，ASCII 按 0.55 个字号 */
const charWidth = (char: string, fontSize: number): number =>
  /[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(char) ? fontSize : fontSize * 0.55

function wrapLines(text: string, fontSize: number): string[] {
  const usable = WIDTH - PADDING * 2
  const lines: string[] = []
  for (const rawLine of text.split('\n')) {
    if (!rawLine) {
      lines.push('')
      continue
    }
    let current = ''
    let width = 0
    for (const char of rawLine) {
      const w = charWidth(char, fontSize)
      if (width + w > usable && current) {
        lines.push(current)
        current = char
        width = w
      } else {
        current += char
        width += w
      }
    }
    lines.push(current)
  }
  return lines
}

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function execute(
  input: Text2ImageInput,
  _context: ToolExecutionContext,
): ToolResult<Text2ImageOutput> {
  const text = input.text.replace(/\r\n/g, '\n')
  const lines = wrapLines(text, input.fontSize)
  const lineHeight = Math.round(input.fontSize * 1.7)
  const bodyHeight = Math.max(lines.length, 1) * lineHeight
  const height = PADDING * 2 + bodyHeight + SIGNATURE_HEIGHT
  const anchor = input.align === 'center' ? 'middle' : 'start'
  const x = input.align === 'center' ? WIDTH / 2 : PADDING

  const body = lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${PADDING + (index + 1) * lineHeight - Math.round(lineHeight * 0.3)}" text-anchor="${anchor}" font-family="${FONT_FAMILY}" font-size="${input.fontSize}" font-weight="500" fill="#111111">${escapeXml(line)}</text>`,
    )
    .join('')

  const signatureY = PADDING + bodyHeight + 30
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">` +
    `<rect width="${WIDTH}" height="${height}" fill="#f3f4f6"/>` +
    body +
    `<line x1="${PADDING}" y1="${signatureY - 16}" x2="${WIDTH - PADDING}" y2="${signatureY - 16}" stroke="#d1d5db"/>` +
    `<text x="${WIDTH / 2}" y="${signatureY + 4}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="11" fill="#6b7280">当前文字图片由 抹茶泡芙 生成</text>` +
    `</svg>`

  return toolOk({
    text,
    fontSize: input.fontSize,
    width: WIDTH,
    height,
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  })
}
