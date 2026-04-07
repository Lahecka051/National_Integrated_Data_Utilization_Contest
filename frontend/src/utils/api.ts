import type {
  Errand, RecommendationResponse, SlotRecommendation, TaskList, HalfDayType,
  NLParseResponse, ChatMessage, TimeConstraint, ConsultantChatResponse,
  ParkingListResponse, PublicParking, TransitHubListResponse, HubCongestion,
  GeocodeResult, ReverseGeocodeResult, HubType,
  TripRequest, TripRecommendResponse, TripConsultantState, TripConsultantChatResponse,
  OneClickConfirmResponse,
} from '../types'

const API_BASE = '/api'

export async function fetchRecommendation(
  errands: Errand[],
  startLat: number,
  startLng: number,
): Promise<RecommendationResponse> {
  const res = await fetch(`${API_BASE}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errands, start_lat: startLat, start_lng: startLng }),
  })
  if (!res.ok) throw new Error('추천 요청 실패')
  return res.json()
}

export async function fetchTasks(): Promise<TaskList> {
  const res = await fetch(`${API_BASE}/tasks`)
  if (!res.ok) throw new Error('용무 목록 조회 실패')
  return res.json()
}

export async function fetchOptimizeSlot(
  errands: Errand[],
  date: string,
  half_day_type: HalfDayType,
  startLat: number,
  startLng: number,
): Promise<RecommendationResponse> {
  const res = await fetch(`${API_BASE}/optimize-slot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      errands, date, half_day_type,
      start_lat: startLat, start_lng: startLng,
    }),
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

export async function fetchNearbyBanks(lat: number, lng: number): Promise<{ banks: NearbyPlace[] }> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  const res = await fetch(`${API_BASE}/nearby-banks?${params}`)
  if (!res.ok) throw new Error('은행 검색 실패')
  return res.json()
}

export async function fetchNearbyPostOffices(lat: number, lng: number): Promise<{ post_offices: NearbyPlace[] }> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  const res = await fetch(`${API_BASE}/nearby-post-offices?${params}`)
  if (!res.ok) throw new Error('우체국 검색 실패')
  return res.json()
}

export interface RouteSegment {
  distance: number
  duration: number
  route_coords: { lat: number; lng: number }[]
}

export async function fetchRoute(
  visits: { lat: number; lng: number }[],
  startLat: number,
  startLng: number,
): Promise<{ segments: RouteSegment[] }> {
  const res = await fetch(`${API_BASE}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visits, start_lat: startLat, start_lng: startLng }),
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

// === LLM API ===

export async function parseErrandsFromText(text: string): Promise<NLParseResponse> {
  const res = await fetch(`${API_BASE}/parse-errands`, {
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
  const res = await fetch(`${API_BASE}/chat`, {
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
  currentTripState?: TripConsultantState | null,
  originLat?: number,
  originLng?: number,
): Promise<ConsultantChatResponse> {
  const res = await fetch(`${API_BASE}/consultant-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      current_errands: currentErrands,
      current_time_constraint: currentTimeConstraint || null,
      current_trip_state: currentTripState || null,
      origin_lat: originLat,
      origin_lng: originLng,
    }),
  })
  if (!res.ok) throw new Error('상담 채팅 요청 실패')
  return res.json()
}

export async function fetchLLMStatus(): Promise<{ available: boolean }> {
  const res = await fetch(`${API_BASE}/llm-status`)
  if (!res.ok) return { available: false }
  return res.json()
}

// === 출장 모드 API ===

export async function fetchNearbyParking(
  lat: number, lng: number, radius: number = 2000,
): Promise<ParkingListResponse> {
  const params = new URLSearchParams({
    lat: String(lat), lng: String(lng), radius: String(radius),
  })
  const res = await fetch(`${API_BASE}/parking/nearby?${params}`)
  if (!res.ok) throw new Error('주차장 조회 실패')
  return res.json()
}

export async function fetchParkingDetail(
  parkingId: string, lat: number, lng: number,
): Promise<PublicParking> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  const res = await fetch(`${API_BASE}/parking/${encodeURIComponent(parkingId)}?${params}`)
  if (!res.ok) throw new Error('주차장 상세 조회 실패')
  return res.json()
}

export async function fetchNearbyTrainStations(
  lat: number, lng: number, radius: number = 5000,
): Promise<TransitHubListResponse> {
  const params = new URLSearchParams({
    lat: String(lat), lng: String(lng), radius: String(radius),
  })
  const res = await fetch(`${API_BASE}/transit/train-stations?${params}`)
  if (!res.ok) throw new Error('기차역 조회 실패')
  return res.json()
}

export async function fetchNearbyBusTerminals(
  lat: number, lng: number, radius: number = 5000,
): Promise<TransitHubListResponse> {
  const params = new URLSearchParams({
    lat: String(lat), lng: String(lng), radius: String(radius),
  })
  const res = await fetch(`${API_BASE}/transit/bus-terminals?${params}`)
  if (!res.ok) throw new Error('터미널 조회 실패')
  return res.json()
}

export async function fetchHubCongestion(
  hubType: HubType,
  hub: { id: string; name: string; lat: number; lng: number },
  terminalId?: string,
): Promise<HubCongestion> {
  const params = new URLSearchParams({
    hub_id: hub.id,
    hub_name: hub.name,
    lat: String(hub.lat),
    lng: String(hub.lng),
  })
  if (terminalId) params.set('terminal_id', terminalId)
  const res = await fetch(`${API_BASE}/transit/${hubType}/congestion?${params}`)
  if (!res.ok) throw new Error('혼잡도 조회 실패')
  return res.json()
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const res = await fetch(`${API_BASE}/geocode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  })
  if (!res.ok) throw new Error('주소 검색 실패')
  return res.json()
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const res = await fetch(`${API_BASE}/reverse-geocode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  })
  if (!res.ok) throw new Error('주소 변환 실패')
  return res.json()
}

export async function fetchTripRecommend(req: TripRequest): Promise<TripRecommendResponse> {
  const res = await fetch(`${API_BASE}/trip/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error('여행 추천 실패')
  return res.json()
}

// === 원클릭 서비스 (DEMO) ===
export async function confirmOneClickPlan(
  plan: SlotRecommendation,
  errands: Errand[],
): Promise<OneClickConfirmResponse> {
  const res = await fetch(`${API_BASE}/oneclick/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, errands }),
  })
  if (!res.ok) throw new Error('원클릭 확정 요청 실패')
  return res.json()
}

export async function sendTripConsultantMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  currentState: TripConsultantState,
  originLat: number,
  originLng: number,
): Promise<TripConsultantChatResponse> {
  const res = await fetch(`${API_BASE}/trip/consultant-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      current_state: currentState,
      origin_lat: originLat,
      origin_lng: originLng,
    }),
  })
  if (!res.ok) throw new Error('출장 상담 채팅 요청 실패')
  return res.json()
}
