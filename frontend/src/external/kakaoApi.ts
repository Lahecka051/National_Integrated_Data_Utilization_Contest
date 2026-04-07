/**
 * Kakao REST API 클라이언트 (TS 포팅)
 *   - Local API: 장소/주소 검색
 *   - Navi API: 길찾기
 */
import { httpGet } from '../lib/httpClient'
import { API_KEYS } from '../config/apiKeys'

const LOCAL_BASE = 'https://dapi.kakao.com/v2/local'
const NAVI_BASE = 'https://apis-navi.kakaomobility.com/v1/directions'

function authHeaders(): Record<string, string> {
  return { Authorization: `KakaoAK ${API_KEYS.KAKAO_REST}` }
}

export interface KakaoPlace {
  id: string
  name: string
  address: string
  road_address: string
  lat: number
  lng: number
  phone: string
  distance: number
  category: string
}

export async function searchNearbyPlaces(params: {
  query: string
  lat: number
  lng: number
  radius?: number
  category_group_code?: string
  size?: number
}): Promise<KakaoPlace[]> {
  const { query, lat, lng, radius = 2000, category_group_code, size = 10 } = params
  try {
    const res = await httpGet<any>({
      url: `${LOCAL_BASE}/search/keyword.json`,
      params: {
        query,
        x: String(lng),
        y: String(lat),
        radius: String(radius),
        size: String(size),
        sort: 'distance',
        ...(category_group_code ? { category_group_code } : {}),
      },
      headers: authHeaders(),
    })
    if (res.status !== 200) return []
    const docs = res.data?.documents || []
    return docs.map((d: any) => ({
      id: d.id || '',
      name: d.place_name || '',
      address: d.address_name || '',
      road_address: d.road_address_name || '',
      lat: parseFloat(d.y || '0'),
      lng: parseFloat(d.x || '0'),
      phone: d.phone || '',
      distance: parseInt(d.distance || '0', 10) || 0,
      category: d.category_name || '',
    }))
  } catch {
    return []
  }
}

export async function searchNearbyBanks(lat: number, lng: number, radius = 3000): Promise<KakaoPlace[]> {
  const results = await searchNearbyPlaces({
    query: '은행', lat, lng, radius, category_group_code: 'BK9', size: 15,
  })
  const exclude = ['ATM', '365', '자동화', '무인']
  const filtered = results.filter(b => !exclude.some(kw => b.name.includes(kw)))
  return filtered.length > 0 ? filtered : results.slice(0, 5)
}

export async function searchNearbyPostOffices(lat: number, lng: number, radius = 3000): Promise<KakaoPlace[]> {
  return searchNearbyPlaces({ query: '우체국', lat, lng, radius, size: 10 })
}

/**
 * 통합 주소 검색 — 사용자가 결과를 고를 수 있도록 여러 후보를 반환.
 * 1) 카카오 주소 검색 (address.json) — 도로명/지번 주소 정확 매칭
 * 2) 카카오 키워드 검색 (keyword.json) — 건물명/상호/지명
 * 두 결과를 합쳐서 중복 제거 후 반환.
 */
export interface AddressSearchResult {
  label: string            // 표시용 대표 텍스트 (도로명 주소 우선)
  road_address: string
  address: string          // 지번 주소
  place_name?: string      // 장소명 (키워드 검색 시)
  lat: number
  lng: number
  postal_code?: string
  source: 'address' | 'keyword'
}

export async function searchAddresses(query: string, maxResults: number = 10): Promise<AddressSearchResult[]> {
  const q = query.trim()
  if (!q) return []

  const results: AddressSearchResult[] = []
  const seen = new Set<string>()

  const pushUnique = (r: AddressSearchResult) => {
    if (!r.lat || !r.lng) return
    const key = `${r.lat.toFixed(5)}_${r.lng.toFixed(5)}_${r.label}`
    if (seen.has(key)) return
    seen.add(key)
    results.push(r)
  }

  // 1) 주소 검색 (도로명/지번)
  try {
    const res = await httpGet<any>({
      url: `${LOCAL_BASE}/search/address.json`,
      params: { query: q, size: String(Math.min(maxResults, 30)) },
      headers: authHeaders(),
    })
    if (res.status === 200) {
      const docs = res.data?.documents || []
      for (const d of docs) {
        const road = d.road_address || {}
        const addr = d.address || {}
        const label = road.address_name || d.address_name || addr.address_name || ''
        pushUnique({
          label,
          road_address: road.address_name || '',
          address: addr.address_name || d.address_name || '',
          lat: parseFloat(d.y || '0'),
          lng: parseFloat(d.x || '0'),
          postal_code: road.zone_no || '',
          source: 'address',
        })
      }
    }
  } catch {
    /* ignore */
  }

  // 2) 키워드 검색 (장소명/건물명)
  try {
    const res = await httpGet<any>({
      url: `${LOCAL_BASE}/search/keyword.json`,
      params: { query: q, size: String(Math.min(maxResults, 15)) },
      headers: authHeaders(),
    })
    if (res.status === 200) {
      const docs = res.data?.documents || []
      for (const d of docs) {
        const label = d.place_name || d.road_address_name || d.address_name || ''
        pushUnique({
          label,
          road_address: d.road_address_name || '',
          address: d.address_name || '',
          place_name: d.place_name || '',
          lat: parseFloat(d.y || '0'),
          lng: parseFloat(d.x || '0'),
          source: 'keyword',
        })
      }
    }
  } catch {
    /* ignore */
  }

  return results.slice(0, maxResults)
}


