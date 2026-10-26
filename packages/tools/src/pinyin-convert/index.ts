import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const pinyinConvert = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'mode', 'separator'],
    fields: {
      text: { widget: 'textarea', label: '中文' },
      mode: { widget: 'select', label: '形式' },
      separator: { widget: 'text', label: '分隔符' },
    },
  },
  execute,
})
