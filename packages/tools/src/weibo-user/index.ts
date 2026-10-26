import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const weiboUser = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['url'],
    fields: { url: { widget: 'text', label: '微博图片地址' } },
  },
  execute,
})
