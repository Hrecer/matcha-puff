/**
 * 自定义白噪音的音频本体。
 *
 * 元数据在本地存储里只有几 KB，音频文件动辄数 MB，因此放进 IndexedDB：
 * 它是浏览器原生的二进制仓库，桌面端与预览态都能用，也不占用 localStorage 配额。
 */
const DB_NAME = 'matcha-puff-noise'
const STORE_NAME = 'audio'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
  return dbPromise
}

export async function putNoiseBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  if (!db) throw new Error('当前环境不支持本地音频存储')
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('音频写入失败'))
  })
}

export async function readNoiseBlob(id: string): Promise<Blob | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise<Blob | null>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
    request.onerror = () => resolve(null)
  })
}

export async function removeNoiseBlob(id: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/** 清空全部自定义音频（数据管理里的「清空用户数据」会调用） */
export async function clearNoiseBlobs(): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}
