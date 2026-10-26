import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { bytesOfDataUrl } from '../shared/imageData'
import type { ImageCropInput, ImageCropOutput } from './schema'

export async function execute(
  input: ImageCropInput,
  context: ToolExecutionContext,
): Promise<ToolResult<ImageCropOutput>> {
  const image = context.services.image
  if (!image) return toolFail('EXECUTION_FAILED', '当前宿主不支持图像处理（缺少 image service）')

  try {
    const info = await image.info(input.dataUrl)
    if (input.x + input.width > info.width || input.y + input.height > info.height) {
      return toolFail(
        'INVALID_INPUT',
        `裁剪区域超出图片范围（原图 ${info.width}×${info.height}）`,
      )
    }
    const resize =
      input.outputWidth && input.outputHeight
        ? { resize: { width: input.outputWidth, height: input.outputHeight } }
        : {}
    const dataUrl = await image.transform(input.dataUrl, {
      crop: { x: input.x, y: input.y, width: input.width, height: input.height },
      ...resize,
      ...(input.format ? { format: input.format } : {}),
    })
    return toolOk({
      dataUrl,
      width: input.outputWidth ? Math.round(input.outputWidth) : Math.round(input.width),
      height: input.outputHeight ? Math.round(input.outputHeight) : Math.round(input.height),
      bytes: bytesOfDataUrl(dataUrl),
    })
  } catch (error) {
    return toolFail('EXECUTION_FAILED', error instanceof Error ? `裁剪失败：${error.message}` : '裁剪失败')
  }
}
