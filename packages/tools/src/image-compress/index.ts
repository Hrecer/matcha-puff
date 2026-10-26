import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const imageCompress = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['dataUrl', 'scale', 'quality', 'maxEdge', 'format'],
    fields: {
      dataUrl: { widget: 'textarea', label: '图片 data URL' },
      scale: { widget: 'number', label: '缩放比例' },
      quality: { widget: 'number', label: '画质' },
      maxEdge: { widget: 'number', label: '最大边长（像素）' },
      format: { widget: 'select', label: '输出格式' },
    },
  },
  execute,
})
