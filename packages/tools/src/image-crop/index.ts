import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const imageCrop = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['dataUrl', 'x', 'y', 'width', 'height', 'outputWidth', 'outputHeight', 'format'],
    fields: {
      dataUrl: { widget: 'textarea', label: '图片 data URL' },
      x: { widget: 'number', label: '起点 X' },
      y: { widget: 'number', label: '起点 Y' },
      width: { widget: 'number', label: '宽度' },
      height: { widget: 'number', label: '高度' },
      outputWidth: { widget: 'number', label: '输出宽度' },
      outputHeight: { widget: 'number', label: '输出高度' },
      format: { widget: 'select', label: '输出格式' },
    },
  },
  execute,
})
