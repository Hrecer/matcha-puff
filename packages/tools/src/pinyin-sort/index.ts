import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const pinyinSort = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'by', 'direction'],
    fields: {
      text: { widget: 'textarea', label: '多行文本' },
      by: { widget: 'select', label: '排序依据' },
      direction: { widget: 'select', label: '顺序' },
    },
  },
  execute,
})
