import { z } from 'zod'

/** 三个加密类工具共用的算法枚举 */
export const digestAlgorithmSchema = z.enum([
  'MD5',
  'SHA1',
  'SHA224',
  'SHA256',
  'SHA384',
  'SHA512',
  'SHA3',
  'RIPEMD160',
])

export const cipherAlgorithmSchema = z.enum(['AES', 'DES', 'TripleDES', 'RC4', 'Rabbit'])
export const cipherModeSchema = z.enum(['CBC', 'ECB', 'CFB', 'OFB', 'CTR']).default('CBC')
export const paddingSchema = z
  .enum(['Pkcs7', 'ZeroPadding', 'Iso97971', 'AnsiX923', 'NoPadding'])
  .default('Pkcs7')
