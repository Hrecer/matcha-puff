import { Lock, LockOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormWorkbench } from './shared/FormWorkbench'

interface CryptoData {
  algorithm: string
  mode: string
  operation: 'encrypt' | 'decrypt'
  result: string
}

const CIPHER_OPTIONS = [
  { value: 'AES', label: 'AES（16/24/32 字节密钥）' },
  { value: 'DES', label: 'DES（8 字节密钥）' },
  { value: 'TripleDES', label: '3DES（16/24 字节密钥）' },
  { value: 'RC4', label: 'RC4（流密码）' },
  { value: 'Rabbit', label: 'Rabbit（流密码，16 字节密钥）' },
]

const MODE_OPTIONS = [
  { value: 'CBC', label: 'CBC' },
  { value: 'ECB', label: 'ECB' },
  { value: 'CFB', label: 'CFB' },
  { value: 'OFB', label: 'OFB' },
  { value: 'CTR', label: 'CTR' },
]

const PADDING_OPTIONS = [
  { value: 'Pkcs7', label: 'PKCS#7' },
  { value: 'ZeroPadding', label: 'ZeroPadding' },
  { value: 'Iso97971', label: 'ISO 9797-1' },
  { value: 'AnsiX923', label: 'ANSI X9.23' },
  { value: 'NoPadding', label: 'NoPadding' },
]

export function SymmetricCryptoTool() {
  return (
    <FormWorkbench<CryptoData>
      toolId="symmetric-crypto"
      hint="简易模式用口令，兼容 Salted__ 密文；高级模式按字节设置密钥、IV、模式与填充。"
      formTitle="加解密参数"
      runLabel="开始计算"
      emptyTitle="等待处理"
      emptyDescription="填好文本与密钥后执行。"
      example={{
        text: '抹茶泡芙',
        key: '1234567890abcdef',
        iv: 'abcdef1234567890',
        algorithm: 'AES',
        mode: 'CBC',
        padding: 'Pkcs7',
        operation: 'encrypt',
        keyFormat: 'utf8',
        output: 'base64',
        simple: 'false',
        password: '',
      }}
      fields={[
        {
          key: 'operation',
          label: '操作',
          type: 'select',
          defaultValue: 'encrypt',
          options: [
            { value: 'encrypt', label: '加密' },
            { value: 'decrypt', label: '解密' },
          ],
        },
        { key: 'text', label: '文本', type: 'textarea', defaultValue: '抹茶泡芙', wide: true },
        { key: 'simple', label: '简易模式（口令）', type: 'switch', defaultValue: 'false' },
        { key: 'password', label: '口令（简易模式使用）', type: 'text', placeholder: '任意口令', optional: true },
        { key: 'key', label: '密钥（高级模式）', type: 'text', defaultValue: '1234567890abcdef', optional: true },
        { key: 'iv', label: 'IV（ECB 与流密码可留空）', type: 'text', defaultValue: 'abcdef1234567890', optional: true },
        { key: 'algorithm', label: '算法', type: 'select', defaultValue: 'AES', options: CIPHER_OPTIONS },
        { key: 'mode', label: '模式', type: 'select', defaultValue: 'CBC', options: MODE_OPTIONS },
        { key: 'padding', label: '填充', type: 'select', defaultValue: 'Pkcs7', options: PADDING_OPTIONS },
        {
          key: 'keyFormat',
          label: '密钥格式',
          type: 'select',
          defaultValue: 'utf8',
          options: [
            { value: 'utf8', label: '文本' },
            { value: 'hex', label: '十六进制' },
          ],
        },
        {
          key: 'output',
          label: '输出',
          type: 'select',
          defaultValue: 'base64',
          options: [
            { value: 'base64', label: 'Base64' },
            { value: 'hex', label: 'Hex' },
          ],
        },
      ]}
      toText={(data) => `${data.operation === 'encrypt' ? '加密' : '解密'}结果：${data.result}`}
      renderResult={(data) => (
        <div className="flex h-full flex-col gap-2">
          <p className="flex items-center gap-2 rounded-md bg-primary/[0.08] px-3 py-2 text-[11.5px] text-foreground/80">
            {data.operation === 'encrypt' ? (
              <Lock className="size-3.5 text-primary" aria-hidden />
            ) : (
              <LockOpen className="size-3.5 text-primary" aria-hidden />
            )}
            <span className="font-mono">{data.algorithm}</span>
            <span className="text-muted-foreground">{data.mode}</span>
            <span className="ml-auto text-muted-foreground">
              {data.operation === 'encrypt' ? '加密' : '解密'}结果
            </span>
          </p>
          <pre
            className={cn(
              'min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border/50',
              'bg-background/40 p-2.5 font-mono text-[12px] leading-6 text-foreground scroll-thin',
            )}
          >
            {data.result || '（空）'}
          </pre>
        </div>
      )}
    />
  )
}
