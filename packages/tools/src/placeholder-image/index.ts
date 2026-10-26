import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const placeholderImage = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['width', 'height', 'background', 'foreground', 'text', 'fontSize', 'backgroundImage', 'format'],
    fields: {
      width: { widget: 'number', label: '宽度' },
      height: { widget: 'number', label: '高度' },
      background: { widget: 'text', label: '底色' },
      foreground: { widget: 'text', label: '文字色' },
      text: { widget: 'text', label: '文字' },
      fontSize: { widget: 'number', label: '字号' },
      backgroundImage: { widget: 'text', label: '背景图 data URL' },
      format: { widget: 'select', label: '格式' },
    },
  },
  execute,
})
