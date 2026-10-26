import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const getColorThief = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['dataUrl', 'colorCount'],
    fields: {
      dataUrl: { widget: 'text', label: '图片' },
      colorCount: { widget: 'number', label: '颜色数量', help: '2–20，默认 10' },
    },
  },
  execute,
})
