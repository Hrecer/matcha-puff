import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RingSettings } from '@matcha-puff/pomodoro-core'

/** 只记录创建/暂停：验证「改完设置立即换声音」不依赖真实播放器 */
class FakeAudio {
  static created: FakeAudio[] = []
  src: string
  paused = false
  loop = false
  preload = ''
  currentTime = 0
  duration = 0

  constructor(src?: string) {
    this.src = src ?? ''
    FakeAudio.created.push(this)
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  play(): Promise<void> {
    return Promise.resolve()
  }
  pause(): void {
    this.paused = true
  }
}

function ring(patch: Partial<RingSettings> = {}): RingSettings {
  return { pomodoroNotify: 'alarm', whiteNoise: '0', restNoise: '0', ...patch }
}

/** 模块内有「当前播放的音频」状态：每个用例重新加载，互不影响 */
async function loadAudio() {
  vi.resetModules()
  return import('./focus-audio')
}

beforeEach(() => {
  FakeAudio.created = []
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('window', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('syncPhaseAudio', () => {
  it('专注中改专注白噪音：立即换成新声音，不用等暂停再继续', async () => {
    const { syncPhaseAudio } = await loadAudio()
    const prev = ring({ whiteNoise: 'jQpJWmyq' })
    const next = ring({ whiteNoise: 'QFkLKbSx' })

    syncPhaseAudio('idle', 'focus', prev, prev)
    expect(FakeAudio.created).toHaveLength(1)

    syncPhaseAudio('focus', 'focus', next, prev)
    expect(FakeAudio.created).toHaveLength(2)
    expect(FakeAudio.created[1]!.src).toContain('/noise/QFkLKbSx.mp3')
    expect(FakeAudio.created[0]!.paused).toBe(true)
  })

  it('专注中把白噪音改成「无」：立即停掉当前声音', async () => {
    const { syncPhaseAudio } = await loadAudio()
    const playing = ring({ whiteNoise: 'QFkLKbSx' })
    const silent = ring({ whiteNoise: '0' })

    syncPhaseAudio('idle', 'focus', playing, playing)
    syncPhaseAudio('focus', 'focus', silent, playing)

    expect(FakeAudio.created).toHaveLength(1)
    expect(FakeAudio.created[0]!.paused).toBe(true)
  })

  it('休息中改休息白噪音：立即换成新声音', async () => {
    const { syncPhaseAudio } = await loadAudio()
    const prev = ring({ restNoise: 'zEHBgStQ' })
    const next = ring({ restNoise: 'rgIZXUJF' })

    syncPhaseAudio('idle', 'rest', prev, prev)
    syncPhaseAudio('rest', 'rest', next, prev)

    expect(FakeAudio.created[1]!.src).toContain('/noise/rgIZXUJF.mp3')
  })

  it('专注中只改休息白噪音：当前专注声音不受影响', async () => {
    const { syncPhaseAudio } = await loadAudio()
    const prev = ring({ whiteNoise: 'QFkLKbSx' })
    const next = ring({ whiteNoise: 'QFkLKbSx', restNoise: 'zEHBgStQ' })

    syncPhaseAudio('idle', 'focus', prev, prev)
    syncPhaseAudio('focus', 'focus', next, prev)

    expect(FakeAudio.created).toHaveLength(1)
    expect(FakeAudio.created[0]!.paused).toBe(false)
  })

  it('暂停中改设置不发声，继续后再按新设置播放', async () => {
    const { syncPhaseAudio } = await loadAudio()
    const prev = ring({ whiteNoise: 'jQpJWmyq' })
    const next = ring({ whiteNoise: 'QFkLKbSx' })

    syncPhaseAudio('paused', 'paused', next, prev)
    expect(FakeAudio.created).toHaveLength(0)

    syncPhaseAudio('paused', 'focus', next, next)
    expect(FakeAudio.created[0]!.src).toContain('/noise/QFkLKbSx.mp3')
  })
})
