import CryptoJS from 'crypto-js'








export type DigestAlgorithm =
  | 'MD5'
  | 'SHA1'
  | 'SHA224'
  | 'SHA256'
  | 'SHA384'
  | 'SHA512'
  | 'SHA3'
  | 'RIPEMD160'

export const DIGEST_ALGORITHMS: { value: DigestAlgorithm; label: string; bits: number }[] = [
  { value: 'MD5', label: 'MD5（128 位）', bits: 128 },
  { value: 'SHA1', label: 'SHA-1（160 位）', bits: 160 },
  { value: 'SHA224', label: 'SHA-224', bits: 224 },
  { value: 'SHA256', label: 'SHA-256', bits: 256 },
  { value: 'SHA384', label: 'SHA-384', bits: 384 },
  { value: 'SHA512', label: 'SHA-512', bits: 512 },
  { value: 'SHA3', label: 'SHA-3（256 位）', bits: 256 },
  { value: 'RIPEMD160', label: 'RIPEMD-160', bits: 160 },
]

export function digest(text: string, algorithm: DigestAlgorithm): string {
  switch (algorithm) {
    case 'MD5':
      return CryptoJS.MD5(text).toString()
    case 'SHA1':
      return CryptoJS.SHA1(text).toString()
    case 'SHA224':
      return CryptoJS.SHA224(text).toString()
    case 'SHA256':
      return CryptoJS.SHA256(text).toString()
    case 'SHA384':
      return CryptoJS.SHA384(text).toString()
    case 'SHA512':
      return CryptoJS.SHA512(text).toString()
    case 'SHA3':
      return CryptoJS.SHA3(text).toString()
    case 'RIPEMD160':
      return CryptoJS.RIPEMD160(text).toString()
  }
}

/** HMAC：同一组算法，多一个密钥 */
export function hmacDigest(text: string, key: string, algorithm: DigestAlgorithm): string {
  switch (algorithm) {
    case 'MD5':
      return CryptoJS.HmacMD5(text, key).toString()
    case 'SHA1':
      return CryptoJS.HmacSHA1(text, key).toString()
    case 'SHA224':
      return CryptoJS.HmacSHA224(text, key).toString()
    case 'SHA256':
      return CryptoJS.HmacSHA256(text, key).toString()
    case 'SHA384':
      return CryptoJS.HmacSHA384(text, key).toString()
    case 'SHA512':
      return CryptoJS.HmacSHA512(text, key).toString()
    case 'SHA3':
      return CryptoJS.HmacSHA3(text, key).toString()
    case 'RIPEMD160':
      return CryptoJS.HmacRIPEMD160(text, key).toString()
  }
}

export type CipherAlgorithm = 'AES' | 'DES' | 'TripleDES' | 'RC4' | 'Rabbit'

export const CIPHERS: {
  value: CipherAlgorithm
  label: string
  /** 密钥字节长度要求，留空表示不限 */
  keyBytes: number[]
  blockBytes: number
}[] = [
  { value: 'AES', label: 'AES', keyBytes: [16, 24, 32], blockBytes: 16 },
  { value: 'DES', label: 'DES', keyBytes: [8], blockBytes: 8 },
  { value: 'TripleDES', label: '3DES（TripleDES）', keyBytes: [16, 24], blockBytes: 8 },
  { value: 'RC4', label: 'RC4（流密码，无模式与填充）', keyBytes: [], blockBytes: 0 },
  { value: 'Rabbit', label: 'Rabbit（流密码，16 字节密钥）', keyBytes: [16], blockBytes: 0 },
]

export type CipherMode = 'CBC' | 'ECB' | 'CFB' | 'OFB' | 'CTR'
export type PaddingName = 'Pkcs7' | 'ZeroPadding' | 'Iso97971' | 'AnsiX923' | 'NoPadding'

const MODE_MAP = {
  CBC: CryptoJS.mode.CBC,
  ECB: CryptoJS.mode.ECB,
  CFB: CryptoJS.mode.CFB,
  OFB: CryptoJS.mode.OFB,
  CTR: CryptoJS.mode.CTR,
} as const

