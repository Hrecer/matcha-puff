import { useEffect, useMemo, useState } from 'react'
import {
  Cake,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { SlidingSegmented } from '@/components/ui/sliding'
import { useSessionState } from '@/lib/session-state'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { parseBirthday, useLifeProfile } from '@/lib/life-profile'
import { copyText } from '@/lib/clipboard'
import {
  CALENDAR_MAX_MS,
  CALENDAR_MIN_MS,
  WEEKDAY_LABELS,
  addDays,
  clampToCalendar,
  dateKey,
  daysInMonth,
  formatSolarDate,
  ganZhiOfYear,
  isoWeek,
  isInCalendarRange,
  lunarCellLabel,
  lunarOf,
  lunarYearInfo,
  monthGrid,
  sameDay,
  startOfDay,
  startOfWeek,
  stepCursor,
  weekOf,
  weekdayLong,
  weekdayShort,
  type CalendarView,
} from '@/lib/calendar'
import { lunarMonthText, animalOf, solarTerms } from '@/lib/time-tools/lunar'
import { statutoryHolidaysOfYear } from '@/lib/time-tools/holidayCountdown'
import {
  dayContextOf,
  ensureHolidayYear,
  holidayMissingAt,
  officialHolidayTarget,
  subscribeHolidays,
} from '@/lib/workday'
import { cn } from '@/lib/utils'

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

type YearMode = 'calendar' | 'terms' | 'holidays'

const YEAR_MODE_OPTIONS: { value: YearMode; label: string }[] = [
  { value: 'calendar', label: '年历' },
  { value: 'terms', label: '节气' },
  { value: 'holidays', label: '假期' },
]

const SEASON_ORDER = ['春', '夏', '秋', '冬'] as const
const SEASON_STYLE: Record<string, string> = {
  春: 'bg-success/10 text-success border-success/25',
  夏: 'bg-amber-500/10 text-amber-500 border-amber-500/25',
  秋: 'bg-primary/10 text-primary border-primary/25',
  冬: 'bg-sky-500/10 text-sky-500 border-sky-500/25',
}

interface TermMeta {
  /** 太阳黄经，每 15° 一个节气 */
  longitude: number
  description: string
  /** 七十二候中本节气的三候 */
  pentads: [string, string, string]
}

const PENTAD_LABELS = ['初候', '二候', '三候'] as const

const TERM_META: Record<string, TermMeta> = {
  小寒: {
    longitude: 285,
    description: '天气寒冷，但尚未到极点，是一年中最冷时段的开始。',
    pentads: ['雁北乡', '鹊始巢', '雉始雊'],
  },
  大寒: {
    longitude: 300,
    description: '一年中最冷的时段，寒潮频繁，过后又将迎来立春。',
    pentads: ['鸡始乳', '征鸟厉疾', '水泽腹坚'],
  },
  立春: {
    longitude: 315,
    description: '春季开始，东风解冻，万物逐渐复苏。',
    pentads: ['东风解冻', '蛰虫始振', '鱼陟负冰'],
  },
  雨水: {
    longitude: 330,
    description: '气温回升，降水增多，冰雪融化，草木萌动。',
    pentads: ['獭祭鱼', '候雁北', '草木萌动'],
  },
  惊蛰: {
    longitude: 345,
    description: '春雷始鸣，惊醒蛰伏的昆虫，春耕渐忙。',
    pentads: ['桃始华', '仓庚鸣', '鹰化为鸠'],
  },
  春分: {
    longitude: 0,
    description: '昼夜几乎等长，春季过半，气候温和。',
    pentads: ['玄鸟至', '雷乃发声', '始电'],
  },
  清明: {
    longitude: 15,
    description: '天清地明，草木繁茂，也是祭祖与踏青的时节。',
    pentads: ['桐始华', '田鼠化为鴽', '虹始见'],
  },
  谷雨: {
    longitude: 30,
    description: '雨生百谷，春季最后一个节气，适宜播种。',
    pentads: ['萍始生', '鸣鸠拂其羽', '戴胜降于桑'],
  },
  立夏: {
    longitude: 45,
    description: '夏季开始，气温升高，作物进入旺盛生长期。',
    pentads: ['蝼蝈鸣', '蚯蚓出', '王瓜生'],
  },
  小满: {
    longitude: 60,
    description: '夏熟作物籽粒渐渐饱满，但尚未成熟。',
    pentads: ['苦菜秀', '靡草死', '麦秋至'],
  },
  芒种: {
    longitude: 75,
    description: '有芒作物成熟、夏播作物抢种的忙碌时节。',
    pentads: ['螳螂生', '鵙始鸣', '反舌无声'],
  },
  夏至: {
    longitude: 90,
    description: '北半球白昼最长，盛夏将至，雷雨增多。',
    pentads: ['鹿角解', '蜩始鸣', '半夏生'],
  },
  小暑: {
    longitude: 105,
    description: '天气开始炎热，但还没到一年中最热的时候。',
    pentads: ['温风至', '蟋蟀居壁', '鹰始鸷'],
  },
  大暑: {
    longitude: 120,
    description: '一年中最热的时段，高温与雷雨频繁。',
    pentads: ['腐草为萤', '土润溽暑', '大雨时行'],
  },
  立秋: {
    longitude: 135,
    description: '秋季开始，暑热尚未退去，早晚渐渐转凉。',
    pentads: ['凉风至', '白露降', '寒蝉鸣'],
  },
  处暑: {
    longitude: 150,
    description: '暑气到此为止，天气转凉，秋意渐显。',
    pentads: ['鹰乃祭鸟', '天地始肃', '禾乃登'],
  },
  白露: {
    longitude: 165,
    description: '昼夜温差加大，清晨草木上凝结露水。',
    pentads: ['鸿雁来', '玄鸟归', '群鸟养羞'],
  },
  秋分: {
    longitude: 180,
    description: '昼夜再次几乎等长，秋季过半，气候转凉。',
    pentads: ['雷始收声', '蛰虫坯户', '水始涸'],
  },
  寒露: {
    longitude: 195,
    description: '露水更凉，将要凝结，秋意渐深。',
    pentads: ['鸿雁来宾', '雀入大水为蛤', '菊有黄华'],
  },
  霜降: {
    longitude: 210,
    description: '天气渐冷，开始降霜，是秋季最后一个节气。',
    pentads: ['豺乃祭兽', '草木黄落', '蛰虫咸俯'],
  },
  立冬: {
    longitude: 225,
    description: '冬季开始，万物收藏，北方渐入寒冷。',
    pentads: ['水始冰', '地始冻', '雉入大水为蜃'],
  },
  小雪: {
    longitude: 240,
    description: '天气转冷，开始降雪，但雪量通常不大。',
    pentads: ['虹藏不见', '天气上升地气下降', '闭塞而成冬'],
  },
  大雪: {
    longitude: 255,
    description: '降雪增多，气温继续下降，天地寒冷。',
    pentads: ['鹖鴠不鸣', '虎始交', '荔挺出'],
  },
  冬至: {
    longitude: 270,
    description: '北半球白昼最短，此后白昼渐长，进入数九寒天。',
    pentads: ['蚯蚓结', '麋角解', '水泉动'],
  },
}

/** 24 节气按立春起每六个一季（小寒、大寒归冬） */
const seasonOfTerm = (index: number): string =>
  SEASON_ORDER[Math.floor((((index - 3 + 24) % 24) / 6))] ?? '冬'

type TermItem = { index: number; month: number; day: number }

type HolidayFlag = 'holiday' | 'workday'

const holidayOf = (date: Date): HolidayFlag | null => {
  const context = dayContextOf(date)
  if (context.statutoryHoliday) return 'holiday'
  const weekend = date.getDay() === 0 || date.getDay() === 6
  return context.workday && weekend ? 'workday' : null
}

const holidayName = (flag: HolidayFlag | null): string | null =>
  flag === 'holiday' ? '法定节假日' : flag === 'workday' ? '调休补班' : null

/** 假期区间是首日到末日；跨过周界时明确标出，单日只显示一个星期 */
const weekdayRangeOf = (start: Date, end: Date): string => {
  const startLabel = weekdayShort(start)
  if (sameDay(start, end)) return startLabel
  const endLabel = weekdayShort(end)
  const crossesWeek = startOfWeek(start).getTime() !== startOfWeek(end).getTime()
  return crossesWeek ? `${startLabel}–${endLabel}（跨周）` : `${startLabel}–${endLabel}`
}

/** 接口 target 与国务院通知不一致时按通知纠正（2026 中秋无调休，9/20 属国庆） */
const MAKEUP_TARGET_OVERRIDES: Record<string, string> = {
  '2026-09-20': '国庆节',
}

/** 当前视图翻一页后是否真的换了周期；1900/2100 两端被截断时用于禁用按钮 */
const periodKeyOf = (date: Date, view: CalendarView): string => {
  if (view === 'month') return `${date.getFullYear()}-${date.getMonth()}`
  if (view === 'week') return dateKey(startOfWeek(date))
  if (view === 'year') return String(date.getFullYear())
  return dateKey(date)
}

interface HolidayBase {
  name: string
  month: number
  day: number
  basis: string
  anchor: Date
  start: Date
  end: Date
  official: boolean
  daysOff: number
  makeup: string[]
}

interface HolidayOverviewItem {
  name: string
  start: Date
  end: Date
  rangeText: string
  daysOff: number
  makeup: string[]
  official: boolean
  basis: string
  startDiff: number
  ongoing: boolean
  ongoingDay: number
  statusText: string
  jumpDate: Date
  canJump: boolean
}

interface HolidayOverview {
  items: HolidayOverviewItem[]
  next: HolidayOverviewItem | null
  ongoing: HolidayOverviewItem | null
  yearProgress: number
  vacationProgress: number
  todayText: string
}

const dayDiff = (later: Date, earlier: Date): number =>
  Math.round(
    (Date.UTC(later.getFullYear(), later.getMonth(), later.getDate()) -
      Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())) /
      86_400_000,
  )

