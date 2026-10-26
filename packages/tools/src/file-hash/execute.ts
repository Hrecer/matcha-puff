import CryptoJS from 'crypto-js'
import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { decodeDataUrl, humanBytes } from '../shared/dataUrl'
import type { FileHashInput, FileHashOutput } from './schema'

const digest = (bytes: Uint8Array, algorithm: FileHashInput['algorithms'][number]): string => {
  const wordArray = CryptoJS.lib.WordArray.create(bytes as unknown as number[])
  switch (algorithm) {
    case 'MD5':
      return CryptoJS.MD5(wordArray).toString()
    case 'SHA1':
      return CryptoJS.SHA1(wordArray).toString()
    case 'SHA256':
      return CryptoJS.SHA256(wordArray).toString()
    case 'SHA512':
      return CryptoJS.SHA512(wordArray).toString()
  }
}

export function execute(
  input: FileHashInput,
  _context: ToolExecutionContext,
): ToolResult<FileHashOutput> {
  let parts
  try {
    parts = decodeDataUrl(input.dataUrl)
  } catch (error) {
    return toolFail('INVALID_INPUT', error instanceof Error ? error.message : 'data URL 解析失败')
  }

  // 去重但保持用户勾选的顺序
  const algorithms = [...new Set(input.algorithms)]
  const hashes = algorithms.map((algorithm) => {
    const raw = digest(parts.bytes, algorithm)
    const hex = input.uppercase ? raw.toUpperCase() : raw
    return { algorithm, hex, length: hex.length }
  })

  return toolOk({
    mime: parts.mime,
    bytes: parts.bytes.length,
    humanSize: humanBytes(parts.bytes.length),
    hashes,
  })
}
