import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const fileBase64 = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['dataUrl', 'wrap'],
    fields: {
      dataUrl: { widget: 'textarea', label: '文件内容（data URL）', rows: 3 },
      wrap: { widget: 'switch', label: '每 76 字符折行' },
    },
  },
  execute,
})
