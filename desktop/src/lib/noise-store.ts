/**
 * 白噪音状态与播放内核。
 *
 * 播放列表只活在内存；喜欢、音量、合集和自定义声音的元数据写入本地存储。
 * 所有音频对象都由这里创建和销毁，页面切换不会中断正在播放的声音。
 */
import { useSyncExternalStore } from 'react'
import { toast } from '@/components/ui/toast'
import { BUILTIN_NOISE, noiseCategory, noiseSource } from '@/data/noise-library'
import type { NoiseCategoryId, NoiseTrack } from '@/data/noise-library'
import { putNoiseBlob, readNoiseBlob, removeNoiseBlob } from './noise-blob'
import {
  loadCustomNoise,
  loadNoiseCollections,
  loadNoisePrefs,
  saveCustomNoise,
  saveNoiseCollections,
  saveNoisePrefs,
} from './noise-storage'
import type { CustomNoiseRecord, NoiseCollectionRecord } from './noise-storage'

export interface PlayingNoise {
  track: NoiseTrack
  addedAt: number
}

interface NoiseState {
  favorites: string[]
  volumes: Record<string, number>
  master: number
  custom: CustomNoiseRecord[]
  collections: NoiseCollectionRecord[]
  playing: PlayingNoise[]
}

const initialPrefs = loadNoisePrefs()

/** 总音量的出厂值 */
const DEFAULT_MASTER = 100

let state: NoiseState = {
  favorites: initialPrefs.favorites,
  volumes: initialPrefs.volumes,
  master: initialPrefs.master,
  custom: loadCustomNoise(),
  collections: loadNoiseCollections(),
  playing: [],
}

const listeners = new Set<() => void>()
const audioMap = new Map<string, HTMLAudioElement>()
const blobUrls = new Map<string, string>()

function emit(patch: Partial<NoiseState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): NoiseState => state

export function useNoiseStore(): NoiseState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function persistPrefs(): void {
  saveNoisePrefs({ favorites: state.favorites, volumes: state.volumes, master: state.master })
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function customToTrack(record: CustomNoiseRecord): NoiseTrack {
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    volume: record.volume,
    builtin: false,
    icon: noiseCategory(record.category).icon,
  }
}

/** 内置声音 + 自定义声音的完整目录，顺序为先内置后自定义 */
export function allNoiseTracks(): NoiseTrack[] {
  return [...BUILTIN_NOISE, ...state.custom.map(customToTrack)]
}

export function findNoiseTrack(id: string): NoiseTrack | undefined {
  return allNoiseTracks().find((track) => track.id === id)
}

/** 某个声音当前的音量：本轮调过用调后的值，否则回到它自己的默认值 */
export function noiseTrackVolume(track: NoiseTrack): number {
  return state.volumes[track.id] ?? track.volume
}

function effectiveVolume(track: NoiseTrack): number {
  return (noiseTrackVolume(track) / 100) * (clampVolume(state.master) / 100)
}

async function customSource(id: string): Promise<string> {
  const cached = blobUrls.get(id)
  if (cached) return cached
  const blob = await readNoiseBlob(id)
  if (!blob) return ''
  const url = URL.createObjectURL(blob)
  blobUrls.set(id, url)
  return url
}

