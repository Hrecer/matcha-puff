/** 十二星座：名称、符号、日期区间与起始月日 */

export interface SignDef {
  sign: string
  english: string
  emoji: string
  start: string
  end: string
  fromMonth: number
  fromDay: number
}

export const SIGNS: SignDef[] = [
  { sign: '白羊座', english: 'Aries', emoji: '♈', start: '3月21日', end: '4月19日', fromMonth: 3, fromDay: 21 },
  { sign: '金牛座', english: 'Taurus', emoji: '♉', start: '4月20日', end: '5月20日', fromMonth: 4, fromDay: 20 },
  { sign: '双子座', english: 'Gemini', emoji: '♊', start: '5月21日', end: '6月21日', fromMonth: 5, fromDay: 21 },
  { sign: '巨蟹座', english: 'Cancer', emoji: '♋', start: '6月22日', end: '7月22日', fromMonth: 6, fromDay: 22 },
  { sign: '狮子座', english: 'Leo', emoji: '♌', start: '7月23日', end: '8月22日', fromMonth: 7, fromDay: 23 },
  { sign: '处女座', english: 'Virgo', emoji: '♍', start: '8月23日', end: '9月22日', fromMonth: 8, fromDay: 23 },
  { sign: '天秤座', english: 'Libra', emoji: '♎', start: '9月23日', end: '10月23日', fromMonth: 9, fromDay: 23 },
  { sign: '天蝎座', english: 'Scorpio', emoji: '♏', start: '10月24日', end: '11月22日', fromMonth: 10, fromDay: 24 },
  { sign: '射手座', english: 'Sagittarius', emoji: '♐', start: '11月23日', end: '12月21日', fromMonth: 11, fromDay: 23 },
  { sign: '摩羯座', english: 'Capricorn', emoji: '♑', start: '12月22日', end: '1月19日', fromMonth: 12, fromDay: 22 },
  { sign: '水瓶座', english: 'Aquarius', emoji: '♒', start: '1月20日', end: '2月18日', fromMonth: 1, fromDay: 20 },
  { sign: '双鱼座', english: 'Pisces', emoji: '♓', start: '2月19日', end: '3月20日', fromMonth: 2, fromDay: 19 },
]

/** 按「月日」找落在哪个星座区间；摩羯跨年，所以从后往前比较 */
export function signOf(month: number, day: number): SignDef {
  const key = month * 100 + day
  const ordered = [...SIGNS].sort(
    (a, b) => b.fromMonth * 100 + b.fromDay - (a.fromMonth * 100 + a.fromDay),
  )
  return ordered.find((item) => key >= item.fromMonth * 100 + item.fromDay) ?? SIGNS[9]!
}