export async function geocodeAddress(address: string): Promise<{
  address: string
  road_address: string
  lat: number
  lng: number
} | null> {
  if (!address.trim()) return null
  try {
    const res = await httpGet<any>({
      url: `${LOCAL_BASE}/search/address.json`,
      params: { query: address },
      headers: authHeaders(),
    })
    if (res.status !== 200) return null
    const docs = res.data?.documents || []
    if (docs.length === 0) {
      // 주소 검색 실패 → 키워드 검색 폴백
      const r2 = await httpGet<any>({
        url: `${LOCAL_BASE}/search/keyword.json`,
        params: { query: address, size: '1' },
        headers: authHeaders(),
      })
      if (r2.status !== 200) return null
      const docs2 = r2.data?.documents || []
      if (docs2.length === 0) return null
      const d = docs2[0]
      return {
        address: d.address_name || address,
        road_address: d.road_address_name || '',
        lat: parseFloat(d.y || '0'),
        lng: parseFloat(d.x || '0'),
      }
    }
    const d = docs[0]
    const road = d.road_address || {}
    return {
      address: d.address_name || address,
      road_address: road.address_name || '',
      lat: parseFloat(d.y || '0'),
      lng: parseFloat(d.x || '0'),
    }
  } catch {
    return null
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string
  road_address: string
  region_1depth: string
  region_2depth: string
  region_3depth: string
} | null> {
  try {
    const res = await httpGet<any>({
      url: `${LOCAL_BASE}/geo/coord2address.json`,
      params: { x: String(lng), y: String(lat) },
      headers: authHeaders(),
    })
    if (res.status !== 200) return null
    const docs = res.data?.documents || []
    if (docs.length === 0) return null
    const d = docs[0]
    const addr = d.address || {}
    const road = d.road_address || {}
    return {
      address: addr.address_name || '',
      road_address: road.address_name || '',
      region_1depth: addr.region_1depth_name || '',
      region_2depth: addr.region_2depth_name || '',
      region_3depth: addr.region_3depth_name || '',
    }
  } catch {
    return null
  }
}

export interface DirectionsResult {
  distance: number
  duration: number
  route_coords: { lat: number; lng: number }[]
}

export async function getDirections(
  originLng: number, originLat: number,
  destLng: number, destLat: number,
  waypoints?: [number, number][],
): Promise<DirectionsResult | null> {
  try {
    const params: Record<string, string> = {
      origin: `${originLng},${originLat}`,
      destination: `${destLng},${destLat}`,
      priority: 'RECOMMEND',
    }
    if (waypoints && waypoints.length > 0) {
      params.waypoints = waypoints.map(([lng, lat]) => `${lng},${lat}`).join('|')
    }
    const res = await httpGet<any>({
      url: NAVI_BASE,
      params,
      headers: authHeaders(),
    })
    if (res.status !== 200) return null
    const routes = res.data?.routes || []
    if (routes.length === 0) return null
    const route = routes[0]
    const summary = route.summary || {}
    const coords: { lat: number; lng: number }[] = []
    for (const section of route.sections || []) {
      for (const road of section.roads || []) {
        const vertexes = road.vertexes || []
        for (let i = 0; i < vertexes.length; i += 2) {
          if (i + 1 < vertexes.length) {
            coords.push({ lng: vertexes[i], lat: vertexes[i + 1] })
          }
        }
      }
    }
    return {
      distance: summary.distance || 0,
      duration: summary.duration || 0,
      route_coords: coords,
    }
  } catch {
    return null
  }
}

export async function getMultiStopRoute(
  start: [number, number],
  stops: [number, number][],
): Promise<DirectionsResult[]> {
  const segments: DirectionsResult[] = []
  let current = start
  for (const stop of stops) {
    const result = await getDirections(current[0], current[1], stop[0], stop[1])
    if (result) {
      segments.push(result)
    } else {
      segments.push({
        distance: 0,
        duration: 0,
        route_coords: [
          { lng: current[0], lat: current[1] },
          { lng: stop[0], lat: stop[1] },
        ],
      })
    }
    current = stop
  }
  return segments
}
