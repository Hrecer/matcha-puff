import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const imageRound = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['dataUrl', 'radius', 'byPercent'],
    fields: {
      dataUrl: { widget: 'textarea', label: '图片 data URL' },
      radius: { widget: 'number', label: '圆角' },
      byPercent: { widget: 'switch', label: '按短边百分比' },
    },
  },
  execute,
})
