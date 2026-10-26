/** 估算 data URL 里图片的实际字节数，用来对比压缩前后的体积 */
export function bytesOfDataUrl(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const meta = dataUrl.slice(0, comma)
  const body = dataUrl.slice(comma + 1)
  if (!meta.includes(';base64')) return body.length
  const cleaned = body.replace(/\s+/g, '')
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding)
}
