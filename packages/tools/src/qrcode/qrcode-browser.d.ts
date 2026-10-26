declare module 'qrcode/lib/browser.js' {
  export function toString(
    text: string,
    options?: {
      type?: 'svg'
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
      width?: number
      margin?: number
      color?: { dark?: string; light?: string }
    },
  ): Promise<string>
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' },
  ): { modules: { size: number; data: Uint8Array | number[] } }
}
