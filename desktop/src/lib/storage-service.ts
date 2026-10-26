/** 工具私有存储：落在 localStorage，键统一加前缀，避免和设置、其他数据撞车 */
import type { StorageService } from '@matcha-puff/tool-contracts'

const PREFIX = 'matcha-puff/tool-data/'

export const browserStorageService: StorageService = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw === null ? null : (JSON.parse(raw) as T)
    } catch {

      return null
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  },
  async remove(key: string): Promise<void> {
    localStorage.removeItem(PREFIX + key)
  },
}
