import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'notes',
  version: '1.0.0',
  name: '备忘录',
  description: '本地便签：新建、编辑、删除与清空，内容存在本机，关掉应用也还在。',
  category: 'life',
  keywords: ['便签', '备忘录', '笔记', 'notes', '记事'],
  legacyUrls: ['life/efficiency/notes'],
  desktop: {
    icon: 'StickyNote',
    window: { width: 940, height: 660 },
    categories: ['life-efficiency'],
    view: 'NotesTool',
  },
  sideEffects: ['file-write'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
