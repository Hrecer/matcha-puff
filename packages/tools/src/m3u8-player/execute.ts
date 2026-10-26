import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { M3u8PlayerInput, M3u8PlayerOutput } from './schema'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v'])

export function execute(
  input: M3u8PlayerInput,
  _context: ToolExecutionContext,
): ToolResult<M3u8PlayerOutput> {
  let url: URL
  try {
    url = new URL(input.url.trim())
  } catch {
    return toolFail('INVALID_INPUT', '视频地址不正确，请检查后重试')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return toolFail('INVALID_INPUT', '仅支持 HTTP(S) 地址；浏览器内核无法播放 RTMP')
  }

  const path = url.pathname.toLowerCase()
  const extension = path.match(/\.[a-z0-9]+$/)?.[0] ?? ''
  if (path.endsWith('.m3u8') || url.href.toLowerCase().includes('.m3u8')) {
    return toolOk({
      url: url.toString(),
      format: 'hls',
      extension: '.m3u8',
      note: 'HLS 流由 hls.js 在本地解码播放。',
    })
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return toolOk({
      url: url.toString(),
      format: 'video',
      extension,
      note: '浏览器原生视频，直接交给 video 标签播放。',
    })
  }
  if (extension === '.flv' || extension === '.rtmp') {
    return toolOk({
      url: url.toString(),
      format: 'unsupported',
      extension,
      note: '当前播放器不支持 FLV/RTMP，请使用 M3U8 或 MP4/WebM。',
    })
  }
  return toolOk({
    url: url.toString(),
    format: 'video',
    extension,
    note: '未识别出扩展名，按普通视频地址尝试播放。',
  })
}
