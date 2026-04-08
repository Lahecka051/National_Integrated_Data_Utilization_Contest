/**
 * 반차 일정 최적화 엔진 (TS 포팅)
 */
import type { Errand, HalfDayType, SlotRecommendation, FacilityType, WeatherCondition } from '../types'
import { getDirections } from '../external/kakaoApi'
import { fetchWeatherForecast, parseWeatherForecast } from '../external/publicDataApi'
import { resolveFacilitiesForTypes, type ResolvedFacility } from './facilityFinder'
import { calcCivilWait, calcBankWait, calcPostWait, getTaskDuration } from './waitTimeModel'
import { DEFAULT_WEATHER_GRID } from '../config/apiKeys'

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']
const DAY_NAME_FULL = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']

function getWaitTime(ftype: FacilityType, weekday: number, hour: number, dayOfMonth: number): number {
  if (ftype === '민원실') return calcCivilWait(weekday, hour, dayOfMonth)
  if (ftype === '은행') return calcBankWait(weekday, hour, dayOfMonth)
  if (ftype === '우체국') return calcPostWait(weekday, hour)
  return 10
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

async function travelMinutes(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<number> {
  const result = await getDirections(fromLng, fromLat, toLng, toLat)
  if (result && result.duration) return Math.max(1, Math.round(result.duration / 60))
  // Fallback: haversine * 1.4 / 30 km/h
  const distKm = haversineKm(fromLat, fromLng, toLat, toLng) * 1.4
  return Math.max(5, Math.round((distKm / 30) * 60))
}

interface PointInfo {
  id: string
  lat: number
  lng: number
}

type TravelMatrix = Map<string, number>
const matKey = (from: string, to: string) => `${from}|${to}`

async function buildTravelMatrix(
  originLat: number,
  originLng: number,
  facilities: ResolvedFacility[],
): Promise<TravelMatrix> {
  const points: PointInfo[] = [{ id: 'start', lat: originLat, lng: originLng }]
  for (const f of facilities) points.push({ id: f.id, lat: f.lat, lng: f.lng })

  const matrix: TravelMatrix = new Map()
  const tasks: Promise<void>[] = []

  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i === j) {
        matrix.set(matKey(points[i].id, points[j].id), 0)
        continue
      }
      const a = points[i]
      const b = points[j]
      tasks.push(
        travelMinutes(a.lat, a.lng, b.lat, b.lng).then(m => {
          matrix.set(matKey(a.id, b.id), m)
        }).catch(() => {
          matrix.set(matKey(a.id, b.id), 15)
        }),
      )
    }
  }
  await Promise.all(tasks)
  return matrix
}

interface Group {
  facility: ResolvedFacility
  task_names: string[]
  total_duration: number
}

function groupErrands(errands: Errand[], facilityMap: Record<string, ResolvedFacility>): Group[] {
  const groups: Record<string, Group> = {}
  for (const e of errands) {
    const facility = facilityMap[e.task_type]
    if (!facility) continue
    if (!groups[facility.id]) {
      groups[facility.id] = {
        facility,
        task_names: [],
        total_duration: 0,
      }
    }
    groups[facility.id].task_names.push(e.task_name)
    groups[facility.id].total_duration += getTaskDuration(e.task_name)
  }
  return Object.values(groups)
}

interface OrderedStop {
  facility: ResolvedFacility
  task_names: string[]
  wait: number
  duration: number
  travel: number
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr]
  const result: T[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of permutations(rest)) result.push([arr[i], ...p])
  }
  return result
}