const round1 = (value: number): number => Math.round(value * 10) / 10

/**
 * 官方假期总览：以联网缓存的休息/补班标记为准，把连续的休息日并成官方区间；
 * 补班日按距离归到最近的假期。没有官方表时退回七个法定节日的当天。
 */
function buildHolidayOverview(year: number, today: Date): HolidayOverview {
  const bases: HolidayBase[] = statutoryHolidaysOfYear(year).map((stat) => {
    const anchor = new Date(year, stat.month - 1, stat.day)
    let start = anchor
    let end = anchor
    let official = false
    if (dayContextOf(anchor).statutoryHoliday) {
      official = true
      for (let index = 0; index < 20; index += 1) {
        const previous = addDays(start, -1)
        if (!dayContextOf(previous).statutoryHoliday) break
        start = previous
      }
      for (let index = 0; index < 20; index += 1) {
        const following = addDays(end, 1)
        if (!dayContextOf(following).statutoryHoliday) break
        end = following
      }
    }
    return {
      name: stat.name,
      month: stat.month,
      day: stat.day,
      basis: stat.basis,
      anchor,
      start,
      end,
      official,
      daysOff: official ? dayDiff(end, start) + 1 : stat.daysOff,
      makeup: [],
    }
  })

  // 官方表里周末上班的补班日，归属到最近的假期区间
  const scanStart = addDays(new Date(year, 0, 1), -7)
  const scanEnd = addDays(new Date(year, 11, 31), 7)
  for (let date = scanStart; date.getTime() <= scanEnd.getTime(); date = addDays(date, 1)) {
    const weekend = date.getDay() === 0 || date.getDay() === 6
    if (!weekend || !dayContextOf(date).workday) continue
    const target =
      MAKEUP_TARGET_OVERRIDES[formatSolarDate(date)] ?? officialHolidayTarget(date)
    let nearest: HolidayBase | null = target
      ? (bases.find((base) => target.includes(base.name) || base.name.includes(target)) ?? null)
      : null
    let nearestDistance = 0
    if (!nearest) {
      nearestDistance = Infinity
      for (const base of bases) {
        const distance =
          date.getTime() < base.start.getTime()
            ? dayDiff(base.start, date)
            : date.getTime() > base.end.getTime()
              ? dayDiff(date, base.end)
              : 0
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearest = base
        }
      }
    }
    if (nearest && nearestDistance <= 14) {
      nearest.makeup.push(
        `${date.getMonth() + 1}月${date.getDate()}日(${weekdayShort(date)})上班`,
      )
    }
  }

  const items: HolidayOverviewItem[] = bases
    .map((base) => {
      const startDiff = dayDiff(base.start, today)
      const ongoing = startDiff <= 0 && dayDiff(base.end, today) >= 0
      const ongoingDay = ongoing ? dayDiff(today, base.start) + 1 : 0
      const statusText = ongoing
        ? `假期中 · 第 ${ongoingDay} 天`
        : startDiff > 0
          ? `还有 ${startDiff} 天`
          : `已过 ${-startDiff} 天`
      const rangeText = base.official
        ? `${base.start.getMonth() + 1}月${base.start.getDate()}日~${base.end.getMonth() + 1}月${base.end.getDate()}日`
        : formatSolarDate(base.anchor)
      const jumpDate = base.start.getFullYear() === year ? base.start : base.anchor
      return {
        name: base.name,
        start: base.start,
        end: base.end,
        rangeText,
        daysOff: base.daysOff,
        makeup: base.makeup,
        official: base.official,
        basis: base.official ? '联网官方放假区间' : base.basis,
        startDiff,
        ongoing,
        ongoingDay,
        statusText,
        jumpDate,
        canJump: isInCalendarRange(jumpDate),
      }
    })
    .sort((left, right) => left.start.getTime() - right.start.getTime())

  const ongoing = items.find((item) => item.ongoing) ?? null
  const next = items.find((item) => item.startDiff > 0) ?? null
  const yearStart = new Date(year, 0, 1).getTime()
  const yearEnd = new Date(year + 1, 0, 1).getTime()
  const todayTime = startOfDay(today).getTime()
  const yearProgress = round1(
    Math.min(100, Math.max(0, ((todayTime - yearStart) / (yearEnd - yearStart)) * 100)),
  )
  const started = items.filter((item) => item.startDiff <= 0).length
  const vacationProgress = items.length ? round1((started / items.length) * 100) : 0

  return {
    items,
    next,
    ongoing,
    yearProgress,
    vacationProgress,
    todayText: formatSolarDate(today),
  }
}

