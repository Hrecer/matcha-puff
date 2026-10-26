import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { ImageViewerInput, ImageViewerOutput } from './schema'

export function execute(
  _input: ImageViewerInput,
  _context: ToolExecutionContext,
): ToolResult<ImageViewerOutput> {
  return toolOk({
    formats: ['gif', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico', 'tiff', 'tif'],
    note: '在工具窗口点「选择文件进行预览」可一次选多张图片，点击缩略图全屏切换。',
  })
}