/** 停掉一个音频对象：解绑错误回调 → 暂停 → 释放源，避免它继续占着解码资源 */
function silence(audio: HTMLAudioElement): void {
  audio.onerror = null
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

function fail(id: string, title: string): void {
  const audio = audioMap.get(id)
  if (!audio) return
  audioMap.delete(id)
  silence(audio)
  emit({ playing: state.playing.filter((item) => item.track.id !== id) })
  toast(`${title} 无法播放，文件可能已丢失`, 'error')
}

/** 播放一段声音；已在播放时忽略 */
export async function playNoise(id: string): Promise<void> {
  if (audioMap.has(id)) return
  const track = findNoiseTrack(id)
  if (!track) return
  const src = track.builtin && track.file ? noiseSource(track.file) : await customSource(id)
  if (!src) {
    toast('自定义声音文件缺失，请重新导入', 'error')
    return
  }
  // 读取自定义音频是异步的：等待期间可能已被再次点击或删除
  if (audioMap.has(id) || !findNoiseTrack(id)) return

  const audio = new Audio()
  audio.loop = true
  audio.preload = 'auto'
  audio.src = src
  audio.volume = effectiveVolume(track)
  audio.onerror = () => fail(id, track.title)
  audioMap.set(id, audio)
  emit({ playing: [...state.playing, { track, addedAt: Date.now() }] })
  try {
    await audio.play()
  } catch {
    fail(id, track.title)
  }
}

export function stopNoise(id: string): void {
  const audio = audioMap.get(id)
  if (!audio) return
  audioMap.delete(id)
  silence(audio)
  emit({ playing: state.playing.filter((item) => item.track.id !== id) })
}

export function toggleNoise(id: string): void {
  if (audioMap.has(id)) {
    stopNoise(id)
    return
  }
  void playNoise(id)
}

export function stopAllNoise(): void {
  if (audioMap.size === 0) return
  for (const audio of audioMap.values()) silence(audio)
  audioMap.clear()
  emit({ playing: [] })
}

/** 调整单段声音音量（0-100），同时保存为用户偏好 */
export function setNoiseVolume(id: string, value: number): void {
  const next = clampVolume(value)
  emit({ volumes: { ...state.volumes, [id]: next } })
  persistPrefs()
  const audio = audioMap.get(id)
  const track = findNoiseTrack(id)
  if (audio && track) audio.volume = effectiveVolume(track)
}

/** 总音量（0-100）：按比例缩放所有正在播放的声音 */
export function setMasterVolume(value: number): void {
  const next = clampVolume(value)
  emit({ master: next })
  persistPrefs()
  for (const [id, audio] of audioMap) {
    const track = findNoiseTrack(id)
    if (track) audio.volume = effectiveVolume(track)
  }
}

/** 打回出厂值：每段声音回到自己的默认音量、总音量回 100%。喜欢、合集、自定义声音一概不动 */
export function resetNoiseVolumes(): void {
  emit({ volumes: {}, master: DEFAULT_MASTER })
  persistPrefs()
  for (const [id, audio] of audioMap) {
    const track = findNoiseTrack(id)
    if (track) audio.volume = effectiveVolume(track)
  }
}

export function toggleNoiseFavorite(id: string): void {
  const favorites = state.favorites.includes(id)
    ? state.favorites.filter((item) => item !== id)
    : [...state.favorites, id]
  emit({ favorites })
  persistPrefs()
}

/** 把当前正在播放的声音保存成合集；没有播放内容时返回 false */
export function saveNoiseCollection(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed || state.playing.length === 0) return false
  const record: NoiseCollectionRecord = {
    id: `collection-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
    createdAt: Date.now(),
    trackIds: [...new Set(state.playing.map((item) => item.track.id))],
  }
  const collections = [record, ...state.collections]
  saveNoiseCollections(collections)
  emit({ collections })
  return true
}

/**
 * 播放合集。
 *
 * 不能「一段一段 await play()」——那样每段都要等上一段真正出声才轮到下一段，
 * 卡片会一个一个冒出来（看起来像卡顿）。这里分三步：
 *   1. 先静默停掉当前声音（不发通知，免得中途闪一下空列表）；
 *   2. 并行解析所有音源（自定义声音要读 IndexedDB），一次性上屏；
 *   3. 再并行启动播放，谁先缓冲好谁先出声。
 */
export async function playNoiseCollection(id: string): Promise<void> {
  const record = state.collections.find((item) => item.id === id)
  if (!record) return

  // 1. 静默停掉当前所有声音
  for (const audio of audioMap.values()) silence(audio)
  audioMap.clear()

  const tracks: NoiseTrack[] = []
  for (const trackId of new Set(record.trackIds)) {
    const track = findNoiseTrack(trackId)
    if (track) tracks.push(track)
  }

  // 2. 并行解析音源
  let missing = 0
  const prepared = await Promise.all(
    tracks.map(async (track) => {
      const src = track.builtin && track.file ? noiseSource(track.file) : await customSource(track.id)
      if (!src) missing += 1
      return src ? { track, src } : null
    }),
  )

  const started: { track: NoiseTrack; audio: HTMLAudioElement }[] = []
  for (const entry of prepared) {
    if (!entry) continue
    const { track, src } = entry
    // 等待期间可能已被删除
    if (!findNoiseTrack(track.id)) continue
    const audio = new Audio()
    audio.loop = true
    audio.preload = 'auto'
    audio.src = src
    audio.volume = effectiveVolume(track)
    audio.onerror = () => fail(track.id, track.title)
    audioMap.set(track.id, audio)
    started.push({ track, audio })
  }

  if (missing > 0) {
    toast(`有 ${missing} 段自定义声音文件缺失，请重新导入`, 'error')
  }
  if (started.length === 0) {
    emit({ playing: [] })
    return
  }

  // 3. 一次性上屏
  const at = Date.now()
  emit({ playing: started.map(({ track }) => ({ track, addedAt: at })) })

  // 4. 并行启动，不再互相排队
  const results = await Promise.allSettled(started.map(({ audio }) => audio.play()))
  results.forEach((result, index) => {
    if (result.status === 'rejected') fail(started[index].track.id, started[index].track.title)
  })
}

export function deleteNoiseCollection(id: string): void {
  const collections = state.collections.filter((item) => item.id !== id)
  saveNoiseCollections(collections)
  emit({ collections })
}

/** 拖动排序后落库：按给定的 id 顺序重排合集；传入列表漏掉的补在末尾，避免丢数据 */
export function reorderNoiseCollections(nextIds: string[]): void {
  const byId = new Map(state.collections.map((item) => [item.id, item]))
  const collections = nextIds
    .map((id) => byId.get(id))
    .filter((item): item is NoiseCollectionRecord => Boolean(item))
  for (const item of state.collections) {
    if (!nextIds.includes(item.id)) collections.push(item)
  }
  saveNoiseCollections(collections)
  emit({ collections })
}

/** 整表替换合集（开发种子数据用）：落库并立即通知界面，不需要刷新页面 */
export function replaceNoiseCollections(records: NoiseCollectionRecord[]): void {
  saveNoiseCollections(records)
  emit({ collections: records })
}

export interface CustomNoiseInput {
  title: string
  category: NoiseCategoryId
  volume: number
  blob: Blob
}

/** 新增自定义声音：音频本体写入 IndexedDB，元数据写入本地存储 */
export async function addCustomNoise(input: CustomNoiseInput): Promise<string | null> {
  const title = input.title.trim()
  if (!title) return null
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  try {
    await putNoiseBlob(id, input.blob)
  } catch {
    toast('音频保存失败，请重试', 'error')
    return null
  }
  const record: CustomNoiseRecord = {
    id,
    title,
    category: input.category,
    volume: clampVolume(input.volume),
    createdAt: Date.now(),
  }
  const custom = [...state.custom, record]
  saveCustomNoise(custom)
  emit({ custom })
  return id
}

/**
 * 删除自定义声音。
 *
 * 连带清理三处引用，避免留下指向「已经不存在的 id」的死数据：
 *  1. 合集：从各合集的 trackIds 里摘掉这一段；**摘空的合集直接删除**——
 *     合集是「一组声音」的名字，组里一段都没有了，留着只会变成空壳；
 *  2. 喜欢：把这个 id 从喜欢列表里去掉，喜欢列表里它随即消失；
 *  3. 音量偏好：把这一条删掉，免得键值表越攒越大。
 */
export async function removeCustomNoise(id: string): Promise<{ removedCollections: number }> {
  stopNoise(id)
  // 兜底：万一有音频对象没按这个 id 记账（比如热更新前建的），
  // 只要它的源指向这个声音的 blob URL，也一并停掉，避免「删了还在响」
  const cachedUrl = blobUrls.get(id)
  if (cachedUrl) {
    for (const [key, audio] of [...audioMap]) {
      if (audio.src === cachedUrl) {
        audioMap.delete(key)
        silence(audio)
      }
    }
    // 清扫掉的条目要从「正在播放」里同步移除，否则会留下没有音频的空行
    if (state.playing.some((item) => !audioMap.has(item.track.id))) {
      emit({ playing: state.playing.filter((item) => audioMap.has(item.track.id)) })
    }
  }
  const url = blobUrls.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    blobUrls.delete(id)
  }
  await removeNoiseBlob(id)
  const beforeCollectionCount = state.collections.length
  const custom = state.custom.filter((item) => item.id !== id)
  const collections = state.collections
    .map((item) => ({ ...item, trackIds: item.trackIds.filter((trackId) => trackId !== id) }))
    .filter((item) => item.trackIds.length > 0)
  const favorites = state.favorites.filter((item) => item !== id)
  const volumes = { ...state.volumes }
  delete volumes[id]
  saveCustomNoise(custom)
  saveNoiseCollections(collections)
  saveNoisePrefs({ favorites, volumes, master: state.master })
  emit({ custom, collections, favorites, volumes })
  // 告诉调用方有没有合集被顺手删掉，好给一句明确的提示
  return { removedCollections: beforeCollectionCount - collections.length }
}

/**
 * 开发期热更新的收尾（生产构建里 import.meta.hot 是 undefined，整段不生效）。
 *
 * 模块被替换时 audioMap 会重建，但旧模块里那些 <audio> 元素还在浏览器里响，
 * 变成「孤儿音频」——删掉对应声音也停不掉它（表现为「删了还在播」）。
 * 所以在 dispose 时先把它们全部静音。
 */
const hotContext = (
  import.meta as ImportMeta & { hot?: { dispose?: (cb: () => void) => void } }
).hot
hotContext?.dispose?.(() => {
  for (const audio of audioMap.values()) silence(audio)
  audioMap.clear()
})
