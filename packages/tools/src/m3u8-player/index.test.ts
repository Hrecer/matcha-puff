import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'm3u8-player', caller: 'ui' })

describe('m3u8-player', () => {
  it('识别 m3u8 与普通视频', () => {
    const hls = execute({ url: 'https://example.com/live/index.m3u8?token=1' }, context)
    if (!hls.ok) throw new Error(hls.error.message)
    expect(hls.data.format).toBe('hls')

    const mp4 = execute({ url: 'https://example.com/video.mp4' }, context)
    if (!mp4.ok) throw new Error(mp4.error.message)
    expect(mp4.data.format).toBe('video')
  })

  it('拒绝 RTMP 并提示浏览器限制', () => {
    const result = execute({ url: 'rtmp://live.example.com/app/stream' }, context)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
      expect(result.error.message).toContain('RTMP')
    }
  })
})
