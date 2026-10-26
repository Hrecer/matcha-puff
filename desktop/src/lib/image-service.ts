/**
 * 桌面端的图像服务：用 canvas 实现，通过 runtime 注入给工具内核。
 *
 * 工具内核只认 ImageService 接口，不碰 document / window；
 * 没有注入这一层的宿主，工具会返回“宿主不支持图像处理”而不是崩溃。
 */

import type { ImageInfo, ImageOps, ImagePixels, ImageService } from '@matcha-puff/tool-contracts'

const round = (value: number): number => Math.max(1, Math.round(value))

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败，请确认是受支持的图片格式'))
    image.src = dataUrl
  })
}

const mimeOf = (dataUrl: string): string => /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? 'image/png'

const outputType = (ops: ImageOps, source: string): string => {
  if (ops.format === 'jpeg') return 'image/jpeg'
  if (ops.format === 'webp') return 'image/webp'
  // 源是 JPEG 且没指定格式时沿用 JPEG，其余一律 PNG（保留透明）
  return mimeOf(source) === 'image/jpeg' ? 'image/jpeg' : 'image/png'
}

/** 圆角路径：radius 是按短边算的像素值 */
function roundedPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2))
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(width - r, 0)
  ctx.arcTo(width, 0, width, height, r)
  ctx.lineTo(width, height - r)
  ctx.arcTo(width, height, 0, height, r)
  ctx.lineTo(r, height)
  ctx.arcTo(0, height, 0, 0, r)
  ctx.lineTo(0, r)
  ctx.arcTo(0, 0, width, 0, r)
  ctx.closePath()
}

/** 铺满整张图的斜向重复水印（支持 X/Y 间距、偏移、平铺与错开排列） */
type WatermarkOptions = NonNullable<ImageOps['watermark']> & {
  gapX?: number
  gapY?: number
  offsetX?: number
  offsetY?: number
  repeat?: boolean
  staggered?: boolean
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WatermarkOptions,
): void {
  const text = options.text
  if (!text) return
  const fontSize = options.fontSize ?? Math.max(14, Math.round(Math.min(width, height) / 24))
  const gap = options.gap ?? Math.round(fontSize * 8)
  const gapX = Math.max(0, options.gapX ?? gap)
  const gapY = Math.max(0, options.gapY ?? gap)
  const offsetX = options.offsetX ?? 0
  const offsetY = options.offsetY ?? 0
  const repeat = options.repeat ?? true
  const staggered = options.staggered ?? true
  const angle = ((options.angle ?? -30) * Math.PI) / 180

  ctx.save()
  ctx.globalAlpha = Math.min(1, Math.max(0.02, options.opacity ?? 0.18))
  ctx.fillStyle = options.color ?? '#ffffff'
  ctx.font = `${fontSize}px system-ui, "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(width / 2, height / 2)
  ctx.rotate(angle)

  if (!repeat) {
    ctx.fillText(text, offsetX, offsetY)
    ctx.restore()
    return
  }

  const textWidth = Math.max(1, ctx.measureText(text).width)
  const stepX = Math.max(1, textWidth + gapX)
  const stepY = Math.max(1, fontSize + gapY)
  const diagonal = Math.ceil(Math.hypot(width, height)) + Math.max(stepX, stepY) * 2
  // 把偏移折算进网格起点，负值时也能铺满
  const startX = -diagonal + (((offsetX % stepX) + stepX) % stepX)
  const startY = -diagonal + (((offsetY % stepY) + stepY) % stepY)

  let row = 0
  for (let y = startY; y <= diagonal; y += stepY, row += 1) {
    const shift = staggered && row % 2 === 1 ? stepX / 2 : 0
    for (let x = startX + shift; x <= diagonal; x += stepX) {
      ctx.fillText(text, x, y)
    }
  }
  ctx.restore()
}

export const browserImageService: ImageService = {
  async info(dataUrl: string): Promise<ImageInfo> {
    const image = await loadImage(dataUrl)
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      type: mimeOf(dataUrl),
    }
  },

  async transform(dataUrl: string, ops: ImageOps): Promise<string> {
    const image = await loadImage(dataUrl)
    const sourceX = ops.crop?.x ?? 0
    const sourceY = ops.crop?.y ?? 0
    const sourceWidth = ops.crop?.width ?? image.naturalWidth
    const sourceHeight = ops.crop?.height ?? image.naturalHeight

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error('裁剪区域无效')
    }

    let width = sourceWidth
    let height = sourceHeight
    if (ops.resize?.scale && ops.resize.scale > 0) {
      width = sourceWidth * ops.resize.scale
      height = sourceHeight * ops.resize.scale
    } else if (ops.resize?.width || ops.resize?.height) {
      const ratio = sourceWidth / sourceHeight
      if (ops.resize?.width && ops.resize?.height) {
        width = ops.resize.width
        height = ops.resize.height
      } else if (ops.resize?.width) {
        width = ops.resize.width
        height = ops.resize.width / ratio
      } else {
        height = ops.resize?.height ?? height
        width = (ops.resize?.height ?? height) * ratio
      }
    }

    const targetWidth = round(width)
    const targetHeight = round(height)
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前环境拿不到 canvas 上下文')

    const type = outputType(ops, dataUrl)
    // JPEG 不支持透明，先铺白底，避免圆角处发黑
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetWidth, targetHeight)
    }

    if (ops.round) {
      roundedPath(ctx, targetWidth, targetHeight, ops.round.radius)
      ctx.clip()
    }

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    )

    if (ops.watermark) {
      drawWatermark(ctx, targetWidth, targetHeight, ops.watermark)
    }

    const quality = ops.quality === undefined ? undefined : Math.min(1, Math.max(0.05, ops.quality))
    return quality === undefined
      ? canvas.toDataURL(type)
      : canvas.toDataURL(type, quality)
  },

  async pixels(dataUrl: string, options?: { maxDimension?: number }): Promise<ImagePixels> {
    const image = await loadImage(dataUrl)
    const maxDimension = Math.max(8, Math.min(2048, options?.maxDimension ?? 128))
    const longest = Math.max(image.naturalWidth, image.naturalHeight)
    const scale = longest > maxDimension ? maxDimension / longest : 1
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前环境拿不到 canvas 上下文')
    ctx.drawImage(image, 0, 0, width, height)
    return { width, height, data: ctx.getImageData(0, 0, width, height).data }
  },
}
