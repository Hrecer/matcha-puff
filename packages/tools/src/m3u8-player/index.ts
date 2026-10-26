import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const m3u8Player = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['url'],
    fields: { url: { widget: 'text', label: '视频地址' } },
  },
  execute,
})
