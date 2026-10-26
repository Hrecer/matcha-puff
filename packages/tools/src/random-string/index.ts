import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const randomString = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['length', 'count', 'uppercase', 'lowercase', 'digits', 'symbols', 'allowDuplicates'],
    fields: {
      length: { widget: 'number', label: '长度' },
      count: { widget: 'number', label: '数量' },
      uppercase: { widget: 'switch', label: '大写字母' },
      lowercase: { widget: 'switch', label: '小写字母' },
      digits: { widget: 'switch', label: '数字' },
      symbols: { widget: 'text', label: '自定义字符' },
      allowDuplicates: { widget: 'switch', label: '允许重复' },
    },
  },
  execute,
})
