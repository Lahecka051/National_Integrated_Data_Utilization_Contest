/**
 * 출장 여행 플랜 추천 서비스 (TS 포팅)
 */
import { geocodeAddress, reverseGeocode } from '../external/kakaoApi'
import { fetchNearbyTrainStations, fetchTrainSchedules, type TransitHub } from '../external/railApi'
import { fetchNearbyBusTerminals, fetchExpbusSchedules } from '../external/busTerminalApi'
import { fetchNearbyParking, type PublicParking } from '../external/parkingApi'
import { suggestMainStation } from './cityCode'

const TRAIN_AVG_KMH = 150
const BUS_AVG_KMH = 85
const TRAIN_COST_PER_KM = 105
const BUS_COST_PER_KM = 62
const WALK_SPEED_M_PER_MIN = 70

// 도시 대중교통(지하철+버스) 평균 속도 — 환승/대기 포함 추정용
const TRANSIT_AVG_KMH = 22
// 첫 도보 + 환승 여유
const TRANSIT_FIXED_OVERHEAD_MIN = 10

/**
 * 출발지 → 출발 허브 대중교통 이동시간 추정.
 * (카카오 REST에 대중교통 길찾기가 없어 거리 기반 폴백 사용)
 */
function estimateTransitMinutes(distanceKm: number): number {
  return Math.max(10, Math.round(TRANSIT_FIXED_OVERHEAD_MIN + (distanceKm / TRANSIT_AVG_KMH) * 60))
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

function estimateTravel(distKm: number, mode: 'train' | 'expbus'): { duration_min: number; fare_won: number; grade: string } {
  if (mode === 'train') {
    const speed = distKm >= 50 ? TRAIN_AVG_KMH : 80
    const duration = Math.max(25, Math.floor((distKm / speed) * 60))
    const fare = Math.floor((distKm * TRAIN_COST_PER_KM) / 100) * 100
    const grade = distKm >= 100 ? 'KTX급' : 'ITX/무궁화'
    return { duration_min: duration, fare_won: fare, grade }
  } else {
    const duration = Math.max(30, Math.floor((distKm / BUS_AVG_KMH) * 60))
    const fare = Math.floor((distKm * BUS_COST_PER_KM) / 100) * 100
    const grade = distKm >= 100 ? '고속버스 우등' : '고속버스 일반'
    return { duration_min: duration, fare_won: fare, grade }
  }
}

function parseTagoTime(value: string): string | null {
  if (!value || value.length < 12) return null
  return `${value.slice(8, 10)}:${value.slice(10, 12)}`
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function walkMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / WALK_SPEED_M_PER_MIN))
}

async function findHubsNear(lat: number, lng: number, wantTrain: boolean, wantBus: boolean) {
  const result: { trains: TransitHub[]; buses: TransitHub[] } = { trains: [], buses: [] }
  if (wantTrain) {
    const r = await fetchNearbyTrainStations(lat, lng, 15000)
    result.trains = r.hubs.slice(0, 3)
  }
  if (wantBus) {
    const r = await fetchNearbyBusTerminals(lat, lng, 15000)
    result.buses = r.hubs.slice(0, 2)
  }
  return result
}

async function resolveDestinationHubs(
  destName: string, destLat: number, destLng: number, wantTrain: boolean, wantBus: boolean,
) {
  const result: { trains: TransitHub[]; buses: TransitHub[] } = { trains: [], buses: [] }

  if (wantTrain) {
    const suggested = suggestMainStation(destName)
    if (suggested) {
      const geo = await geocodeAddress(suggested)
      if (geo) {
        const r = await fetchNearbyTrainStations(geo.lat, geo.lng, 5000)
        const hubs = r.hubs
        const matched = hubs.find(h => suggested === h.name || h.name.includes(suggested))
        if (matched) result.trains = [matched]
        else if (hubs.length > 0) result.trains = [hubs[0]]
      }
    }
    if (result.trains.length === 0) {
      const r = await fetchNearbyTrainStations(destLat, destLng, 15000)
      if (r.hubs.length > 0) result.trains = [r.hubs[0]]
    }
  }

  if (wantBus) {
    const r = await fetchNearbyBusTerminals(destLat, destLng, 15000)
    if (r.hubs.length > 0) result.buses = [r.hubs[0]]
  }

  return result
}

