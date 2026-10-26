import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { signOf } from '../shared/constellation'
import {
  ID_CITIES,
  ID_DISTRICTS,
  ID_DISTRICTS_OLD,
  ID_PROVINCES,
} from '../shared/idRegions'
import type { IdCardInput, IdCardOutput } from './schema'

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const CHECK_CHARS = '10X98765432'

const empty = (error: string, normalized: string): IdCardOutput => ({
  valid: false,
  error,
  length: normalized.length,
  normalized,
  address: '',
  province: '',
  city: '',
  district: '',
  birthday: '',
  gender: '',
  age: 0,
  constellation: '',
  checkDigit: '',
})

const checksum = (body: string): string => {
  let sum = 0
  for (let i = 0; i < 17; i += 1) sum += Number(body[i]) * (WEIGHTS[i] ?? 0)
  return CHECK_CHARS[sum % 11] ?? ''
}

const realDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

const ageFrom = (year: number, month: number, day: number, now: Date): number => {
  let age = now.getFullYear() - year
  const beforeBirthday =
    now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)
  if (beforeBirthday) age -= 1
  return Math.max(0, age)
}

export function execute(
  input: IdCardInput,
  _context: ToolExecutionContext,
): ToolResult<IdCardOutput> {
  const raw = input.id.trim().toUpperCase().replace(/\s+/g, '')
  if (!/^\d{15}$/.test(raw) && !/^\d{17}[\dX]$/.test(raw)) {
    return toolFail('INVALID_INPUT', '身份证号应该是 15 位数字，或 17 位数字加一位校验位')
  }

  const now = new Date()
  const is18 = raw.length === 18
  const districtMap = is18 ? ID_DISTRICTS : ID_DISTRICTS_OLD
  const regionCode = raw.slice(0, 6)

  if (!districtMap[regionCode]) {
    return toolOk(empty('这个地址码不在行政区划表里，请检查前 6 位', raw))
  }

  let year: number
  let month: number
  let day: number
  if (is18) {
    year = Number(raw.slice(6, 10))
    month = Number(raw.slice(10, 12))
    day = Number(raw.slice(12, 14))
  } else {
    year = 1900 + Number(raw.slice(6, 8))
    month = Number(raw.slice(8, 10))
    day = Number(raw.slice(10, 12))
  }
  if (!realDate(year, month, day) || year < 1900 || year > now.getFullYear()) {
    return toolOk(empty('出生日期不合法', raw))
  }

  let checkDigit = ''
  if (is18) {
    checkDigit = checksum(raw)
    if (checkDigit !== raw[17]) {
      return toolOk(empty(`校验位不对（应为 ${checkDigit}）`, raw))
    }
  } else {
    checkDigit = '—'
  }

  const province = ID_PROVINCES[raw.slice(0, 2)] ?? ''
  const city = ID_CITIES[raw.slice(0, 4)] ?? ''
  const district = districtMap[regionCode] ?? ''
  // 直辖市等地市名与区县重复时只保留一个
  const middle = city && city !== district && city !== '市辖区' ? city : ''
  const genderCode = is18 ? Number(raw[16]) : Number(raw[14])

  return toolOk({
    valid: true,
    error: null,
    length: raw.length,
    normalized: raw,
    address: `${province}${middle}${district}`,
    province,
    city: middle,
    district,
    birthday: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    gender: genderCode % 2 === 1 ? '男' : '女',
    age: ageFrom(year, month, day, now),
    constellation: signOf(month, day).sign,
    checkDigit,
  })
}
