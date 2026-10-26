/** 专注音频：白噪音循环 + 完成提示音。浏览器预览不会触发（store 不启动）。 */
import { DEFAULT_RING, type RingSettings } from '@matcha-puff/pomodoro-core'

const BASE = `${import.meta.env.BASE_URL}audio/pomodoro`

let noiseAudio: HTMLAudioElement | null = null
let previewAudio: HTMLAudioElement | null = null
/** 正在试听的行；换一首或点停止时清空，按钮据此在「试听/停止」间切换 */
let previewOwner: string | null = null
const previewListeners = new Set<() => void>()

function isSilent(name: string | undefined): boolean {
  return !name || name === '0'
}

/**
 * 只有主窗口发声。
 *
 * 挂件（widget）和托盘菜单（traymenu）都会 initFocusSync 订阅同一份快照，
 * 它们要是跟着播，就会变成两道声音叠着响 —— 听起来节奏发乱、像被加快了一样。
 * 发声点统一在这里挡掉，镜像窗口只负责显示。
 */
function isSilentWindow(): boolean {
  type Meta = { __TAURI_METADATA__?: { __currentWindow?: { label?: string } } }
  const label = (window as unknown as Meta).__TAURI_METADATA__?.__currentWindow?.label
  // 浏览器预览读不到注入的标签，照常播放（设置页试听走的是另一条路径）
  if (!label) return false
  return label !== 'main'
}

/**
 * 白噪音循环：MP3 不带 loop 元数据，末尾 0.3 秒回绕实现无缝循环
 * （不用 loop=true，由代码控制回绕点）。
 */
function onTimeUpdate(event: Event) {
  const el = event.target as HTMLAudioElement
  if (el.duration && el.currentTime > el.duration - 0.3) {
    el.currentTime = 0
    void el.play().catch(() => {})
  }
}

export function playNoise(name: string): void {
  if (isSilent(name) || isSilentWindow()) return
  stopNoise()
  const audio = new Audio(`${BASE}/noise/${name}.mp3`)
  audio.preload = 'auto'
  audio.addEventListener('timeupdate', onTimeUpdate)
  noiseAudio = audio
  void audio.play().catch(() => {
    // 自动流转没有用户手势时可能被拒绝；不阻塞计时。
  })
}

export function stopNoise(): void {
  if (!noiseAudio) return
  noiseAudio.pause()
  noiseAudio.removeEventListener('timeupdate', onTimeUpdate)
  noiseAudio = null
}

export function playNotify(name: string): void {
  if (isSilent(name) || isSilentWindow()) return
  const audio = new Audio(`${BASE}/notify/${name}.mp3`)
  audio.preload = 'auto'
  void audio.play().catch(() => {})
}

/**
 * 到点响铃。
 *
 * 只有默认的「闹铃」会一直循环（像计时器那样，响到你动手为止）；
 * 其余提示音各响一遍就停 —— 那些音色本来就是"叮"一下的短音，一直循环很吵。
 *
 * 不管响几遍，「时间到」这个状态本身都要用户确认才会离开。
 */
let ringAudio: HTMLAudioElement | null = null

export function startRing(name: string): void {
  if (isSilent(name) || isSilentWindow() || ringAudio) return
  const audio = new Audio(`${BASE}/notify/${name}.mp3`)
  audio.preload = 'auto'
  audio.loop = name === DEFAULT_RING.pomodoroNotify
  ringAudio = audio
  void audio.play().catch(() => {
    // 没有用户手势时可能被拒绝；界面上的「时间到」仍然醒目，不阻塞流程
  })
}

export function stopRing(): void {
  if (!ringAudio) return
  ringAudio.pause()
  ringAudio.currentTime = 0
  ringAudio = null
}

function emitPreview(): void {
  for (const listener of previewListeners) listener()
}

export function subscribePreview(listener: () => void): () => void {
  previewListeners.add(listener)
  return () => {
    previewListeners.delete(listener)
  }
}

export function getPreviewOwner(): string | null {
  return previewOwner
}

/** 停掉设置页试听；正在播放的通知/白噪音不受影响 */
export function stopPreview(): void {
  if (previewAudio) {
    previewAudio.pause()
    previewAudio = null
  }
  if (previewOwner !== null) {
    previewOwner = null
    emitPreview()
  }
}

/**
 * 设置页试听：不打断正在播放的白噪音。
 * owner 用来让对应那一行显示「停止」；同一时间只留一条试听，
 * 换一首或点停止时旧音频立即结束。
 */
export function previewSound(kind: 'noise' | 'notify', name: string, owner: string): void {
  stopPreview()
  if (isSilent(name)) return
  const audio = new Audio(`${BASE}/${kind}/${name}.mp3`)
  audio.preload = 'auto'
  previewAudio = audio
  previewOwner = owner
  audio.addEventListener('ended', () => {
    if (previewAudio !== audio) return
    previewAudio = null
    previewOwner = null
    emitPreview()
  })
  emitPreview()
  void audio.play().catch(() => {
    if (previewAudio !== audio) return
    previewAudio = null
    previewOwner = null
    emitPreview()
  })
}

/** 阶段切换时同步声音：专注/休息各用各的白噪音，暂停与结束静音 */
export function syncPhaseAudio(
  prevPhase: string,
  nextPhase: string,
  ring: RingSettings,
): void {
  // 挂件是镜像窗口，音响交给主窗口
  if (isSilentWindow()) return
  if (prevPhase === 'awaiting' && nextPhase !== 'awaiting') stopRing()
  if (nextPhase === 'awaiting' && prevPhase !== 'awaiting') {
    stopNoise()
    startRing(ring.pomodoroNotify)
    return
  }
  if (nextPhase === 'focus' && prevPhase !== 'focus') {
    playNoise(ring.whiteNoise)
    return
  }
  if (nextPhase === 'rest' && prevPhase !== 'rest') {
    playNoise(ring.restNoise)
    return
  }
  if (nextPhase === 'paused' && prevPhase !== 'paused') {
    stopNoise()
    return
  }
  if (nextPhase === 'idle' && prevPhase !== 'idle') {
    stopNoise()
  }
}