async function pickParking(hubLat: number, hubLng: number, radius = 700): Promise<PublicParking | null> {
  const res = await fetchNearbyParking(hubLat, hubLng, radius)
  if (!res.parkings.length) return null
  const scoreMap: Record<string, number> = { '여유': 40, '보통': 25, '정보없음': 15, '혼잡': 5, '만차': -20 }
  const sorted = [...res.parkings].sort((a, b) => {
    const sa = (scoreMap[a.status] ?? 10) - a.distance / 50
    const sb = (scoreMap[b.status] ?? 10) - b.distance / 50
    return sb - sa
  })
  return sorted[0]
}

function buildScheduleFromTago(item: any, mode: 'train' | 'expbus'): any | null {
  try {
    const depRaw = String(item.depPlandTime || '')
    const arrRaw = String(item.arrPlandTime || '')
    const depHhmm = parseTagoTime(depRaw)
    const arrHhmm = parseTagoTime(arrRaw)
    if (!depHhmm || !arrHhmm) return null
    const depDt = new Date(
      parseInt(depRaw.slice(0, 4)), parseInt(depRaw.slice(4, 6)) - 1, parseInt(depRaw.slice(6, 8)),
      parseInt(depRaw.slice(8, 10)), parseInt(depRaw.slice(10, 12)),
    )
    const arrDt = new Date(
      parseInt(arrRaw.slice(0, 4)), parseInt(arrRaw.slice(4, 6)) - 1, parseInt(arrRaw.slice(6, 8)),
      parseInt(arrRaw.slice(8, 10)), parseInt(arrRaw.slice(10, 12)),
    )
    const duration = Math.floor((arrDt.getTime() - depDt.getTime()) / 60000)
    if (duration <= 0) return null
    const fare = parseInt(String(item.adultCharge || item.charge || 0), 10) || 0
    const vehicle = mode === 'train'
      ? `${item.trainGradeName || '열차'} ${item.trainNo || ''}`.trim()
      : String(item.gradeNm || '고속버스').trim()
    const grade = mode === 'train' ? (item.trainGradeName || '') : (item.gradeNm || '')
    const depDateStr = `${depDt.getFullYear()}-${String(depDt.getMonth() + 1).padStart(2, '0')}-${String(depDt.getDate()).padStart(2, '0')}`
    const arrDateStr = `${arrDt.getFullYear()}-${String(arrDt.getMonth() + 1).padStart(2, '0')}-${String(arrDt.getDate()).padStart(2, '0')}`
    return {
      mode,
      vehicle_name: vehicle || (mode === 'train' ? '열차편' : '버스편'),
      dep_date: depDateStr,
      dep_time: depHhmm,
      arr_date: arrDateStr,
      arr_time: arrHhmm,
      duration_min: duration,
      fare_won: fare,
      is_estimated: false,
      grade,
      note: '실시간 시간표',
    }
  } catch {
    return null
  }
}