export function CalendarTool() {
  const [view, setView] = useSessionState<CalendarView>('calendar/view', 'day')
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()))
  const [yearMode, setYearMode] = useSessionState<YearMode>('calendar/year-mode', 'calendar')
  const [holidayTick, setHolidayTick] = useState(0)
  const [copied, setCopied] = useState(false)
  const [copiedTerm, setCopiedTerm] = useState(false)
  const [copiedHoliday, setCopiedHoliday] = useState(false)

  useEffect(() => subscribeHolidays(() => setHolidayTick((value) => value + 1)), [])

  const today = startOfDay(new Date())
  const lifeProfile = useLifeProfile()
  const birthdayParts = useMemo(
    () => (lifeProfile ? parseBirthday(lifeProfile.birthday) : null),
    [lifeProfile],
  )
  const isBirthdayDate = (date: Date) =>
    Boolean(
      birthdayParts &&
        date.getMonth() + 1 === birthdayParts.month &&
        date.getDate() === birthdayParts.day,
    )
  const year = cursor.getFullYear()
  const monthIndex = cursor.getMonth()
  const yearMeta = useMemo(() => lunarYearInfo(year), [year])
  const cursorLunar = lunarOf(cursor)
  const cursorHoliday = holidayOf(cursor)
  const cursorHolidayName = holidayName(cursorHoliday)
  const cursorHolidayMissing = holidayMissingAt(cursor)
  const isToday = sameDay(cursor, today)
  const weekDates = useMemo(() => weekOf(cursor), [cursor])

  const monthLunar = lunarOf(
    clampToCalendar(new Date(year, monthIndex, 15)),
  )
  const monthLunarYear = monthLunar
    ? { ganZhi: ganZhiOfYear(monthLunar.year), animal: animalOf(monthLunar.year) }
    : null

  const todayKey = dateKey(today)
  const holidayOverview = useMemo(() => {
    if (view !== 'year' || yearMode !== 'holidays') return null
    return buildHolidayOverview(year, today)
  }, [view, year, yearMode, holidayTick, todayKey])

  const pickDay = (date: Date) => {
    if (!isInCalendarRange(date)) return
    setCursor(startOfDay(date))
  }

  const move = (direction: -1 | 1, big: boolean) => {
    setCursor((current) => {
      const next = stepCursor(current, view, direction, big)
      return periodKeyOf(next, view) === periodKeyOf(current, view) ? current : next
    })
  }

  const canMove = (direction: -1 | 1, big: boolean): boolean => {
    const next = stepCursor(cursor, view, direction, big)
    return periodKeyOf(next, view) !== periodKeyOf(cursor, view)
  }

  const goToday = () => setCursor(startOfDay(new Date()))

  const openMonth = (month: number) => {
    const day = Math.min(cursor.getDate(), daysInMonth(year, month))
    setCursor(clampToCalendar(new Date(year, month, day)))
    setView('month')
  }

  const pickTerm = (term: TermItem) => {
    const date = new Date(year, term.month - 1, term.day)
    if (isInCalendarRange(date)) setCursor(startOfDay(date))
  }

  const pickHoliday = (item: HolidayOverviewItem) => {
    if (item.canJump) setCursor(startOfDay(item.jumpDate))
  }

  const copyHoliday = async () => {
    if (!holidayOverview) return
    const text = holidayOverview.items
      .map(
        (item) =>
          `${item.name}\t${item.rangeText}\t${item.daysOff} 天\t${
            item.makeup.length ? `调休：${item.makeup.join('、')}\t` : ''
          }${item.statusText}`,
      )
      .join('\n')
    try {
      await copyText(text)
      setCopiedHoliday(true)
      window.setTimeout(() => setCopiedHoliday(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const bigStepLabel = view === 'year' ? '十年' : view === 'month' ? '一年' : '一个月'
  const smallStepLabel =
    view === 'year' ? '一年' : view === 'month' ? '一个月' : view === 'week' ? '一周' : '一天'

  const header = (() => {
    if (view === 'month') {
      const lunarPart = monthLunar
        ? `农历${lunarMonthText(monthLunar.month, monthLunar.isLeap)}`
        : '农历—'
      const lunarYearPart = monthLunarYear
        ? `${monthLunarYear.ganZhi}${monthLunarYear.animal}年`
        : `${yearMeta.ganZhi}${yearMeta.animal}年`
      return {
        main: `${year}年${monthIndex + 1}月`,
        sub: `${lunarPart} · ${lunarYearPart}`,
      }
    }
    if (view === 'week') {
      const start = startOfWeek(cursor)
      const end = addDays(start, 6)
      const startYear = start.getFullYear()
      const endYear = end.getFullYear()
      const yearPart = startYear === endYear ? `${startYear}年` : `${startYear}/${endYear}年`
      return {
        main: `${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`,
        sub: `第 ${isoWeek(cursor)} 周 · ${yearPart} · 农历${cursorLunar ? lunarMonthText(cursorLunar.month, cursorLunar.isLeap) : '—'}`,
      }
    }
    if (view === 'day') {
      return {
        main: `${year}年${monthIndex + 1}月${cursor.getDate()}日`,
        sub: `${weekdayLong(cursor)} · 农历${cursorLunar?.text ?? '—'}`,
      }
    }
    return {
      main: `${year}年`,
      sub: `${yearMeta.ganZhi}${yearMeta.animal}年 · 地支${yearMeta.branch}`,
    }
  })()

  const holidayYears = useMemo(() => {
    const years = new Set<number>([cursor.getFullYear()])
    if (view === 'month') {
      const grid = monthGrid(cursor.getFullYear(), cursor.getMonth())
      years.add(grid[0]!.getFullYear())
      years.add(grid[grid.length - 1]!.getFullYear())
    } else if (view === 'week') {
      const week = weekOf(cursor)
      years.add(week[0]!.getFullYear())
      years.add(week[week.length - 1]!.getFullYear())
    } else if (view === 'year' && yearMode === 'holidays') {
      const current = cursor.getFullYear()
      if (current > 1900) years.add(current - 1)
      if (current < 2100) years.add(current + 1)
    }
    return [...years].sort((a, b) => a - b)
  }, [view, cursor, yearMode])
  const holidayYearsKey = holidayYears.join(',')

  useEffect(() => {
    let alive = true
    void Promise.all(
      holidayYearsKey.split(',').map(Number).map((item) => ensureHolidayYear(item)),
    )
      .then(() => {
        if (alive) setHolidayTick((value) => value + 1)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [holidayYearsKey])

  const monthCells = useMemo(() => {
    if (view !== 'month') return []
    return monthGrid(cursor.getFullYear(), cursor.getMonth()).map((date) => {
      const inRange = isInCalendarRange(date)
      return {
        date,
        inRange,
        inMonth:
          date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth(),
        isToday: sameDay(date, today),
        isSelected: sameDay(date, cursor),
        lunar: inRange ? lunarOf(date) : null,
        holiday: inRange ? holidayOf(date) : null,
      }
    })
  }, [view, cursor, holidayTick])

  const yearMonths = useMemo(() => {
    if (view !== 'year') return []
    return Array.from({ length: 12 }, (_, month) => ({
      month,
      cells: monthGrid(year, month).map((date) => {
        if (date.getMonth() !== month) return null
        return {
          date,
          inRange: isInCalendarRange(date),
          isToday: sameDay(date, today),
          isSelected: sameDay(date, cursor),
        }
      }),
    }))
  }, [view, year, cursor])

  const termCards = useMemo(() => {
    if (view !== 'year') return []
    return solarTerms(year).map((item) => ({
      ...item,
      date: new Date(year, item.month - 1, item.day),
      season: seasonOfTerm(item.index),
      dateText: `${item.month}/${item.day}`,
    }))
  }, [view, year])

  const activeTerm = useMemo(() => {
    if (termCards.length === 0) return null
    const cursorTime = startOfDay(cursor).getTime()
    let current = termCards[0]!
    for (const term of termCards) {
      if (term.date.getTime() <= cursorTime) current = term
      else break
    }
    return current
  }, [termCards, cursor])

  const termLunar = activeTerm ? lunarOf(activeTerm.date) : null
  const termMeta = activeTerm ? TERM_META[activeTerm.name] ?? null : null
  const activeTermIndex = activeTerm
    ? termCards.findIndex((item) => item.index === activeTerm.index)
    : -1
  const nextTerm = activeTerm
    ? activeTermIndex >= 0 && termCards[activeTermIndex + 1]
      ? {
          name: termCards[activeTermIndex + 1]!.name,
          date: termCards[activeTermIndex + 1]!.date,
        }
      : year < 2100
        ? (() => {
            const first = solarTerms(year + 1)[0]
            return first
              ? {
                  name: first.name,
                  date: new Date(year + 1, first.month - 1, first.day),
                }
              : null
          })()
        : null
    : null
  const termDuration = activeTerm && nextTerm ? dayDiff(nextTerm.date, activeTerm.date) : 0
  const termDay = activeTerm ? dayDiff(cursor, activeTerm.date) + 1 : 0
  const inTerm = termDuration > 0 && termDay >= 1 && termDay <= termDuration
  const pentadIndex = inTerm ? Math.min(2, Math.floor((termDay - 1) / 5)) : -1
  const termProgress =
    inTerm && termDuration > 1
      ? Math.min(100, Math.max(0, ((termDay - 1) / (termDuration - 1)) * 100))
      : 0
  const daysToNext = nextTerm ? dayDiff(nextTerm.date, cursor) : null
  const pentadRanges =
    activeTerm && termDuration > 0
      ? [0, 1, 2].map((index) => {
          const lastOffset = Math.max(0, termDuration - 1)
          const start = addDays(activeTerm.date, index * 5)
          const end = addDays(
            activeTerm.date,
            index === 2 ? lastOffset : Math.min((index + 1) * 5 - 1, lastOffset),
          )
          return { start, end }
        })
      : []

  const copyTermInfo = async () => {
    if (!activeTerm) return
    const lines = [
      `${activeTerm.name} ${formatSolarDate(activeTerm.date)}`,
      termLunar ? `农历 ${termLunar.year}年${termLunar.text}` : '',
      termMeta
        ? `太阳黄经 ${termMeta.longitude}° · 本节气${termDuration ? ` ${termDuration} 天` : '时长未知'}`
        : '',
      termMeta?.description ?? '',
      termMeta ? `三候：${termMeta.pentads.join(' / ')}` : '',
      nextTerm ? `下一节气：${nextTerm.name} ${formatSolarDate(nextTerm.date)}` : '',
    ].filter(Boolean)
    try {
      await copyText(lines.join('\n'))
      setCopiedTerm(true)
      window.setTimeout(() => setCopiedTerm(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  const copyDetail = async () => {
    if (!cursorLunar) return
    const lines = [
      `公历：${formatSolarDate(cursor)} ${cursorLunar.weekday}`,
      `农历：${cursorLunar.fullText}`,
      `生肖：${cursorLunar.animal}　干支：${cursorLunar.ganZhiYear}年 ${cursorLunar.ganZhiMonth}月 ${cursorLunar.ganZhiDay}日`,
      cursorLunar.term ? `节气：${cursorLunar.term}` : '',
      cursorHolidayName
        ? `节假日：${cursorHolidayName}${cursorHolidayMissing ? '（节假日表未加载）' : ''}`
        : '',
      cursorHolidayMissing && !cursorHolidayName
        ? '节假日表未加载（按周一至周五判断）'
        : '',
      `农历月长：${cursorLunar.monthDays} 天　农历年长：${cursorLunar.yearDays} 天`,
    ].filter(Boolean)
    try {
      await copyText(lines.join('\n'))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('复制失败，请手动选择内容', 'error')
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 scroll-thin">
      <header className="flex h-[56px] shrink-0 items-center gap-3">
        <div className="flex min-w-0 items-center gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`上${bigStepLabel}`}
            title={`上${bigStepLabel}`}
            disabled={!canMove(-1, true)}
            onClick={() => move(-1, true)}
          >
            <ChevronsLeft className="size-4" aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`上${smallStepLabel}`}
            title={`上${smallStepLabel}`}
            disabled={!canMove(-1, false)}
            onClick={() => move(-1, false)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <div className="w-[252px] min-w-0 px-2 text-center">
            <h2 className="truncate text-[20px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-foreground">
              {header.main}
            </h2>
            <p
              className="mt-1.5 truncate text-[11.5px] leading-none text-muted-foreground"
              title={header.sub}
            >
              {header.sub}
            </p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`下${smallStepLabel}`}
            title={`下${smallStepLabel}`}
            disabled={!canMove(1, false)}
            onClick={() => move(1, false)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`下${bigStepLabel}`}
            title={`下${bigStepLabel}`}
            disabled={!canMove(1, true)}
            onClick={() => move(1, true)}
          >
            <ChevronsRight className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2 text-[12.5px] text-muted-foreground hover:text-foreground"
            onClick={goToday}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            今天
          </Button>
          <SlidingSegmented
            options={VIEW_OPTIONS}
            value={view}
            onValueChange={setView}
            ariaLabel="日历视图"
          />
        </div>
      </header>

      <section className="glass flex min-h-[460px] flex-1 flex-col overflow-hidden rounded-panel p-3.5">
        {view === 'month' ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="grid shrink-0 grid-cols-7 gap-1 pb-1.5 text-center text-[11px] text-muted-foreground">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className="py-0.5">
                  {label}
                </span>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1">
              {monthCells.map((cell) => {
                const label = `${cell.date.getFullYear()}年${cell.date.getMonth() + 1}月${cell.date.getDate()}日 ${weekdayLong(cell.date)}${cell.lunar ? `，农历${cell.lunar.fullText}${cell.lunar.term ? `，${cell.lunar.term}` : ''}` : ''}${cell.holiday ? `，${holidayName(cell.holiday)}` : ''}${isBirthdayDate(cell.date) ? '，生日' : ''}`
                return (
                  <button
                    key={dateKey(cell.date)}
                    type="button"
                    disabled={!cell.inRange}
                    aria-label={label}
                    aria-pressed={cell.isSelected}
                    aria-current={cell.isToday ? 'date' : undefined}
                    title={label}
                    onClick={() => pickDay(cell.date)}
                    className={cn(
                      'relative flex min-h-[42px] flex-col items-center justify-center overflow-hidden rounded-lg border px-2 py-1.5 text-left outline-none transition-colors',
                      !cell.inRange
                        ? 'cursor-default border-transparent text-muted-foreground/20'
                        : cell.isSelected
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40'
                          : 'border-transparent hover:border-primary/25 hover:bg-primary/[0.045] focus-visible:ring-2 focus-visible:ring-primary/30',
                    )}
                  >
                    {cell.holiday ? (
                      <span
                        className={cn(
                          'absolute right-1.5 top-1.5 text-[9px] font-semibold leading-none',
                          cell.isSelected
                            ? 'text-primary-foreground/80'
                            : cell.holiday === 'holiday'
                              ? 'text-destructive'
                              : 'text-primary',
                        )}
                      >
                        {cell.holiday === 'holiday' ? '休' : '班'}
                      </span>
                    ) : null}
                    {isBirthdayDate(cell.date) ? (
                      <Cake
                        aria-hidden
                        className={cn(
                          'absolute left-1.5 top-1.5 size-3',
                          cell.isSelected ? 'text-primary-foreground' : 'text-primary',
                        )}
                      />
                    ) : null}
                    <span
                      className={cn(
                        'flex flex-col items-center',
                        !cell.inMonth && !cell.isSelected && 'opacity-50',
                      )}
                    >
                      <span className="flex flex-col items-center">
                        <span
                          className={cn(
                            'text-[15px] font-semibold leading-none tabular-nums',
                            cell.isToday && !cell.isSelected && 'text-primary',
                          )}
                        >
                          {cell.date.getDate()}
                        </span>
                        {cell.isToday ? (
                          <span
                            aria-hidden
                            className={cn(
                              'mt-[3px] h-[3.5px] w-full',
                              cell.isSelected ? 'bg-primary-foreground' : 'bg-primary',
                            )}
                          />
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          'mt-1.5 w-full truncate text-center text-[9.5px] leading-none',
                          cell.isSelected
                            ? 'text-primary-foreground/75'
                            : cell.lunar?.term
                              ? 'text-primary'
                              : cell.lunar?.day === 1
                                ? 'font-medium text-foreground/75'
                                : 'text-muted-foreground/75',
                        )}
                      >
                        {cell.lunar ? lunarCellLabel(cell.lunar) : '—'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : view === 'week' ? (
          <div className="grid h-full min-h-0 grid-cols-7 gap-1.5">
            {weekDates.map((date) => {
              const lunar = lunarOf(date)
              const holiday = holidayOf(date)
              const todayCell = sameDay(date, today)
              const selected = sameDay(date, cursor)
              const inRange = isInCalendarRange(date)
              const birthdayCell = isBirthdayDate(date)
              return (
                <button
                  key={dateKey(date)}
                  type="button"
                  disabled={!inRange}
                  aria-label={`${formatSolarDate(date)} ${weekdayLong(date)}${lunar ? `，农历${lunar.fullText}` : ''}${birthdayCell ? '，生日' : ''}`}
                  aria-pressed={selected}
                  onClick={() => pickDay(date)}
                  className={cn(
                    'flex min-h-0 flex-col overflow-hidden rounded-xl border px-3 py-3 text-left outline-none transition-colors',
                    !inRange
                      ? 'cursor-default border-transparent bg-transparent opacity-35'
                      : selected
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border/40 bg-background/25 hover:border-primary/30 hover:bg-primary/[0.045] focus-visible:ring-2 focus-visible:ring-primary/35',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'text-[12px] font-medium leading-none',
                        selected ? 'text-primary-foreground' : 'text-foreground',
                      )}
                    >
                      {weekdayShort(date)}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] leading-none tabular-nums',
                        selected ? 'text-primary-foreground/60' : 'text-muted-foreground/70',
                      )}
                    >
                      {date.getMonth() + 1}月
                    </span>
                  </span>
                  <span className="mt-4 flex flex-col items-start">
                    <span
                      className={cn(
                        'text-[38px] font-semibold leading-none tabular-nums',
                        selected
                          ? 'text-primary-foreground'
                          : todayCell
                            ? 'text-primary'
                            : 'text-foreground',
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {todayCell ? (
                      <span
                        aria-hidden
                        className={cn(
                          'mt-1.5 h-[4px] w-full',
                          selected ? 'bg-primary-foreground' : 'bg-primary',
                        )}
                      />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'mt-4 text-[14px] font-medium leading-tight',
                      selected ? 'text-primary-foreground' : 'text-foreground',
                    )}
                  >
                    {lunar?.text ?? '—'}
                  </span>
                  <span
                    className={cn(
                      'mt-1 text-[10.5px] leading-4',
                      selected ? 'text-primary-foreground/65' : 'text-muted-foreground',
                    )}
                  >
                    {lunar ? `${lunar.ganZhiDay}日 · ${lunar.animal}年` : ''}
                  </span>
                  <span className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                    {birthdayCell ? (
                      <span
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-none',
                          selected
                            ? 'bg-primary-foreground/15 text-primary-foreground'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        <Cake className="size-3" aria-hidden />
                        生日
                      </span>
                    ) : null}
                    {lunar?.term ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] leading-none',
                          selected
                            ? 'bg-primary-foreground/15 text-primary-foreground'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {lunar.term}
                      </span>
                    ) : null}
                    {holiday ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] leading-none',
                          selected
                            ? 'bg-primary-foreground/15 text-primary-foreground'
                            : holiday === 'holiday'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-primary/10 text-primary',
                        )}
                      >
                        {holidayName(holiday)}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        ) : view === 'day' ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
                <div className="flex flex-col items-center">
                  <p className="text-[12px] tracking-[0.24em] tabular-nums text-muted-foreground">
                    {year} / {String(monthIndex + 1).padStart(2, '0')}
                  </p>
                  <span
                    className={cn(
                      'mt-2 block text-[104px] font-semibold leading-[0.82] tabular-nums',
                      isToday ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {cursor.getDate()}
                  </span>
                  {isToday ? (
                    <span aria-hidden className="mt-4 h-[5px] w-full bg-primary" />
                  ) : null}
                  <p className="mt-4 text-[17px] font-medium text-foreground">
                    {weekdayLong(cursor)}
                  </p>
                </div>
                <div className="hidden h-[180px] w-px bg-border sm:block" aria-hidden />
                <div className="flex max-w-[340px] flex-col items-center sm:items-start">
                  <p className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                    {cursorLunar?.text ?? '—'}
                  </p>
                  <p className="mt-3 text-center text-[14px] leading-6 text-muted-foreground sm:text-left">
                    {cursorLunar
                      ? `${cursorLunar.animal}年 · ${cursorLunar.ganZhiYear}年 ${cursorLunar.ganZhiMonth}月 ${cursorLunar.ganZhiDay}日`
                      : '超出支持范围'}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                    {isToday ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] leading-none text-primary">
                        今天
                      </span>
                    ) : null}
                    {cursorLunar?.isLeap ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] leading-none text-primary">
                        闰月
                      </span>
                    ) : null}
                    {cursorLunar?.term ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] leading-none text-primary">
                        {cursorLunar.term}
                      </span>
                    ) : null}
                    {cursorHolidayName ? (
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] leading-none',
                          cursorHoliday === 'holiday'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {cursorHolidayName}
                      </span>
                    ) : null}
                    {isBirthdayDate(cursor) ? (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] leading-none text-primary">
                        <Cake className="size-3" aria-hidden />
                        生日
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid shrink-0 grid-cols-7 gap-1.5 border-t border-border/50 pt-3">
              {weekDates.map((date) => {
                const lunar = lunarOf(date)
                const selected = sameDay(date, cursor)
                const todayCell = sameDay(date, today)
                const inRange = isInCalendarRange(date)
                return (
                  <button
                    key={dateKey(date)}
                    type="button"
                    disabled={!inRange}
                    aria-label={`${formatSolarDate(date)} ${weekdayLong(date)}${isBirthdayDate(date) ? '，生日' : ''}`}
                    aria-pressed={selected}
                    onClick={() => pickDay(date)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border border-transparent px-1 py-2 transition-colors',
                      inRange && 'hover:border-primary/25 hover:bg-primary/[0.045]',
                      !inRange && 'cursor-default opacity-35',
                    )}
                  >
                    <span className="text-[10px] leading-none text-muted-foreground">
                      {weekdayShort(date)}
                    </span>
                    <span className="flex flex-col items-center">
                      <span
                        className={cn(
                          'text-[16px] font-semibold leading-none tabular-nums',
                          todayCell ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {date.getDate()}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          'mt-[3px] h-[3.5px] w-full',
                          selected ? 'bg-primary' : 'bg-transparent',
                        )}
                      />
                    </span>
                    <span className="text-[9px] leading-none text-muted-foreground/70">
                      {lunar ? lunarCellLabel(lunar) : '—'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="relative flex h-full min-h-0 flex-col">
            <div className="absolute right-0 top-0 z-10">
              <SlidingSegmented
                options={YEAR_MODE_OPTIONS}
                value={yearMode}
                onValueChange={setYearMode}
                ariaLabel="年视图内容"
              />
            </div>
            <header className="flex shrink-0 items-center gap-4 pr-[196px]">
              <Tip label="生肖以正月初一为界，不按元旦">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[24px] font-semibold leading-none text-primary">
                  {yearMeta.animal}
                </span>
              </Tip>
              <p
                className="min-w-0 truncate text-[11px] leading-4 text-muted-foreground"
                title={`正月初一 ${yearMeta.startText} · 除夕 ${yearMeta.endText} · 全年 ${yearMeta.yearDays} 天 · ${
                  yearMeta.leapMonth
                    ? `闰${lunarMonthText(yearMeta.leapMonth, false)}`
                    : '无闰月'
                }`}
              >
                正月初一 {yearMeta.startText} · 除夕 {yearMeta.endText} · 全年 {yearMeta.yearDays}{' '}
                天 ·{' '}
                {yearMeta.leapMonth
                  ? `闰${lunarMonthText(yearMeta.leapMonth, false)}`
                  : '无闰月'}
              </p>
            </header>

            {yearMode === 'calendar' ? (
              <div className="mt-2 grid min-h-0 flex-1 auto-rows-[minmax(120px,1fr)] grid-cols-4 gap-2 overflow-y-auto scroll-thin">
                {yearMonths.map(({ month, cells }) => (
                  <section
                    key={month}
                    className={cn(
                      'flex min-h-0 flex-col overflow-hidden rounded-lg border p-1.5',
                      month === monthIndex
                        ? 'border-primary/35 bg-primary/[0.035]'
                        : 'border-border/40 bg-background/25',
                    )}
                  >
                    <div className="flex shrink-0 items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openMonth(month)}
                        className="text-[12px] font-medium leading-none text-foreground transition-colors hover:text-primary"
                      >
                        {month + 1}月
                      </button>
                      <span className="text-[9px] leading-none tabular-nums text-muted-foreground/60">
                        {daysInMonth(year, month)} 天
                      </span>
                    </div>
                    <div className="mt-1 grid shrink-0 grid-cols-7 text-center text-[8.5px] leading-none text-muted-foreground/55">
                      {WEEKDAY_LABELS.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                    <div className="mt-0.5 grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
                      {cells.map((cell, index) =>
                        cell ? (
                          <button
                            key={dateKey(cell.date)}
                            type="button"
                            disabled={!cell.inRange}
                            aria-label={`${cell.date.getFullYear()}年${cell.date.getMonth() + 1}月${cell.date.getDate()}日${isBirthdayDate(cell.date) ? '，生日' : ''}`}
                            aria-pressed={cell.isSelected}
                            onClick={() => pickDay(cell.date)}
                            className={cn(
                              'flex min-h-0 items-center justify-center rounded-[4px] text-[10px] leading-none tabular-nums transition-colors',
                              !cell.inRange
                                ? 'text-muted-foreground/25'
                                : cell.isSelected
                                  ? 'bg-primary font-semibold text-primary-foreground'
                                  : cell.isToday
                                    ? 'font-semibold text-primary hover:bg-primary/10'
                                    : 'text-foreground/80 hover:bg-primary/[0.08]',
                              isBirthdayDate(cell.date) &&
                                !cell.isSelected &&
                                'ring-1 ring-inset ring-primary/70',
                            )}
                          >
                            {cell.date.getDate()}
                          </button>
                        ) : (
                          <span key={`blank-${month}-${index}`} aria-hidden />
                        ),
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ) : yearMode === 'terms' ? (
              <div className="mt-2 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-3">
                <div className="grid min-h-0 grid-cols-4 gap-1.5">
                  {SEASON_ORDER.map((season) => {
                    const items = termCards.filter((item) => item.season === season)
                    return (
                      <section key={season} className="flex min-h-0 min-w-0 flex-col gap-1">
                        <h3
                          className={cn(
                            'shrink-0 rounded-md border px-1.5 py-0.5 text-center text-[10.5px] font-medium',
                            SEASON_STYLE[season],
                          )}
                        >
                          {season}
                        </h3>
                        {items.map((item) => (
                          <button
                            key={item.index}
                            type="button"
                            onClick={() => pickTerm(item)}
                            className={cn(
                              'flex min-h-0 flex-1 flex-col justify-center rounded-md border px-2 py-1 text-left transition-colors',
                              item.index === activeTerm?.index
                                ? 'border-primary/60 bg-primary/[0.09]'
                                : 'border-border/50 bg-background/40 hover:border-primary/40',
                            )}
                          >
                            <p className="text-[11.5px] leading-tight text-foreground">
                              {item.name}
                            </p>
                            <p className="mt-0.5 text-[10px] leading-none tabular-nums text-muted-foreground">
                              {item.dateText}
                            </p>
                          </button>
                        ))}
                      </section>
                    )
                  })}
                </div>

                <section className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border/40 bg-background/25 p-3 scroll-thin">
                  {activeTerm && termMeta ? (
                    <>
                      <header className="flex shrink-0 items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10.5px] font-medium tracking-[0.16em] text-muted-foreground">
                            节气
                          </p>
                          <h3 className="mt-1 text-[26px] font-semibold leading-none text-foreground">
                            {activeTerm.name}
                          </h3>
                          <p className="mt-2 text-[12px] leading-4 tabular-nums text-muted-foreground">
                            {formatSolarDate(activeTerm.date)}
                            <span className="mx-1.5 text-muted-foreground/35">·</span>
                            农历 {termLunar ? `${termLunar.year}年${termLunar.text}` : '—'}
                          </p>
                        </div>
                        <Tip label={copiedTerm ? '已复制' : '复制节气信息'}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="复制节气信息"
                            onClick={() => void copyTermInfo()}
                          >
                            {copiedTerm ? <Check className="text-success" /> : <Copy />}
                          </Button>
                        </Tip>
                      </header>

                      <p className="mt-3 shrink-0 text-[13px] leading-6 text-foreground/80">
                        {termMeta.description}
                      </p>

                      <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
                        <div className="rounded-md bg-foreground/[0.035] px-2.5 py-2">
                          <p className="text-[10px] leading-none text-muted-foreground">太阳黄经</p>
                          <p className="mt-1.5 text-[15px] font-semibold leading-none tabular-nums text-foreground">
                            {termMeta.longitude}°
                          </p>
                        </div>
                        <div className="rounded-md bg-foreground/[0.035] px-2.5 py-2">
                          <p className="text-[10px] leading-none text-muted-foreground">本节气</p>
                          <p className="mt-1.5 text-[15px] font-semibold leading-none tabular-nums text-foreground">
                            {termDuration ? `共 ${termDuration} 天` : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-lg bg-foreground/[0.03] p-2.5">
                        <div className="flex shrink-0 items-center justify-between gap-2">
                          <p className="text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground">
                            节气三候
                          </p>
                          <span className="text-[10px] text-muted-foreground/65">
                            {pentadIndex >= 0
                              ? `当前 · ${PENTAD_LABELS[pentadIndex]}`
                              : termDuration === 0
                                ? '—'
                                : '尚未开始'}
                          </span>
                        </div>
                        <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1">
                          {termMeta.pentads.map((name, index) => {
                            const range = pentadRanges[index]
                            const current = index === pentadIndex
                            return (
                              <div
                                key={name}
                                className={cn(
                                  'flex min-h-[32px] flex-1 items-center gap-2 rounded-md px-2 py-1.5',
                                  current && 'bg-primary/[0.08]',
                                )}
                              >
                                <span
                                  className={cn(
                                    'w-[26px] shrink-0 text-[10.5px]',
                                    current ? 'text-primary' : 'text-muted-foreground/70',
                                  )}
                                >
                                  {PENTAD_LABELS[index]}
                                </span>
                                <span
                                  className={cn(
                                    'min-w-0 flex-1 truncate text-[13px]',
                                    current ? 'font-medium text-foreground' : 'text-foreground/80',
                                  )}
                                >
                                  {name}
                                </span>
                                {range ? (
                                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/55">
                                    {range.start.getMonth() + 1}/{range.start.getDate()}–
                                    {range.end.getMonth() + 1}/{range.end.getDate()}
                                  </span>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="mt-3 shrink-0">
                        <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums text-muted-foreground/65">
                          <span>
                            {activeTerm.name} · {activeTerm.date.getMonth() + 1}/
                            {activeTerm.date.getDate()}
                          </span>
                          <span>
                            {nextTerm
                              ? `${nextTerm.name} · ${nextTerm.date.getMonth() + 1}/${nextTerm.date.getDate()}`
                              : '—'}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${termProgress}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10.5px] leading-4 text-muted-foreground">
                          {inTerm
                            ? `本节气第 ${termDay} 天${
                                nextTerm && daysToNext !== null
                                  ? ` · 距${nextTerm.name} ${daysToNext} 天`
                                  : ''
                              }`
                            : activeTerm && nextTerm
                              ? `本节气尚未开始 · 距${activeTerm.name} ${dayDiff(activeTerm.date, cursor)} 天`
                              : '本节气时间范围未知'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="py-8 text-center text-[11px] text-muted-foreground">
                      该日期超出农历换算范围
                    </p>
                  )}
                </section>
              </div>
            ) : holidayOverview ? (
              <div className="mt-2 grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] gap-3">
                <section className="flex min-h-0 flex-col rounded-lg border border-border/40 bg-background/25 p-3">
                  <header className="flex h-8 shrink-0 items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-foreground">{year} 年</h3>
                    <span className="ml-auto">
                      <Tip label={copiedHoliday ? '已复制' : '复制假期清单'}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="复制假期清单"
                          onClick={() => void copyHoliday()}
                        >
                          {copiedHoliday ? <Check className="text-success" /> : <Copy />}
                        </Button>
                      </Tip>
                    </span>
                  </header>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    按今天 {holidayOverview.todayText} 计算
                  </p>
                  <div className="mt-2.5 flex min-h-0 flex-1 flex-col justify-center rounded-lg bg-primary/[0.07] px-3 py-3">
                    {holidayOverview.ongoing ? (
                      <>
                        <p className="text-[10.5px] text-muted-foreground">假期中</p>
                        <p className="mt-1 text-[22px] font-semibold leading-none text-foreground">
                          {holidayOverview.ongoing.name}
                        </p>
                        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                          {holidayOverview.ongoing.rangeText} ·{' '}
                          {weekdayRangeOf(
                            holidayOverview.ongoing.start,
                            holidayOverview.ongoing.end,
                          )}{' '}
                          · 休{' '}
                          {holidayOverview.ongoing.daysOff} 天
                        </p>
                        <p className="mt-3 flex items-baseline gap-1.5">
                          <span className="text-[34px] font-semibold leading-none tabular-nums text-primary">
                            第 {holidayOverview.ongoing.ongoingDay} 天
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            / 共 {holidayOverview.ongoing.daysOff} 天
                          </span>
                        </p>
                      </>
                    ) : holidayOverview.next ? (
                      <>
                        <p className="text-[10.5px] text-muted-foreground">下一个假期</p>
                        <p className="mt-1 text-[22px] font-semibold leading-none text-foreground">
                          {holidayOverview.next.name}
                        </p>
                        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                          {holidayOverview.next.rangeText} ·{' '}
                          {weekdayRangeOf(
                            holidayOverview.next.start,
                            holidayOverview.next.end,
                          )}{' '}
                          · 休{' '}
                          {holidayOverview.next.daysOff} 天
                        </p>
                        <p className="mt-3 flex items-baseline gap-1.5">
                          <span className="text-[40px] font-semibold leading-none tabular-nums text-primary">
                            {holidayOverview.next.startDiff}
                          </span>
                          <span className="text-[12px] text-muted-foreground">天后</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10.5px] text-muted-foreground">本年假期</p>
                        <p className="mt-1 text-[20px] font-semibold leading-none text-foreground">
                          已全部度过
                        </p>
                        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                          全年 {holidayOverview.items.length} 个假期都已在身后
                        </p>
                      </>
                    )}
                  </div>
                  <div className="mt-3 shrink-0 space-y-2">
                    {[
                      { label: `${year} 年已过去`, value: holidayOverview.yearProgress },
                      { label: '假期已度过', value: holidayOverview.vacationProgress },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className="w-[96px] shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                          {item.label}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                          {item.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/40 bg-background/25">
                  <header className="flex h-8 shrink-0 items-center gap-2 border-b border-border/40 px-3">
                    <h3 className="text-[13.5px] font-medium text-foreground">全年假期</h3>
                    <span className="ml-auto text-[11.5px] text-muted-foreground">
                      {holidayOverview.items.length} 个
                    </span>
                  </header>
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pr-0.5 scroll-thin">
                    {holidayOverview.items.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        disabled={!item.canJump}
                        aria-label={`${item.name} ${item.rangeText} ${item.daysOff} 天 ${item.statusText}`}
                        title={`${item.basis}${item.makeup.length ? ` · 调休：${item.makeup.join('、')}` : ''}`}
                        onClick={() => pickHoliday(item)}
                        className={cn(
                          'flex min-h-[48px] w-full flex-1 flex-col justify-center gap-1 border-b border-border/40 px-3 py-1.5 text-left transition-colors last:border-b-0',
                          item.canJump ? 'hover:bg-primary/[0.045]' : 'cursor-default',
                          sameDay(cursor, item.jumpDate) && 'bg-primary/[0.06]',
                        )}
                      >
                        <span className="flex min-w-0 items-baseline gap-1.5">
                          <span className="shrink-0 text-[14px] font-semibold leading-none text-foreground">
                            {item.name}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[11.5px] leading-none tabular-nums text-muted-foreground">
                            {item.rangeText}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[10px] leading-none text-muted-foreground">
                            {weekdayRangeOf(item.start, item.end)}
                          </span>
                          <span aria-hidden className="min-w-0 flex-1" />
                          <span
                            className={cn(
                              'shrink-0 text-[11.5px] font-medium leading-none tabular-nums',
                              item.ongoing || item.startDiff > 0
                                ? 'text-primary'
                                : 'text-muted-foreground',
                            )}
                          >
                            {item.statusText}
                          </span>
                        </span>
                        <span className="flex min-w-0 items-center gap-2 overflow-hidden text-[11.5px] leading-4 text-muted-foreground">
                          <span className="shrink-0">休 {item.daysOff} 天</span>
                          {item.makeup.length ? (
                            <span className="whitespace-nowrap text-[10.5px] leading-4 text-foreground/70">
                              调休：{item.makeup.join('、')}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="glass flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-panel px-4 py-2.5">
        <div className="flex shrink-0 items-center gap-2.5">
          <DateField
            value={cursor.getTime()}
            onChange={(ms) => setCursor(clampToCalendar(new Date(ms)))}
            min={CALENDAR_MIN_MS}
            max={CALENDAR_MAX_MS}
            ariaLabel="选中日期"
            className="h-8 w-auto rounded-md border-0 px-0 font-mono text-[21px] font-medium tracking-[-0.02em] hover:border-0 hover:bg-foreground/[0.035] focus-visible:bg-primary/[0.06] focus-visible:ring-0"
          />
          <span className="text-[12.5px] text-muted-foreground">
            {cursorLunar?.weekday ?? '—'}
          </span>
          {isToday ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] leading-none text-primary">
              今天
            </span>
          ) : null}
          {cursorHoliday ? (
            <span
              className={cn(
                'text-[12px] font-semibold leading-none',
                cursorHoliday === 'holiday' ? 'text-destructive' : 'text-primary',
              )}
            >
              {cursorHoliday === 'holiday' ? '休' : '班'}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[14.5px] font-medium leading-5 text-foreground">
            {cursorLunar?.fullText ?? '超出支持范围'}
          </span>
          <span className="text-[11.5px] leading-4 text-muted-foreground">
            {cursorLunar
              ? `${cursorLunar.animal}年 · ${cursorLunar.ganZhiYear}年 ${cursorLunar.ganZhiMonth}月 ${cursorLunar.ganZhiDay}日`
              : ''}
          </span>
          {cursorLunar?.term ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] leading-none text-primary">
              {cursorLunar.term}
            </span>
          ) : null}
          {cursorLunar?.isLeap ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] leading-none text-primary">
              闰月
            </span>
          ) : null}
          {cursorHolidayName ? (
            <span className="text-[11.5px] leading-4 text-muted-foreground">
              {cursorHolidayName}
            </span>
          ) : null}
          {cursorHolidayMissing ? (
            <span className="text-[10.5px] leading-4 text-muted-foreground/70">
              节假日表未加载
            </span>
          ) : null}
          <span className="text-[10.5px] tabular-nums leading-4 text-muted-foreground/80">
            月长 {cursorLunar?.monthDays ?? '—'} 天 · 年长 {cursorLunar?.yearDays ?? '—'} 天
          </span>
        </div>

        <Tip label={copied ? '已复制' : '复制详情'}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="复制详情"
            disabled={!cursorLunar}
            onClick={() => void copyDetail()}
          >
            {copied ? <Check className="text-success" /> : <Copy />}
          </Button>
        </Tip>
      </section>
    </main>
  )
}
