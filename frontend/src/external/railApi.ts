/**
 * 철도역 API (TS 포팅) — Kakao Local 기반 + TAGO 열차 시간표
 */
import { httpGet } from '../lib/httpClient'
import { API_KEYS } from '../config/apiKeys'
import { searchNearbyPlaces } from './kakaoApi'

const TAGO_TRAIN_BASE = 'http://apis.data.go.kr/1613000/TrainInfoService'

export interface TransitHub {
  id: string
  name: string
  type: 'train_station' | 'bus_terminal'
  address: string
  lat: number
  lng: number
  distance: number
  category: string
  phone: string
}

const EXCLUDE_NAMES = ['폐역', '화물역', '잔교역', '잔교 역', '고객라운지', '출장소', '관리소', '관리운영']

function isValidTrainStation(name: string, category: string): boolean {
  const isTrain =
    category.includes('기차,철도') ||
    category.includes('기차역') ||
    category.includes('철도역') ||
    (category.startsWith('교통,수송') && (category.includes('KTX') || category.includes('SRT')))
  if (!isTrain) return false
  if (category.includes('지하철') && !category.includes('기차')) return false
  if (EXCLUDE_NAMES.some(kw => name.includes(kw))) return false
  if (['관리운영', '관리,운영', '폐역'].some(kw => category.includes(kw))) return false
  return true
}

export async function fetchNearbyTrainStations(lat: number, lng: number, radius = 5000): Promise<{
  hubs: TransitHub[]
  source: string
}> {
  const queries = ['기차역', 'KTX', 'SRT']
  const seen = new Set<string>()
  const results: TransitHub[] = []

  for (const q of queries) {
    const kakao = await searchNearbyPlaces({ query: q, lat, lng, radius, size: 15 })
    for (const k of kakao) {
      if (!k.id || seen.has(k.id)) continue
      if (!isValidTrainStation(k.name, k.category)) continue
      seen.add(k.id)
      results.push({
        id: String(k.id),
        name: k.name,
        type: 'train_station',
        address: k.address || k.road_address || '',
        lat: k.lat,
        lng: k.lng,
        distance: k.distance,
        category: k.category,
        phone: k.phone,
      })
    }
  }
  results.sort((a, b) => a.distance - b.distance)
  return { hubs: results.slice(0, 20), source: 'kakao' }
}

export async function fetchTrainSchedules(
  depPlaceId: string,
  arrPlaceId: string,
  depPlandtime: string,
  trainGradeCode = '',
): Promise<any[]> {
  const key = API_KEYS.DATA_GO_KR
  if (!key || !depPlaceId || !arrPlaceId) return []
  try {
    const params: Record<string, string> = {
      serviceKey: key,
      pageNo: '1',
      numOfRows: '30',
      _type: 'json',
      depPlaceId,
      arrPlaceId,
      depPlandTime: depPlandtime,
    }
    if (trainGradeCode) params.trainGradeCode = trainGradeCode
    const res = await httpGet<any>({
      url: `${TAGO_TRAIN_BASE}/getStrtpntAlocFndTrainInfo`,
      params,
    })
    if (res.status !== 200) return []
    let items = res.data?.response?.body?.items ?? []
    if (typeof items === 'object' && !Array.isArray(items)) items = items.item ?? []
    if (!Array.isArray(items)) items = items ? [items] : []
    return items
  } catch {
    return []
  }
}
