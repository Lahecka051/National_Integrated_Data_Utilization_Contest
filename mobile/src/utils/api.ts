import type {
  Errand, RecommendationResponse, SlotRecommendation, TaskList,
  HalfDayType, NLParseResponse, ChatMessage, TimeConstraint, ConsultantChatResponse,
} from '../types'

// 개발: PC의 LAN IP, 프로덕션: 실제 서버 주소
const API_BASE = __DEV__
  ? 'http://192.168.0.1:8000/api'   // 개발 시 본인 PC IP로 변경
  : 'https://your-server.com/api'

export function setApiBase(url: string) {
  // 런타임에 API 주소 변경이 필요할 때 사용
  (global as any).__API_BASE = url
}

function getBase() {
  return (global as any).__API_BASE || API_BASE
}

export async function fetchRecommendation(errands: Errand[]): Promise<RecommendationResponse> {
  const res = await fetch(`${getBase()}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errands }),
  })
  if (!res.ok) throw new Error('추천 요청 실패')
  return res.json()
}

export async function fetchTasks(): Promise<TaskList> {
  const res = await fetch(`${getBase()}/tasks`)
  if (!res.ok) throw new Error('용무 목록 조회 실패')
  return res.json()
}

export async function fetchOptimizeSlot(
  errands: Errand[],
  date: string,
  half_day_type: HalfDayType,
): Promise<RecommendationResponse> {
  const res = await fetch(`${getBase()}/optimize-slot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errands, date, half_day_type }),
  })
  if (!res.ok) throw new Error('경로 최적화 요청 실패')
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
  const res = await fetch(`${getBase()}/nearby-banks?${params}`)
  if (!res.ok) throw new Error('은행 검색 실패')
  return res.json()
}

export interface RouteSegment {
  distance: number
  duration: number
  route_coords: { lat: number; lng: number }[]
}

export async function fetchRoute(
  visits: { lat: number; lng: number }[],
): Promise<{ segments: RouteSegment[] }> {
  const res = await fetch(`${getBase()}/route`, {
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
  const res = await fetch(`${getBase()}/holidays/${year}`)
  if (!res.ok) throw new Error('공휴일 조회 실패')
  return res.json()
}

export async function parseErrandsFromText(text: string): Promise<NLParseResponse> {
  const res = await fetch(`${getBase()}/parse-errands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('AI 분석 실패')
  return res.json()
}

export async function sendChatMessage(
  messages: ChatMessage[],
  recommendation: SlotRecommendation,
  errands: Errand[] = [],
): Promise<{ reply: string; error: boolean }> {
  const res = await fetch(`${getBase()}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, recommendation, errands }),
  })
  if (!res.ok) throw new Error('채팅 요청 실패')
  return res.json()
}

export async function sendConsultantMessage(
  messages: ChatMessage[],
  currentErrands: Errand[],
  currentTimeConstraint?: TimeConstraint,
): Promise<ConsultantChatResponse> {
  const res = await fetch(`${getBase()}/consultant-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      current_errands: currentErrands,
      current_time_constraint: currentTimeConstraint || null,
    }),
  })
  if (!res.ok) throw new Error('상담 채팅 요청 실패')
  return res.json()
}

export async function fetchLLMStatus(): Promise<{ available: boolean }> {
  const res = await fetch(`${getBase()}/llm-status`)
  if (!res.ok) return { available: false }
  return res.json()
}
