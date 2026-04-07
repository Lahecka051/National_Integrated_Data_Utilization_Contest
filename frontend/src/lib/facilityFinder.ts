/**
 * 용무 시설 탐색 서비스 (TS 포팅)
 */
import { searchNearbyPlaces, searchNearbyBanks, searchNearbyPostOffices } from '../external/kakaoApi'

export interface ResolvedFacility {
  id: string
  name: string
  type: string
  address: string
  lat: number
  lng: number
  open_time: string
  close_time: string
}

const DEFAULT_HOURS: Record<string, [string, string]> = {
  '민원실': ['09:00', '18:00'],
  '은행': ['09:00', '16:00'],
  '우체국': ['09:00', '18:00'],
}

export async function findNearestFacility(
  taskType: string,
  originLat: number,
  originLng: number,
  radius = 5000,
): Promise<ResolvedFacility | null> {
  let results: any[] = []
  if (taskType === '은행') {
    results = await searchNearbyBanks(originLat, originLng, radius)
  } else if (taskType === '우체국') {
    results = await searchNearbyPostOffices(originLat, originLng, radius)
  } else if (taskType === '민원실') {
    const queries = ['주민센터', '행정복지센터', '구청 민원실', '동사무소']
    const seen = new Set<string>()
    const combined: any[] = []
    for (const q of queries) {
      const kakao = await searchNearbyPlaces({ query: q, lat: originLat, lng: originLng, radius, size: 10 })
      for (const k of kakao) {
        if (!k.id || seen.has(k.id)) continue
        const category = k.category || ''
        const name = k.name || ''
        if (!['주민센터', '행정복지', '구청', '동사무소', '시청', '군청', '면사무소', '읍사무소', '민원'].some(kw =>
          (name + category).includes(kw)
        )) {
          continue
        }
        seen.add(k.id)
        combined.push(k)
      }
    }
    results = combined
  } else {
    return null
  }

  if (results.length === 0) return null

  results.sort((a, b) => (a.distance || 0) - (b.distance || 0))
  const best = results[0]
  const [openTime, closeTime] = DEFAULT_HOURS[taskType] || ['09:00', '18:00']

  return {
    id: String(best.id || `${taskType}_${best.lat}_${best.lng}`),
    name: best.name || taskType,
    type: taskType,
    address: best.address || best.road_address || '',
    lat: parseFloat(String(best.lat)),
    lng: parseFloat(String(best.lng)),
    open_time: openTime,
    close_time: closeTime,
  }
}

export async function resolveFacilitiesForTypes(
  taskTypes: Set<string>,
  originLat: number,
  originLng: number,
): Promise<Record<string, ResolvedFacility | null>> {
  const result: Record<string, ResolvedFacility | null> = {}
  for (const t of taskTypes) {
    result[t] = await findNearestFacility(t, originLat, originLng)
  }
  return result
}
