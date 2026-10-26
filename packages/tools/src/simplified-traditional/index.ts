import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const simplifiedTraditional = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'direction'],
    fields: {
      text: { widget: 'textarea', label: '文本' },
      direction: { widget: 'select', label: '方向' },
    },
  },
  execute,
})
