import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const fileHash = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['dataUrl', 'uppercase'],
    fields: {
      dataUrl: { widget: 'textarea', label: '文件内容（data URL）', rows: 3 },
      uppercase: { widget: 'switch', label: '大写输出' },
    },
    resultAs: 'table',
  },
  execute,
})
