import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { ScreenCheckInput, ScreenCheckOutput } from './schema'

export function execute(
  _input: ScreenCheckInput,
  _context: ToolExecutionContext,
): ToolResult<ScreenCheckOutput> {
  return toolOk({
    colors: [
      { name: '蓝', hex: '#0000ff' },
      { name: '白', hex: '#ffffff' },
      { name: '黑', hex: '#000000' },
      { name: '红', hex: '#ff0000' },
      { name: '绿', hex: '#008000' },
      { name: '黄', hex: '#ffff00' },
      { name: '亮绿', hex: '#00ff00' },
      { name: '亮黄', hex: '#ffff00' },
      { name: '洋红', hex: '#ff00ff' },
      { name: '青', hex: '#00ffff' },
    ],
    note: '在右侧选择颜色后点击「进入全屏查看」，按 ESC 退出测试。',
  })
}
