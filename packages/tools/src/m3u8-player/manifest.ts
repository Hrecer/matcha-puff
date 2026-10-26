import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'm3u8-player',
  version: '1.0.0',
  name: 'M3U8播放器',
  description: '输入 HTTP(S) 的 M3U8 或常见视频地址，本地用 hls.js 播放，支持倍速、循环与全屏。',
  category: 'life',
  keywords: ['M3U8', 'HLS', '视频播放', '直播', 'player'],
  legacyUrls: ['life/picvideo/videoplayer'],
  desktop: {
    icon: 'Play',
    window: { width: 1000, height: 460 },
    categories: ['life-image-video'],
    view: 'M3u8PlayerTool',
  },
  sideEffects: ['network-read'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
