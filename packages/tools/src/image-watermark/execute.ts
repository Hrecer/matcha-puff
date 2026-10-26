import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ImageOps, ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { bytesOfDataUrl } from '../shared/imageData'
import type { ImageWatermarkInput, ImageWatermarkOutput } from './schema'

/** 宿主 ImageOps 只声明了基础水印字段，桌面端额外支持间距/偏移/平铺 */
type WatermarkOptions = NonNullable<ImageOps['watermark']> & {
  gapX?: number
  gapY?: number
  offsetX?: number
  offsetY?: number
  repeat?: boolean
  staggered?: boolean
}

export async function execute(
  input: ImageWatermarkInput,
  context: ToolExecutionContext,
): Promise<ToolResult<ImageWatermarkOutput>> {
  const image = context.services.image
  if (!image) return toolFail('EXECUTION_FAILED', '当前宿主不支持图像处理（缺少 image service）')

  try {
    const info = await image.info(input.dataUrl)
    const watermark: WatermarkOptions = {
      text: input.text,
      fontSize: input.fontSize ?? 24,
      color: input.color ?? '#333333',
      opacity: input.opacity ?? 0.2,
      angle: input.angle ?? -30,
      gap: input.gap ?? 220,
      gapX: input.gapX ?? input.gap ?? 220,
      gapY: input.gapY ?? input.gap ?? 220,
      offsetX: input.offsetX ?? 0,
      offsetY: input.offsetY ?? 0,
      repeat: input.repeat ?? true,
      staggered: input.staggered ?? true,
    }
    const dataUrl = await image.transform(input.dataUrl, {
      watermark,
      format: 'png',
    })
    return toolOk({
      dataUrl,
      width: info.width,
      height: info.height,
      bytes: bytesOfDataUrl(dataUrl),
    })
  } catch (error) {
    return toolFail('EXECUTION_FAILED', error instanceof Error ? `水印处理失败：${error.message}` : '水印处理失败')
  }
}
