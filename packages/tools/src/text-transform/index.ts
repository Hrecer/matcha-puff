import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const textTransform = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'mode', 'trimLines', 'keepEmptyLines', 'search', 'replacement', 'useRegex', 'caseSensitive'],
    fields: {
      text: { widget: 'code', rows: 12, label: '文本', fullWidth: true },
      mode: { widget: 'select', label: '处理方式', help: 'dedupe = 去重，replace = 替换' },
      trimLines: { widget: 'switch', label: '忽略行首尾空白' },
      keepEmptyLines: { widget: 'switch', label: '保留空行' },
      search: { widget: 'text', label: '查找内容', help: '替换模式下必填' },
      replacement: { widget: 'text', label: '替换为', help: '$& 代表匹配到的原文' },
      useRegex: { widget: 'switch', label: '按正则解析查找内容' },
      caseSensitive: { widget: 'switch', label: '区分大小写' },
    },
    resultAs: 'text',
  },
  execute,
})