async function makeSchedule(
  originHub: TransitHub & { tago_id?: string },
  destHub: TransitHub & { tago_id?: string },
  mode: 'train' | 'expbus',
  dateStr: string,
  earliestHhmm: string,
): Promise<any> {
  let tagoItems: any[] = []
  try {
    const depPlandtime = dateStr.replace(/-/g, '')
    if (mode === 'train') {
      tagoItems = await fetchTrainSchedules(
        String(originHub.tago_id || ''),
        String(destHub.tago_id || ''),
        depPlandtime,
      )
    } else {
      tagoItems = await fetchExpbusSchedules(
        String(originHub.tago_id || ''),
        String(destHub.tago_id || ''),
        depPlandtime,
      )
    }
  } catch {
    tagoItems = []
  }

  if (tagoItems.length > 0) {
    const candidates: any[] = []
    for (const it of tagoItems) {
      const s = buildScheduleFromTago(it, mode)
      if (s && s.dep_time >= earliestHhmm) candidates.push(s)
    }
    candidates.sort((a, b) => a.dep_time.localeCompare(b.dep_time))
    if (candidates.length > 0) return candidates[0]
  }

  // 폴백: 거리 기반 추정
  const distKm = haversineKm(originHub.lat, originHub.lng, destHub.lat, destHub.lng)
  const { duration_min, fare_won, grade } = estimateTravel(distKm, mode)

  const depDt = new Date(`${dateStr}T${earliestHhmm}:00`)
  const arrDt = new Date(depDt.getTime() + duration_min * 60000)
  const depDateStr = `${depDt.getFullYear()}-${String(depDt.getMonth() + 1).padStart(2, '0')}-${String(depDt.getDate()).padStart(2, '0')}`
  const arrDateStr = `${arrDt.getFullYear()}-${String(arrDt.getMonth() + 1).padStart(2, '0')}-${String(arrDt.getDate()).padStart(2, '0')}`
  const arrHhmm = `${String(arrDt.getHours()).padStart(2, '0')}:${String(arrDt.getMinutes()).padStart(2, '0')}`

  return {
    mode,
    vehicle_name: `${grade} (예상)`,
    dep_date: depDateStr,
    dep_time: earliestHhmm,
    arr_date: arrDateStr,
    arr_time: arrHhmm,
    duration_min,
    fare_won,
    is_estimated: true,
    grade,
    note: `${distKm.toFixed(0)}km 거리 기반 추정`,
  }
}

function hubToDict(h: TransitHub) {
  return {
    id: h.id, name: h.name, type: h.type, address: h.address,
    lat: h.lat, lng: h.lng,
  }
}

function parkingSummary(p: PublicParking, hubLat: number, hubLng: number) {
  const distM = Math.round(haversineKm(p.lat, p.lng, hubLat, hubLng) * 1000)
  return {
    id: p.id, name: p.name, address: p.address,
    lat: p.lat, lng: p.lng,
    distance_to_hub: distM, walk_minutes: walkMinutes(distM),
    status: p.status, available_slots: p.available_slots,
    total_slots: p.total_slots, fee_info: p.fee_info,
  }
}

function scorePlan(plan: any, originDistanceM: number): number {
  const duration = plan.total_duration_min
  let base = Math.max(0, Math.min(100, Math.floor(100 - ((duration - 60) * 100) / 180)))
  const parking = plan.parking
  if (parking) {
    const bonus: Record<string, number> = { '여유': 10, '보통': 5, '정보없음': 2, '혼잡': -5, '만차': -15 }
    base += bonus[parking.status] ?? 0
    if (parking.walk_minutes <= 5) base += 5
  }
  if (!plan.schedule.is_estimated) base += 5
  // 차량 모드는 origin~허브 거리에 따라 보정. 대중교통은 거리 페널티 적용 안 함.
  if (plan.access_mode === 'drive') {
    if (originDistanceM <= 2000) base += 10
    else if (originDistanceM <= 5000) base += 5
    else if (originDistanceM > 10000) base -= 5
  }
  return Math.max(0, Math.min(100, base))
}

function buildReasons(plan: any, isFastest: boolean, isCheapest: boolean): string[] {
  const reasons: string[] = []
  if (isFastest) reasons.push('최단 소요시간')
  if (isCheapest) reasons.push('최저 요금')
  const parking = plan.parking
  if (parking) {
    if (parking.status === '여유') reasons.push('주차 여유')
    if (parking.walk_minutes <= 5) reasons.push('역과 가까움')
  }
  if (plan.access_mode === 'transit') {
    reasons.push('대중교통 이용')
  }
  if (!plan.schedule.is_estimated) reasons.push('실시간 시간표')
  return reasons.length > 0 ? reasons : ['표준 추천']
}

