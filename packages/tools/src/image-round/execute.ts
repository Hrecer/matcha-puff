import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { bytesOfDataUrl } from '../shared/imageData'
import type { ImageRoundInput, ImageRoundOutput } from './schema'

export async function execute(
  input: ImageRoundInput,
  context: ToolExecutionContext,
): Promise<ToolResult<ImageRoundOutput>> {
  const image = context.services.image
  if (!image) return toolFail('EXECUTION_FAILED', '当前宿主不支持图像处理（缺少 image service）')

  try {
    const info = await image.info(input.dataUrl)
    const byPercent = input.byPercent ?? false
    const radiusInput = input.radius ?? 24
    // 短边的一半是圆角上限，超过就变成圆形裁切
    const radius = byPercent
      ? (Math.min(info.width, info.height) * Math.min(50, radiusInput)) / 100
      : radiusInput
    const dataUrl = await image.transform(input.dataUrl, { round: { radius }, format: 'png' })
    return toolOk({
      dataUrl,
      width: info.width,
      height: info.height,
      radius: Math.round(radius),
      bytes: bytesOfDataUrl(dataUrl),
    })
  } catch (error) {
    return toolFail('EXECUTION_FAILED', error instanceof Error ? `圆角处理失败：${error.message}` : '圆角处理失败')
  }
}
