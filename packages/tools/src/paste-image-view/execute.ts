import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { PasteImageViewInput, PasteImageViewOutput } from './schema'

export function execute(
  _input: PasteImageViewInput,
  _context: ToolExecutionContext,
): ToolResult<PasteImageViewOutput> {
  return toolOk({
    title: '剪切板图片预览',
    subtitle: '选择图片后在此处进行展示，右下角可对图片进行保存',
    note: '在工具窗口点「读取剪切板图片」，或直接按 Ctrl+V 粘贴图片。',
  })
}