export async function recommendTrip(params: {
  origin_lat: number
  origin_lng: number
  destination: string
  /** 선택적 사전 해석된 좌표. 제공되면 geocoding 단계 건너뜀. */
  destination_lat?: number
  destination_lng?: number
  /** 사용자가 직접 선택한 도착 허브 — 제공되면 허브 검색도 건너뜀 */
  destination_hub?: {
    id: string
    name: string
    type: 'train_station' | 'bus_terminal'
    address: string
    lat: number
    lng: number
  }
  date: string
  earliest_departure?: string
  parking_preference?: 'near_hub' | 'near_home'
  modes?: ('train' | 'expbus')[]
  access_mode?: 'drive' | 'transit'
}): Promise<any> {
  const {
    origin_lat, origin_lng, destination,
    destination_lat: prefLat, destination_lng: prefLng,
    destination_hub: destHubInput,
    date,
    earliest_departure = '08:00',
    parking_preference = 'near_hub',
    modes = ['train', 'expbus'],
    access_mode = 'drive',
  } = params

  // 도착 허브가 미리 선택된 경우: 해당 허브 타입에 맞게 modes를 강제
  // (예: 기차역이면 train만, 터미널이면 expbus만)
  const effectiveModes: ('train' | 'expbus')[] = destHubInput
    ? (destHubInput.type === 'train_station' ? ['train'] : ['expbus'])
    : modes
  const wantTrain = effectiveModes.includes('train')
  const wantBus = effectiveModes.includes('expbus')

  // 1. 목적지 해석 — 우선순위: destHubInput > prefLat/prefLng > geocoding
  let destLat: number
  let destLng: number
  let destResolved: string

  if (destHubInput) {
    destLat = destHubInput.lat
    destLng = destHubInput.lng
    destResolved = destHubInput.name
  } else if (typeof prefLat === 'number' && typeof prefLng === 'number') {
    destLat = prefLat
    destLng = prefLng
    destResolved = destination
  } else {
    let geo = await geocodeAddress(destination)
    if (!geo) geo = await geocodeAddress(`${destination}역`)
    if (!geo) {
      return {
        plans: [],
        destination_resolved: '',
        destination_lat: 0,
        destination_lng: 0,
        origin_address: '',
        has_realtime_schedule: false,
        note: `목적지 '${destination}'을(를) 찾을 수 없습니다.`,
      }
    }
    destLat = geo.lat
    destLng = geo.lng
    destResolved = geo.road_address || geo.address || destination
  }

  // 2. 출발지 주소
  const originRev = await reverseGeocode(origin_lat, origin_lng)
  const originAddress = originRev ? (originRev.road_address || originRev.address || '') : ''

  // 3. 허브 수집
  const origHubs = await findHubsNear(origin_lat, origin_lng, wantTrain, wantBus)
  // 도착 허브: 사용자가 직접 선택했으면 그것만 사용, 아니면 근처 허브 검색
  const destHubs: { trains: TransitHub[]; buses: TransitHub[] } = destHubInput
    ? {
        trains: destHubInput.type === 'train_station'
          ? [{
              id: destHubInput.id,
              name: destHubInput.name,
              type: 'train_station',
              address: destHubInput.address,
              lat: destHubInput.lat,
              lng: destHubInput.lng,
              distance: 0,
              category: '',
              phone: '',
            }]
          : [],
        buses: destHubInput.type === 'bus_terminal'
          ? [{
              id: destHubInput.id,
              name: destHubInput.name,
              type: 'bus_terminal',
              address: destHubInput.address,
              lat: destHubInput.lat,
              lng: destHubInput.lng,
              distance: 0,
              category: '',
              phone: '',
            }]
          : [],
      }
    : await resolveDestinationHubs(destination, destLat, destLng, wantTrain, wantBus)

  if (origHubs.trains.length === 0 && origHubs.buses.length === 0) {
    return {
      plans: [], destination_resolved: destResolved,
      destination_lat: destLat, destination_lng: destLng,
      origin_address: originAddress, has_realtime_schedule: false,
      note: '출발지 근처에서 기차역/터미널을 찾지 못했습니다.',
    }
  }
  if (destHubs.trains.length === 0 && destHubs.buses.length === 0) {
    return {
      plans: [], destination_resolved: destResolved,
      destination_lat: destLat, destination_lng: destLng,
      origin_address: originAddress, has_realtime_schedule: false,
      note: `'${destination}' 근처에서 도착 가능한 허브를 찾지 못했습니다.`,
    }
  }

  // 4. 조합 생성
  const pairs: [TransitHub, TransitHub, 'train' | 'expbus'][] = []
  if (wantTrain) {
    for (const o of origHubs.trains) {
      for (const d of destHubs.trains) {
        if (o.id !== d.id) pairs.push([o, d, 'train'])
      }
    }
  }
  if (wantBus) {
    for (const o of origHubs.buses) {
      for (const d of destHubs.buses) {
        if (o.id !== d.id) pairs.push([o, d, 'expbus'])
      }
    }
  }

  if (pairs.length === 0) {
    return {
      plans: [], destination_resolved: destResolved,
      destination_lat: destLat, destination_lng: destLng,
      origin_address: originAddress, has_realtime_schedule: false,
      note: '유효한 허브 조합이 없습니다.',
    }
  }

  // 5. 플랜 생성
  let hasRealtime = false
  const draftPlans: any[] = []

  for (const [originHub, destHub, mode] of pairs) {
    const schedule = await makeSchedule(originHub, destHub, mode, date, earliest_departure)
    if (!schedule.is_estimated) hasRealtime = true

    let parking: any = null
    let transitInfo: any = null
    let accessMin = 0

    if (access_mode === 'transit') {
      // 대중교통: 주차장 매칭 스킵, 출발지→허브 거리 기반 추정
      const distKm = haversineKm(origin_lat, origin_lng, originHub.lat, originHub.lng)
      const minutes = estimateTransitMinutes(distKm)
      transitInfo = {
        duration_min: minutes,
        distance_km: Math.round(distKm * 10) / 10,
        note: '지하철+버스 거리 기반 추정',
      }
      accessMin = minutes
    } else if (parking_preference === 'near_hub') {
      const parkingRaw = await pickParking(originHub.lat, originHub.lng, 700)
      parking = parkingRaw ? parkingSummary(parkingRaw, originHub.lat, originHub.lng) : null
      accessMin = parking ? parking.walk_minutes : 0
    } else {
      const parkingRaw = await pickParking(origin_lat, origin_lng, 1500)
      if (parkingRaw) {
        parking = parkingSummary(parkingRaw, originHub.lat, originHub.lng)
      }
      const hubDistKm = haversineKm(origin_lat, origin_lng, originHub.lat, originHub.lng)
      accessMin = Math.floor(hubDistKm * 4)
    }

    const total = accessMin + schedule.duration_min + 10
    const fareTotal = schedule.fare_won
    const originDistM = Math.floor(haversineKm(origin_lat, origin_lng, originHub.lat, originHub.lng) * 1000)

    draftPlans.push({
      origin_hub: hubToDict(originHub),
      destination_hub: hubToDict(destHub),
      schedule,
      parking,
      parking_preference,
      access_mode,
      transit_info: transitInfo,
      total_duration_min: total,
      total_fare_won: fareTotal,
      score: 0,
      reasons: [],
      _origin_distance_m: originDistM,
    })
  }

  if (draftPlans.length === 0) {
    return {
      plans: [], destination_resolved: destResolved,
      destination_lat: destLat, destination_lng: destLng,
      origin_address: originAddress, has_realtime_schedule: hasRealtime,
      note: '플랜을 생성할 수 없습니다.',
    }
  }

  const fastestDur = Math.min(...draftPlans.map(p => p.total_duration_min))
  const cheapestFare = Math.min(...draftPlans.map(p => p.total_fare_won))

  for (const p of draftPlans) {
    const distM = p._origin_distance_m
    delete p._origin_distance_m
    p.score = scorePlan(p, distM)
    p.reasons = buildReasons(
      p,
      p.total_duration_min === fastestDur,
      p.total_fare_won === cheapestFare,
    )
  }

  draftPlans.sort((a, b) => b.score - a.score || a.total_duration_min - b.total_duration_min)
  const top = draftPlans.slice(0, 5)
  top.forEach((p, i) => { p.rank = i + 1 })

  return {
    plans: top,
    destination_resolved: destResolved,
    destination_lat: destLat,
    destination_lng: destLng,
    origin_address: originAddress,
    has_realtime_schedule: hasRealtime,
    note: hasRealtime ? '실시간 TAGO 시간표' : '거리 기반 예상 시간·요금 (TAGO 데이터 연동 후 자동 전환)',
  }
}
