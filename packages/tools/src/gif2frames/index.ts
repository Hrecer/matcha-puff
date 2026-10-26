import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const gif2frames = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['width', 'height', 'delays'],
    fields: {
      width: { widget: 'number', label: '图片宽' },
      height: { widget: 'number', label: '图片高' },
      delays: { widget: 'textarea', label: '每帧时长（毫秒）' },
    },
  },
  execute,
})
