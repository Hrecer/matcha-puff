import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'weibo-user',
  version: '1.0.0',
  name: '微博反查图片上传者',
  description: '粘贴 sinaimg.cn 图片地址，从文件名解析微博用户 ID 与主页；全程离线，不发请求。',
  category: 'life',
  keywords: ['微博', '图片', '用户ID', 'sinaimg', '反查'],
  legacyUrls: ['life/query/weibouser'],
  desktop: {
    icon: 'Share2',
    window: { width: 590, height: 210 },
    categories: ['life-query'],
    view: 'WeiboUserTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
