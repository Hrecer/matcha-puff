import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'content-type',
  version: '1.0.0',
  name: 'Content-Type查询',
  description: '66 个常见文件扩展名与 MIME 类型对照，支持按扩展名、MIME 或用途反查。',
  category: 'coding',
  keywords: ['Content-Type', 'MIME', '扩展名', '媒体类型', 'contenttype'],
  legacyUrls: ['programmer/query/contenttypequery'],
  desktop: {
    icon: 'FileType',
    window: { width: 880, height: 640 },
    categories: ['coding-query'],
    view: 'ContentTypeTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
