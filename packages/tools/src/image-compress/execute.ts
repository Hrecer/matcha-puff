import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { bytesOfDataUrl } from '../shared/imageData'
import type { ImageCompressInput, ImageCompressOutput } from './schema'

export async function execute(
  input: ImageCompressInput,
  context: ToolExecutionContext,
): Promise<ToolResult<ImageCompressOutput>> {
  const image = context.services.image
  if (!image) return toolFail('EXECUTION_FAILED', '当前宿主不支持图像处理（缺少 image service）')

  try {
    const info = await image.info(input.dataUrl)
    const scaleInput = input.scale ?? 1
    // 「最大边长」与缩放比例可以叠加：先按长边限制，再套用比例
    const longest = Math.max(info.width, info.height)
    const edgeScale = input.maxEdge && longest > input.maxEdge ? input.maxEdge / longest : 1
    const scale = Math.min(1, Math.max(0.1, scaleInput)) * edgeScale
    const width = Math.max(1, Math.round(info.width * scale))
    const height = Math.max(1, Math.round(info.height * scale))
    const resize =
      input.maxEdge !== undefined
        ? { width, height }
        : { scale: scaleInput }
    const dataUrl = await image.transform(input.dataUrl, {
      resize,
      format: input.format ?? 'jpeg',
      quality: input.quality ?? 0.8,
    })
    const beforeBytes = bytesOfDataUrl(input.dataUrl)
    const bytes = bytesOfDataUrl(dataUrl)
    const savedPercent = beforeBytes
      ? Math.round(((beforeBytes - bytes) / beforeBytes) * 100)
      : 0

    return toolOk({
      dataUrl,
      width,
      height,
      bytes,
      beforeBytes,
      savedPercent,
    })
  } catch (error) {
    return toolFail('EXECUTION_FAILED', error instanceof Error ? `压缩失败：${error.message}` : '压缩失败')
  }
}