const PADDING_MAP = {
  Pkcs7: CryptoJS.pad.Pkcs7,
  ZeroPadding: CryptoJS.pad.ZeroPadding,
  Iso97971: CryptoJS.pad.Iso97971,
  AnsiX923: CryptoJS.pad.AnsiX923,
  NoPadding: CryptoJS.pad.NoPadding,
} as const

/** 把密钥/IV 按指定格式变成 WordArray；utf8 就是原始字节 */
export function parseKey(value: string, format: 'utf8' | 'hex'): CryptoJS.lib.WordArray {
  if (format === 'hex') {
    const cleaned = value.replace(/[^0-9a-fA-F]/g, '')
    if (cleaned.length % 2 !== 0) throw new Error('十六进制密钥长度必须是偶数')
    return CryptoJS.enc.Hex.parse(cleaned)
  }
  return CryptoJS.enc.Utf8.parse(value)
}

export interface CipherOptions {
  algorithm: CipherAlgorithm
  key: string
  iv?: string
  mode: CipherMode
  padding: PaddingName
  keyFormat: 'utf8' | 'hex'
  output: 'base64' | 'hex'
}

/** 对称加解密；RC4/Rabbit 是流密码，忽略模式与填充 */
export function cipher(
  text: string,
  options: CipherOptions,
  operation: 'encrypt' | 'decrypt',
): string {
  const spec = CIPHERS.find((item) => item.value === options.algorithm)
  if (!spec) throw new Error(`不支持的算法：${options.algorithm}`)

  const key = parseKey(options.key, options.keyFormat)
  if (spec.keyBytes.length && !spec.keyBytes.includes(key.sigBytes)) {
    throw new Error(`${spec.label} 的密钥必须是 ${spec.keyBytes.join(' / ')} 字节，当前是 ${key.sigBytes} 字节`)
  }

  const isStream = spec.blockBytes === 0
  const encryptor =
    options.algorithm === 'AES'
      ? CryptoJS.AES
      : options.algorithm === 'DES'
        ? CryptoJS.DES
        : options.algorithm === 'TripleDES'
          ? CryptoJS.TripleDES
          : options.algorithm === 'RC4'
            ? CryptoJS.RC4
            : CryptoJS.Rabbit

  const config: Parameters<typeof CryptoJS.AES.encrypt>[2] = isStream
    ? {}
    : { mode: MODE_MAP[options.mode], padding: PADDING_MAP[options.padding] }

  if (!isStream && options.mode !== 'ECB') {
    const provided = options.iv ? parseKey(options.iv, options.keyFormat) : null
    // 没给 IV 时用全零 IV，保证同一密钥同一明文结果稳定
    const iv = provided ?? CryptoJS.lib.WordArray.create(new Uint8Array(spec.blockBytes))
    if (iv.sigBytes !== spec.blockBytes) {
      throw new Error(`${spec.label} 的 IV 必须是 ${spec.blockBytes} 字节，当前是 ${iv.sigBytes} 字节`)
    }
    config.iv = iv
  }

  if (operation === 'encrypt') {
    const encrypted = encryptor.encrypt(text, key, config)
    return options.output === 'hex'
      ? encrypted.ciphertext.toString(CryptoJS.enc.Hex)
      : encrypted.toString()
  }

  // 解密：先按输出格式还原密文（流密码与块密码走同一条路）
  const payload =
    options.output === 'hex'
      ? CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Hex.parse(text.trim()) })
      : text.trim()
  const decrypted = encryptor.decrypt(payload as unknown as string, key, config)
  return decrypted.toString(CryptoJS.enc.Utf8)
}





export function passphraseCipher(
  text: string,
  password: string,
  algorithm: CipherAlgorithm,
  operation: 'encrypt' | 'decrypt',
): string {
  const encryptor =
    algorithm === 'AES'
      ? CryptoJS.AES
      : algorithm === 'DES'
        ? CryptoJS.DES
        : algorithm === 'TripleDES'
          ? CryptoJS.TripleDES
          : algorithm === 'RC4'
            ? CryptoJS.RC4
            : CryptoJS.Rabbit
  if (operation === 'encrypt') return encryptor.encrypt(text, password).toString()
  const decrypted = encryptor.decrypt(text.trim(), password).toString(CryptoJS.enc.Utf8)
  if (!decrypted) throw new Error('口令不对，或密文不是口令模式生成的')
  return decrypted
}
