import type { Errand, RecommendationResponse, SlotRecommendation, TaskList, HalfDayType } from '../types'

const API_BASE = '/api'

export async function fetchRecommendation(errands: Errand[]): Promise<RecommendationResponse> {
  const res = await fetch(`${API_BASE}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errands }),
  })
  if (!res.ok) throw new Error('추천 요청 실패')
  return res.json()
}

export async function fetchTasks(): Promise<TaskList> {
  const res = await fetch(`${API_BASE}/tasks`)
  if (!res.ok) throw new Error('용무 목록 조회 실패')
  return res.json()
}

export async function fetchFacilities(type?: string) {
  const url = type ? `${API_BASE}/facilities?facility_type=${type}` : `${API_BASE}/facilities`
  const res = await fetch(url)
  if (!res.ok) throw new Error('시설 목록 조회 실패')
  return res.json()
}

export async function fetchOptimizeSlot(
  errands: Errand[],
  date: string,
  half_day_type: HalfDayType
): Promise<RecommendationResponse> {
  const res = await fetch(`${API_BASE}/optimize-slot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errands, date, half_day_type }),
  })
  if (!res.ok) throw new Error('경로 최적화 요청 실패')
  return res.json()
}

export async function fetchCongestionHeatmap(facilityId: string) {
  const res = await fetch(`${API_BASE}/congestion-heatmap/${facilityId}`)
  if (!res.ok) throw new Error('혼잡도 조회 실패')
  return res.json()
}

export interface NearbyPlace {
  id: string
  name: string
  address: string
  road_address?: string
  lat: number
  lng: number
  phone?: string
  distance: number
  category?: string
}

export async function fetchNearbyBanks(lat?: number, lng?: number): Promise<{ banks: NearbyPlace[] }> {
  const params = new URLSearchParams()
  if (lat) params.set('lat', String(lat))
  if (lng) params.set('lng', String(lng))
  const res = await fetch(`${API_BASE}/nearby-banks?${params}`)
  if (!res.ok) throw new Error('은행 검색 실패')
  return res.json()
}

export async function fetchNearbyPostOffices(lat?: number, lng?: number): Promise<{ post_offices: NearbyPlace[] }> {
  const params = new URLSearchParams()
  if (lat) params.set('lat', String(lat))
  if (lng) params.set('lng', String(lng))
  const res = await fetch(`${API_BASE}/nearby-post-offices?${params}`)
  if (!res.ok) throw new Error('우체국 검색 실패')
  return res.json()
}

export interface RouteSegment {
  distance: number
  duration: number
  route_coords: { lat: number; lng: number }[]
}

export async function fetchRoute(visits: { lat: number; lng: number }[]): Promise<{ segments: RouteSegment[] }> {
  const res = await fetch(`${API_BASE}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visits }),
  })
  if (!res.ok) throw new Error('경로 조회 실패')
  return res.json()
}

export interface HolidayInfo {
  date: string
  name: string
  is_holiday: boolean
}

export async function fetchHolidays(year: string): Promise<{ holidays: HolidayInfo[] }> {
  const res = await fetch(`${API_BASE}/holidays/${year}`)
  if (!res.ok) throw new Error('공휴일 조회 실패')
  return res.json()
}