function findOptimalOrder(
  groups: Group[],
  matrix: TravelMatrix,
  weekday: number,
  startHour: number,
  dayOfMonth: number,
): OrderedStop[] {
  const n = groups.length
  if (n === 0) return []

  const build = (order: number[]): OrderedStop[] => {
    const result: OrderedStop[] = []
    let cumulative = 0
    for (let i = 0; i < order.length; i++) {
      const g = groups[order[i]]
      const fromId = i === 0 ? 'start' : groups[order[i - 1]].facility.id
      const travel = matrix.get(matKey(fromId, g.facility.id)) ?? 15
      cumulative += travel
      const currentHour = startHour + Math.floor(cumulative / 60)
      const wait = getWaitTime(g.facility.type as FacilityType, weekday, Math.min(currentHour, 17), dayOfMonth)
      result.push({
        facility: g.facility,
        task_names: g.task_names,
        wait,
        duration: g.total_duration,
        travel,
      })
      cumulative += wait + g.total_duration
    }
    return result
  }

  if (n === 1) return build([0])

  let bestOrder: number[] | null = null
  let bestCost = Infinity

  for (const perm of permutations(Array.from({ length: n }, (_, i) => i))) {
    let total = 0
    for (let i = 0; i < perm.length; i++) {
      const g = groups[perm[i]]
      const fromId = i === 0 ? 'start' : groups[perm[i - 1]].facility.id
      const travel = matrix.get(matKey(fromId, g.facility.id)) ?? 15
      total += travel
      const currentHour = startHour + Math.floor(total / 60)
      const wait = getWaitTime(g.facility.type as FacilityType, weekday, Math.min(currentHour, 17), dayOfMonth)
      total += wait + g.total_duration
    }
    if (total < bestCost) {
      bestCost = total
      bestOrder = perm
    }
  }

  return build(bestOrder || Array.from({ length: n }, (_, i) => i))
}

interface WeatherData {
  condition: WeatherCondition
  temperature: number
  rain_probability: number
  penalty_factor: number
}

async function getWeather(date: Date): Promise<WeatherData> {
  try {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const baseDate = `${y}${m}${d}`
    const raw = await fetchWeatherForecast(DEFAULT_WEATHER_GRID.nx, DEFAULT_WEATHER_GRID.ny, baseDate)
    if (raw) {
      const parsed = parseWeatherForecast(raw)
      if (parsed) return parsed
    }
  } catch {}
  return { condition: '맑음', temperature: 20, rain_probability: 10, penalty_factor: 1.0 }
}

async function simulateSlot(
  errands: Errand[],
  targetDate: Date,
  halfDay: HalfDayType,
  facilityMap: Record<string, ResolvedFacility>,
  travelMatrix: TravelMatrix,
  weatherCache: Map<string, WeatherData>,
  customStartHour?: number,
  customEndHour?: number,
): Promise<SlotRecommendation> {
  const weekday = (targetDate.getDay() + 6) % 7   // Mon=0
  const dayOfMonth = targetDate.getDate()

  let startHour: number
  if (customStartHour !== undefined) startHour = customStartHour
  else if (halfDay === '오전반차') startHour = 9
  else if (halfDay === '오후반차') startHour = 14
  else startHour = 9

  const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
  let weatherData = weatherCache.get(dateKey)
  if (!weatherData) {
    weatherData = await getWeather(targetDate)
    weatherCache.set(dateKey, weatherData)
  }
  const isRain = weatherData.condition === '비'

  const groups = groupErrands(errands, facilityMap)
  const order = findOptimalOrder(groups, travelMatrix, weekday, startHour, dayOfMonth)

  const visits: any[] = []
  let currentMinutes = startHour * 60
  let totalWait = 0
  let totalTravel = 0

  for (let i = 0; i < order.length; i++) {
    const item = order[i]
    let travel = item.travel
    if (isRain) travel = Math.round(travel * 1.2)
    const arrival = currentMinutes + travel
    totalTravel += travel
    totalWait += item.wait

    const arrH = Math.floor(arrival / 60)
    const arrM = arrival % 60
    const depart = arrival + item.wait + item.duration
    const depH = Math.floor(depart / 60)
    const depM = depart % 60

    visits.push({
      facility: { ...item.facility },
      arrival_time: `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`,
      wait_time: item.wait,
      process_time: item.duration,
      departure_time: `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`,
      travel_time_to_next: i < order.length - 1 ? order[i + 1].travel : undefined,
      travel_mode: 'car',
      travel_minutes: travel,
      task_names: item.task_names,
      bus_info: null,
    })
    currentMinutes = depart
  }

  const totalMinutes = Math.round(currentMinutes - startHour * 60)
  const endLimit = customEndHour !== undefined ? customEndHour * 60 : null
  let overflowPenalty = 0
  if (endLimit !== null && currentMinutes > endLimit) {
    overflowPenalty = Math.round(currentMinutes - endLimit) * 10
  }
  const weatherPenalty = isRain ? 5 : 0

  const reasons: string[] = []
  if (totalWait <= 15) reasons.push('대기시간 짧음')
  if (weatherData.condition === '맑음') reasons.push('맑음')
  if ([1, 3].includes(weekday)) reasons.push(`${DAY_NAMES[weekday]}요일 한산`)
  if (dayOfMonth >= 25 || dayOfMonth <= 2) reasons.push('월말/월초 은행 혼잡')
  if (weekday === 4) reasons.push('금요일 혼잡')
  if (isRain) reasons.push('비 예보')
  const reason = reasons.length > 0 ? reasons.join(' + ') : '보통'

  return {
    rank: 0,
    date: dateKey,
    day_of_week: `${DAY_NAMES[weekday]}요일`,
    half_day_type: halfDay,
    visits,
    weather: {
      condition: weatherData.condition,
      temperature: weatherData.temperature,
      rain_probability: weatherData.rain_probability,
      penalty_factor: weatherData.penalty_factor,
    },
    total_wait_time: totalWait,
    total_travel_time: totalTravel,
    total_minutes: totalMinutes + weatherPenalty + overflowPenalty,
    reason,
    is_recommended: true,
  }
}

