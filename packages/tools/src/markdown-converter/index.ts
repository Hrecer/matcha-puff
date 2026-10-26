import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const markdownConverter = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['markdown', 'gfm', 'breaks', 'sanitize'],
    fields: {
      markdown: { widget: 'code', language: 'markdown', rows: 14, label: 'Markdown', fullWidth: true },
      gfm: { widget: 'switch', label: 'GitHub 风格语法' },
      breaks: { widget: 'switch', label: '单换行视为换行' },
      sanitize: { widget: 'switch', label: '移除脚本与内联事件' },
    },
    resultAs: 'text',
  },
  execute,
})
