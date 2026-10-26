/** 测试用的内存存储实现：与桌面端 localStorage 行为一致 */
import type { StorageService } from '@matcha-puff/tool-contracts'

export function createMemoryStorage(): StorageService & { dump(): Record<string, unknown> } {
  const map = new Map<string, unknown>()
  return {
    async get<T>(key: string): Promise<T | null> {
      return map.has(key) ? (map.get(key) as T) : null
    },
    async set(key: string, value: unknown): Promise<void> {
      map.set(key, value)
    },
    async remove(key: string): Promise<void> {
      map.delete(key)
    },
    dump() {
      return Object.fromEntries(map)
    },
  }
}
