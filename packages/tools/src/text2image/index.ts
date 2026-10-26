import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const text2Image = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'fontSize', 'align'],
    fields: {
      text: { widget: 'textarea', label: '文字' },
      fontSize: { widget: 'number', label: '字号' },
      align: { widget: 'select', label: '对齐' },
    },
  },
  execute,
})