export async function recommendBestSlots(
  errands: Errand[],
  originLat: number,
  originLng: number,
  weeks = 4,
  timeConstraint?: {
    start_time?: string | null
    end_time?: string | null
    date?: string | null
    start_date?: string | null
  } | null,
): Promise<{ recommendations: SlotRecommendation[]; not_recommended: SlotRecommendation | null; note?: string }> {
  if (!errands || errands.length === 0) {
    return { recommendations: [], not_recommended: null, note: '처리할 용무가 없습니다.' }
  }

  const uniqueTypes = new Set(errands.map(e => e.task_type))

  // 1) 사용자가 ErrandSelectPage에서 직접 선택한 시설(예: 특정 은행 지점)을 우선 사용.
  //    같은 type에 selected_facility가 여러 개면 마지막 것을 사용 (덮어쓰기).
  const userSelected: Record<string, ResolvedFacility> = {}
  for (const e of errands) {
    if (!e.selected_facility) continue
    const sf = e.selected_facility
    userSelected[e.task_type] = {
      id: sf.id,
      name: sf.name,
      type: e.task_type,
      address: sf.address || '',
      lat: sf.lat,
      lng: sf.lng,
      open_time: '09:00',
      close_time: e.task_type === '은행' ? '16:00' : '18:00',
    }
  }

  // 2) 사용자가 직접 안 고른 type만 자동 검색.
  const typesToResolve = new Set<string>()
  for (const t of uniqueTypes) {
    if (!(t in userSelected)) typesToResolve.add(t)
  }
  const facilityMapRaw = typesToResolve.size > 0
    ? await resolveFacilitiesForTypes(typesToResolve, originLat, originLng)
    : {}

  // 3) 병합 (사용자 선택이 항상 우선).
  const facilityMap: Record<string, ResolvedFacility> = {}
  for (const [k, v] of Object.entries(facilityMapRaw)) {
    if (v) facilityMap[k] = v
  }
  for (const [k, v] of Object.entries(userSelected)) {
    facilityMap[k] = v
  }

  if (Object.keys(facilityMap).length === 0) {
    return { recommendations: [], not_recommended: null, note: '현재 위치 주변에서 처리 가능한 시설을 찾지 못했습니다.' }
  }

  // 시간/날짜 제약 파싱
  let customStart: number | undefined
  let customEnd: number | undefined
  let minDate: Date | null = null
  let exactDate: Date | null = null

  if (timeConstraint) {
    if (timeConstraint.start_time && timeConstraint.end_time) {
      customStart = parseInt(timeConstraint.start_time.split(':')[0], 10)
      customEnd = parseInt(timeConstraint.end_time.split(':')[0], 10)
    }
    if (timeConstraint.start_date) {
      const d = new Date(timeConstraint.start_date + 'T00:00:00')
      if (!isNaN(d.getTime())) minDate = d
    }
    if (timeConstraint.date) {
      const d = new Date(timeConstraint.date + 'T00:00:00')
      if (!isNaN(d.getTime())) exactDate = d
    }
  }

  const facilityTypesLabel = Array.from(uniqueTypes).sort().join('/')

  // === 정확한 날짜 모드 ===
  if (exactDate) {
    const weekday = (exactDate.getDay() + 6) % 7
    if (weekday >= 5) {
      const dayName = DAY_NAME_FULL[weekday]
      const y = exactDate.getFullYear()
      const m = String(exactDate.getMonth() + 1).padStart(2, '0')
      const d = String(exactDate.getDate()).padStart(2, '0')
      return {
        recommendations: [],
        not_recommended: null,
        note: `${y}-${m}-${d}(${dayName})은 주말이라 ${facilityTypesLabel}이 운영하지 않습니다. 가까운 평일을 알려드릴까요?`,
      }
    }

    const travelMatrix = await buildTravelMatrix(originLat, originLng, Object.values(facilityMap))
    const weatherCache = new Map<string, WeatherData>()
    const slots: SlotRecommendation[] = []

    if (customStart !== undefined && customEnd !== undefined) {
      const halfDay: HalfDayType = customStart < 12 ? '오전반차' : '오후반차'
      slots.push(await simulateSlot(errands, exactDate, halfDay, facilityMap, travelMatrix, weatherCache, customStart, customEnd))
    } else {
      for (const hd of ['오전반차', '오후반차', '연차'] as HalfDayType[]) {
        slots.push(await simulateSlot(errands, exactDate, hd, facilityMap, travelMatrix, weatherCache))
      }
    }

    slots.sort((a, b) => a.total_minutes - b.total_minutes)
    slots.forEach((s, i) => { s.rank = i + 1; s.is_recommended = true })
    const y = exactDate.getFullYear()
    const m = String(exactDate.getMonth() + 1).padStart(2, '0')
    const d = String(exactDate.getDate()).padStart(2, '0')
    return {
      recommendations: slots,
      not_recommended: null,
      note: `${y}-${m}-${d}(${DAY_NAME_FULL[weekday]}) 일정만 추천합니다.`,
    }
  }

  // === 일반 추천 모드 ===
  const travelMatrix = await buildTravelMatrix(originLat, originLng, Object.values(facilityMap))
  const today = new Date()
  const slots: SlotRecommendation[] = []
  const weatherCache = new Map<string, WeatherData>()

  for (let offset = 1; offset <= weeks * 7; offset++) {
    const target = new Date(today)
    target.setDate(target.getDate() + offset)
    const wd = (target.getDay() + 6) % 7
    if (wd >= 5) continue
    if (minDate && target < minDate) continue

    if (customStart !== undefined && customEnd !== undefined) {
      const halfDay: HalfDayType = customStart < 12 ? '오전반차' : '오후반차'
      slots.push(await simulateSlot(errands, target, halfDay, facilityMap, travelMatrix, weatherCache, customStart, customEnd))
    } else {
      for (const hd of ['오전반차', '오후반차', '연차'] as HalfDayType[]) {
        slots.push(await simulateSlot(errands, target, hd, facilityMap, travelMatrix, weatherCache))
      }
    }
  }

  if (slots.length === 0) {
    return {
      recommendations: [],
      not_recommended: null,
      note: '추천 가능한 평일 슬롯이 없습니다. 날짜 조건을 확인해주세요.',
    }
  }

  slots.sort((a, b) => a.total_minutes - b.total_minutes)
  const recommendations: SlotRecommendation[] = []
  for (let i = 0; i < Math.min(3, slots.length); i++) {
    slots[i].rank = i + 1
    slots[i].is_recommended = true
    recommendations.push(slots[i])
  }
  const worst = slots.length > 0 ? slots[slots.length - 1] : null
  if (worst) {
    worst.rank = slots.length
    worst.is_recommended = false
  }

  return {
    recommendations,
    not_recommended: worst,
  }
}
