import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const qrCode = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'level', 'size', 'dotType', 'cornerType', 'foreground', 'background'],
    fields: {
      text: { widget: 'textarea', label: '内容' },
      level: { widget: 'select', label: '容错级别' },
      size: { widget: 'number', label: '尺寸（像素）' },
      dotType: { widget: 'select', label: '点形' },
      cornerType: { widget: 'select', label: '角形' },
      foreground: { widget: 'text', label: '前景色' },
      background: { widget: 'text', label: '背景色' },
    },
  },
  execute,
})
