import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'github-trending',
  version: '1.0.0',
  name: 'GitHub趋势榜',
  description: '按语言和月/周/天查看 GitHub Trending 项目，显示描述、星标、Fork 与新增关注。',
  category: 'coding',
  keywords: ['GitHub', '趋势榜', 'trending', '开源项目'],
  legacyUrls: ['programmer/query/githubtrending'],
  desktop: {
    icon: 'GitBranch',
    window: { width: 800, height: 600 },
    categories: ['coding-query'],
    view: 'GithubTrendingTool',
  },
  sideEffects: ['network-read'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
