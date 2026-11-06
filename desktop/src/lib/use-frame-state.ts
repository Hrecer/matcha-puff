import { useEffect, useSyncExternalStore } from 'react'
import { frameState, inTauri, listen, type FrameState } from '@/ipc/bridge'

/**
 * 窗口贴靠态：Rust 按窗口矩形 + 显示器工作区几何判定，拖动/缩放循环里只许脱开。
 * 页面挂载时主动查一次（事件在挂载前可能已经发过），之后只吃定向事件。
 */
const floating: FrameState = { maximized: false, tiled: false }
let current: FrameState = floating
let started = false
const subscribers = new Set<() => void>()

function publish(next: FrameState) {
  if (next.maximized === current.maximized && next.tiled === current.tiled) return
  current = next
  for (const notify of subscribers) notify()
}

function subscribe(notify: () => void) {
  subscribers.add(notify)
  return () => {
    subscribers.delete(notify)
  }
}

function getSnapshot() {
  return current
}

function start() {
  if (started || !inTauri()) return
  started = true
  listen<FrameState>('frame:state', (next) => {
    if (next) publish(next)
  })
  frameState()
    .then((next) => {
      if (next) publish(next)
    })
    .catch(() => {})
}

export function useFrameState(): FrameState {
  useEffect(start, [])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * 最大化/还原的乐观切换：原生几何提交到事件回来之间先换外壳。
 * 还原时保持 tiled 不动 —— 窗口可能还原回贴靠位；真正的目标由事件修正。
 */
export function expectMaximized(maximized: boolean) {
  publish({ maximized, tiled: maximized || current.tiled })
}
