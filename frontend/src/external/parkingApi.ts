/**
 * 공공주차장 API (TS 포팅)
 *   1) Kakao Local PK6 카테고리 (항상 사용)
 *   2) 국토교통부 전국주차장 표준데이터 (메타 enrichment)
 *   3) 서울 열린데이터광장 실시간 잔여면수
 */
import { httpGet } from '../lib/httpClient'
import { API_KEYS } from '../config/apiKeys'
import { searchNearbyPlaces } from './kakaoApi'

const PARKING_META_URL = 'https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api'
const SEOUL_PARKING_URL = 'http://openapi.seoul.go.kr:8088'

export type ParkingStatus = '여유' | '보통' | '혼잡' | '만차' | '정보없음'

export interface PublicParking {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distance: number
  parking_type: string
  total_slots: number | null
  available_slots: number | null
  status: ParkingStatus
  fee_info: string
  operating_hours: string
  phone: string
  source: string
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

function classifyStatus(available: number | null, total: number | null): ParkingStatus {
  if (available == null || total == null || total <= 0) return '정보없음'
  if (available <= 0) return '만차'
  const ratio = available / total
  if (ratio < 0.1) return '혼잡'
  if (ratio < 0.3) return '보통'
  return '여유'
}

interface SeoulRealtimeRow {
  total: number
  available: number
  lat: number
  lng: number
  addr: string
  type: string
  fee: string
}

async function fetchSeoulRealtime(): Promise<Record<string, SeoulRealtimeRow>> {
  const key = API_KEYS.SEOUL_OPENDATA
  if (!key) return {}
  try {
    const res = await httpGet<any>({
      url: `${SEOUL_PARKING_URL}/${key}/json/GetParkInfo/1/1000/`,
    })
    if (res.status !== 200) return {}
    const rows = res.data?.GetParkInfo?.row || []
    const result: Record<string, SeoulRealtimeRow> = {}
    for (const row of rows) {
      const name = (row.PKLT_NM || '').trim()
      if (!name) continue
      const total = parseInt(String(row.TPKCT || 0), 10) || 0
      const used = parseInt(String(row.NOW_PRK_VHCL_CNT || 0), 10) || 0
      const available = Math.max(0, total - used)
      result[name] = {
        total,
        available,
        lat: parseFloat(String(row.LAT || 0)) || 0,
        lng: parseFloat(String(row.LOT || 0)) || 0,
        addr: row.ADDR || '',
        type: row.PKLT_TYPE || row.PRK_TYPE_NM || '',
        fee: row.RATES || row.PAY_YN_NM || '',
      }
    }
    return result
  } catch {
    return {}
  }
}

async function fetchParkingMeta(lat: number, lng: number, radius: number): Promise<PublicParking[]> {
  const key = API_KEYS.DATA_GO_KR
  if (!key) return []
  try {
    const res = await httpGet<any>({
      url: PARKING_META_URL,
      params: {
        serviceKey: key,
        pageNo: '1',
        numOfRows: '500',
        type: 'json',
      },
    })
    if (res.status !== 200) return []
    let items = res.data?.response?.body?.items ?? []
    if (!Array.isArray(items)) items = items?.item ?? []
    if (!Array.isArray(items)) return []

    const results: PublicParking[] = []
    for (const it of items) {
      const plat = parseFloat(String(it.latitude || 0))
      const plng = parseFloat(String(it.longitude || 0))
      if (!plat || !plng) continue
      const dist = haversineMeters(lat, lng, plat, plng)
      if (dist > radius) continue
      const total = parseInt(String(it.prkcmprt || 0), 10) || null
      results.push({
        id: String(it.prkplceNo || `meta_${plat}_${plng}`),
        name: it.prkplceNm || '공공주차장',
        address: it.rdnmadr || it.lnmadr || '',
        lat: plat,
        lng: plng,
        distance: dist,
        parking_type: it.prkplceSe || it.prkplceType || '',
        total_slots: total,
        available_slots: null,
        status: '정보없음',
        fee_info: it.feedingSe || it.parkingchrgeInfo || '',
        operating_hours: `${it.weekdayOperOpenHhmm || ''}~${it.weekdayOperColseHhmm || ''}`.replace(/^~|~$/g, ''),
        phone: it.phoneNumber || '',
        source: 'data_go_kr',
      })
    }
    results.sort((a, b) => a.distance - b.distance)
    return results.slice(0, 30)
  } catch {
    return []
  }
}

function matchSeoulRealtime(name: string, seoulData: Record<string, SeoulRealtimeRow>): SeoulRealtimeRow | null {
  if (!name) return null
  if (seoulData[name]) return seoulData[name]
  const norm = name.replace(/공영주차장|공공주차장|주차장/g, '').trim()
  if (!norm) return null
  for (const [key, value] of Object.entries(seoulData)) {
    if (key.includes(norm) || norm.includes(key)) return value
  }
  return null
}

export async function fetchNearbyParking(lat: number, lng: number, radius = 2000): Promise<{
  parkings: PublicParking[]
  source: string
  has_realtime: boolean
}> {
  const kakaoResults = await searchNearbyPlaces({
    query: '공영주차장', lat, lng, radius, category_group_code: 'PK6', size: 15,
  })
  const metaResults = await fetchParkingMeta(lat, lng, radius)
  const seoulData = await fetchSeoulRealtime()
  const hasRealtime = Object.keys(seoulData).length > 0

  const metaKey = (la: number, ln: number) => `${la.toFixed(4)}_${ln.toFixed(4)}`
  const metaMap = new Map(metaResults.map(m => [metaKey(m.lat, m.lng), m]))

  const parkings: PublicParking[] = []
  const seenKeys = new Set<string>()

  for (const k of kakaoResults) {
    const keyStr = metaKey(k.lat, k.lng)
    const meta = metaMap.get(keyStr)
    const seoulInfo = matchSeoulRealtime(k.name, seoulData)

    const total = meta?.total_slots ?? seoulInfo?.total ?? null
    const available = seoulInfo?.available ?? null
    const status = classifyStatus(available, total)

    parkings.push({
      id: String(k.id || keyStr),
      name: k.name,
      address: k.address || k.road_address || meta?.address || '',
      lat: k.lat,
      lng: k.lng,
      distance: k.distance,
      parking_type: meta?.parking_type || seoulInfo?.type || '공영',
      total_slots: total,
      available_slots: available,
      status,
      fee_info: meta?.fee_info || seoulInfo?.fee || '',
      operating_hours: meta?.operating_hours || '',
      phone: k.phone || meta?.phone || '',
      source: seoulInfo ? 'seoul_opendata' : (meta ? 'data_go_kr' : 'kakao'),
    })
    seenKeys.add(keyStr)
  }

  for (const m of metaResults) {
    const keyStr = metaKey(m.lat, m.lng)
    if (seenKeys.has(keyStr)) continue
    const seoulInfo = matchSeoulRealtime(m.name, seoulData)
    const available = seoulInfo?.available ?? null
    parkings.push({
      ...m,
      available_slots: available,
      status: classifyStatus(available, m.total_slots),
      source: seoulInfo ? 'seoul_opendata' : 'data_go_kr',
    })
  }

  parkings.sort((a, b) => a.distance - b.distance)
  const sources = Array.from(new Set(parkings.map(p => p.source)))
  return {
    parkings: parkings.slice(0, 30),
    source: sources.sort().join('+') || 'none',
    has_realtime: hasRealtime,
  }
}

export async function fetchParkingDetail(parkingId: string, lat: number, lng: number): Promise<PublicParking | null> {
  const result = await fetchNearbyParking(lat, lng, 5000)
  return result.parkings.find(p => p.id === parkingId) || null
}
