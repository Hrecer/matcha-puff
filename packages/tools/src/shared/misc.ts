/** 体检与颜色等纯函数 */

export type BmiCategory = '偏瘦' | '正常' | '过重' | '肥胖'

export function calculateBmi(heightCm: number, weightKg: number): { bmi: number; category: BmiCategory } {
  if (!(heightCm > 0)) throw new Error('身高必须大于 0')
  if (!(weightKg > 0)) throw new Error('体重必须大于 0')
  const bmi = weightKg / (heightCm / 100) ** 2
  const rounded = Number(bmi.toFixed(2))
  const category: BmiCategory =
    rounded < 18.5 ? '偏瘦' : rounded < 24 ? '正常' : rounded < 28 ? '过重' : '肥胖'
  return { bmi: rounded, category }
}

export interface RgbColor {
  r: number
  g: number
  b: number
}

export function parseHexColor(hex: string): RgbColor {
  let source = hex.trim().replace(/^#/, '')
  if (source.length === 3) source = source.split('').map((char) => char + char).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(source)) throw new Error('请输入 3 位或 6 位十六进制颜色')
  return {
    r: Number.parseInt(source.slice(0, 2), 16),
    g: Number.parseInt(source.slice(2, 4), 16),
    b: Number.parseInt(source.slice(4, 6), 16),
  }
}

export function rgbToHex(color: RgbColor): string {
  const segment = (value: number) => {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error('RGB 每个通道必须是 0–255 之间的整数')
    }
    return value.toString(16).padStart(2, '0')
  }
  return `#${segment(color.r)}${segment(color.g)}${segment(color.b)}`.toUpperCase()
}
