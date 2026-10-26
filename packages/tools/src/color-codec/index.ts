import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const colorCodec = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['from', 'hex', 'r', 'g', 'b'],
    fields: {
      from: { widget: 'select', label: '输入类型' },
      hex: { widget: 'text', label: '十六进制' },
      r: { widget: 'number', label: '红色 R' },
      g: { widget: 'number', label: '绿色 G' },
      b: { widget: 'number', label: '蓝色 B' },
    },
    resultAs: 'json',
  },
  execute,
})
