import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const notes = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['action', 'id', 'title', 'content', 'color'],
    fields: {
      action: { widget: 'select', label: '操作', help: 'list / save / delete / clear' },
      id: { widget: 'text', label: '便签 id' },
      title: { widget: 'text', label: '标题' },
      content: { widget: 'textarea', label: '内容', rows: 4 },
      color: { widget: 'select', label: '颜色' },
    },
    resultAs: 'table',
  },
  execute,
})
