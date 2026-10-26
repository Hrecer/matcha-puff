/** 单位换算内核：因子统一换成基准单位后互相换算，无任何 UI 依赖 */

export interface UnitDef {
  value: string
  label: string
  symbol: string
  /** 相对基准单位的倍率 */
  factor: number
}

export interface UnitGroup {
  label: string
  units: UnitDef[]
}

export interface UnitResult {
  unit: string
  label: string
  symbol: string
  group: string
  value: number
}

export const STORAGE_GROUPS: UnitGroup[] = [
  {
    label: '存储单位',
    units: [
      { value: 'bit', label: '位', symbol: 'bit', factor: 1 / 8 },
      { value: 'byte', label: '字节', symbol: 'B', factor: 1 },
      { value: 'kb', label: '千字节', symbol: 'KB', factor: 1024 },
      { value: 'mb', label: '兆字节', symbol: 'MB', factor: 1024 ** 2 },
      { value: 'gb', label: '吉字节', symbol: 'GB', factor: 1024 ** 3 },
      { value: 'tb', label: '太字节', symbol: 'TB', factor: 1024 ** 4 },
    ],
  },
]

/** 速度：基准千米/秒（km/s）；因子为「1 个该单位等于多少基准单位」 */
const round = (value: number, digits: number): number => Number(value.toFixed(digits))

/**
 * 派生值取整：常规按小数位四舍五入，量级小到小数位会归零时改按有效数字保留
 * （否则「1 千米/秒 = 多少倍光速」会显示成 0）
 */
const roundDerived = (value: number, digits: number): number => {
  if (value === 0 || !Number.isFinite(value)) return value
  if (Math.abs(value) < Math.pow(10, -digits)) return Number(value.toPrecision(digits))
  return round(value, digits)
}

export function convertUnits(
  input: { value: number; unit: string; scope?: 'all' | 'group' },
  groups: UnitGroup[],
  digits: number,
): { results: UnitResult[]; baseValue: number } {
  let sourceGroup: UnitGroup | undefined
  let sourceUnit: UnitDef | undefined
  for (const group of groups) {
    const found = group.units.find((unit) => unit.value === input.unit)
    if (found) {
      sourceGroup = group
      sourceUnit = found
      break
    }
  }
  if (!sourceUnit || !sourceGroup) throw new Error(`未知单位：${input.unit}`)
  const baseValue = input.value * sourceUnit.factor
  const scope = input.scope ?? 'all'
  const selected = scope === 'group' ? [sourceGroup] : groups
  const results: UnitResult[] = []
  for (const group of selected) {
    for (const unit of group.units) {
      const value =
        unit.value === sourceUnit.value ? input.value : roundDerived(baseValue / unit.factor, digits)
      results.push({
        unit: unit.value,
        label: unit.label,
        symbol: unit.symbol,
        group: group.label,
        value,
      })
    }
  }
  return { results, baseValue }
}

export function flattenUnits(groups: UnitGroup[]): UnitDef[] {
  return groups.flatMap((group) => group.units)
}
