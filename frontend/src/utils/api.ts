/**
 * API 클라이언트 — 완전 로컬 모드
 *
 * FastAPI 백엔드 없이 프런트엔드에서 직접 외부 API를 호출합니다.
 * 모든 비즈니스 로직은 src/lib/*.ts 에 TS로 포팅되어 있습니다.
 */
import type {
  Errand, RecommendationResponse, SlotRecommendation, TaskList, HalfDayType,
  NLParseResponse, ChatMessage, TimeConstraint, ConsultantChatResponse,
  ParkingListResponse, PublicParking, TransitHubListResponse, HubCongestion,
  GeocodeResult, ReverseGeocodeResult, HubType,
  TripRequest, TripRecommendResponse, TripConsultantState, TripConsultantChatResponse,
  OneClickConfirmResponse,
} from '../types'

// === 외부 API 클라이언트 ===
import {
  geocodeAddress as kakaoGeocode,
  reverseGeocode as kakaoReverse,
  getMultiStopRoute,
  searchAddresses as kakaoSearchAddresses,
  type AddressSearchResult,
} from '../external/kakaoApi'

export type { AddressSearchResult }

export async function searchAddresses(query: string, maxResults?: number): Promise<AddressSearchResult[]> {
  return kakaoSearchAddresses(query, maxResults)
}
import { fetchNearbyParking, fetchParkingDetail } from '../external/parkingApi'
import { fetchNearbyTrainStations } from '../external/railApi'
import { fetchNearbyBusTerminals } from '../external/busTerminalApi'
import { fetchHolidayInfo } from '../external/publicDataApi'

// === 비즈니스 로직 (로컬 서비스) ===
import { recommendBestSlots } from '../lib/optimizer'
import { recommendTrip } from '../lib/tripRecommender'
import { calculateHubCongestion } from '../lib/transitCongestion'
import { confirmOneClickPlan } from '../lib/oneclickService'
import { unifiedConsultantChat } from '../lib/llmService'
import { isLlmAvailable } from '../external/geminiApi'
import { TASK_DURATIONS } from '../lib/waitTimeModel'

// === 유틸 ===
import {
  searchNearbyBanks as kakaoNearbyBanks,
  searchNearbyPostOffices as kakaoNearbyPosts,
  type KakaoPlace,
} from '../external/kakaoApi'

// ============================================================================
// 반차 추천 / 슬롯 최적화
// ============================================================================

export async function fetchRecommendation(
  errands: Errand[],
  startLat: number,
  startLng: number,
): Promise<RecommendationResponse> {
  const result = await recommendBestSlots(errands, startLat, startLng)
  return {
    recommendations: result.recommendations,
    not_recommended: result.not_recommended,
    note: result.note,
  }
}

export async function fetchOptimizeSlot(
  errands: Errand[],
  date: string,
  halfDayType: HalfDayType,
  startLat: number,
  startLng: number,
): Promise<RecommendationResponse> {
  // 정확한 날짜 + 반차 유형 = recommendBestSlots에 date 주입 + 필터링
  const result = await recommendBestSlots(errands, startLat, startLng, 4, {
    date,
  })
  if (halfDayType === '연차') {
    return {
      recommendations: result.recommendations,
      not_recommended: result.not_recommended,
      note: result.note,
    }
  }
  // 특정 반차 유형만 원할 경우 필터링
  const filtered = result.recommendations.filter(r => r.half_day_type === halfDayType)
  return {
    recommendations: filtered.length > 0 ? filtered : result.recommendations,
    not_recommended: null,
    note: result.note,
  }
}

// ============================================================================
// 용무 목록 / 시설
// ============================================================================

export async function fetchTasks(): Promise<TaskList> {
  const tasks = {
    '민원실': ['전입신고', '주민등록등본 발급', '인감증명서 발급', '여권 신청'],
    '은행': ['통장 개설', '카드 발급', '대출 상담', '환전'],
    '우체국': ['등기우편 발송', '택배 발송'],
  }
  return { tasks, durations: TASK_DURATIONS }
}

// ============================================================================
// 근처 장소 검색 (Kakao)
// ============================================================================

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

function toNearbyPlace(k: KakaoPlace): NearbyPlace {
  return {
    id: k.id,
    name: k.name,
    address: k.address,
    road_address: k.road_address,
    lat: k.lat,
    lng: k.lng,
    phone: k.phone,
    distance: k.distance,
    category: k.category,
  }
}

export async function fetchNearbyBanks(lat: number, lng: number): Promise<{ banks: NearbyPlace[] }> {
  const results = await kakaoNearbyBanks(lat, lng)
  return { banks: results.map(toNearbyPlace) }
}

export async function fetchNearbyPostOffices(lat: number, lng: number): Promise<{ post_offices: NearbyPlace[] }> {
  const results = await kakaoNearbyPosts(lat, lng)
  return { post_offices: results.map(toNearbyPlace) }
}

// ============================================================================
// 경로 (Kakao Navi)
// ============================================================================

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
  if (visits.length === 0) return { segments: [] }
  const stops: [number, number][] = visits.map(v => [v.lng, v.lat])
  const segments = await getMultiStopRoute([startLng, startLat], stops)
  return { segments }
}

// ============================================================================
// 공휴일
// ============================================================================

export interface HolidayInfo {
  date: string
  name: string
  is_holiday: boolean
}

export async function fetchHolidays(year: string): Promise<{ holidays: HolidayInfo[] }> {
  const all: HolidayInfo[] = []
  for (let month = 1; month <= 12; month++) {
    const items = await fetchHolidayInfo(year, String(month).padStart(2, '0'))
    all.push(...items)
  }
  return { holidays: all }
}

// ============================================================================
// LLM
// ============================================================================

export async function fetchLLMStatus(): Promise<{ available: boolean }> {
  return { available: isLlmAvailable() }
}

// parseErrandsFromText / sendChatMessage — deprecated, now integrated into unifiedConsultantChat
export async function parseErrandsFromText(_text: string): Promise<NLParseResponse> {
  return { errands: [], original_text: _text, parsed_successfully: false }
}

export async function sendChatMessage(
  _messages: ChatMessage[],
  _recommendation: SlotRecommendation,
  _errands: Errand[] = [],
): Promise<{ reply: string; error: boolean }> {
  return { reply: '이 기능은 통합 상담사로 이전되었습니다.', error: false }
}

// ============================================================================
// 통합 상담사 (반차 + 출장)
// ============================================================================

export async function sendConsultantMessage(
  messages: ChatMessage[],
  currentErrands: Errand[],
  currentTimeConstraint?: TimeConstraint,
  currentTripState?: TripConsultantState | null,
  originLat?: number,
  originLng?: number,
): Promise<ConsultantChatResponse> {
  const msgs = messages.map(m => ({ role: m.role, content: m.content }))
  const tcDict = currentTimeConstraint ? { ...currentTimeConstraint } : null
  const tripStateDict = currentTripState ? { ...currentTripState } : null

  const result = await unifiedConsultantChat(msgs, currentErrands, tcDict, tripStateDict)

  if (!result) {
    return {
      reply: '죄송합니다, 응답을 생성할 수 없습니다. 다시 시도해주세요.',
      action: { action_type: 'none' },
      updated_errands: currentErrands,
      updated_time_constraint: currentTimeConstraint,
      updated_trip_state: currentTripState || undefined,
      error: true,
    }
  }

  const intent = result.intent || 'none'
  let actionType = result.action_type || 'none'
  const shouldRecommend = result.should_recommend || false

  // 반차 상태 업데이트
  const updatedErrands = [...currentErrands]
  if (result.parsed_errands) {
    const existing = new Set(updatedErrands.map(e => e.task_name))
    for (const pe of result.parsed_errands) {
      if (!existing.has(pe.task_name)) {
        updatedErrands.push({
          task_type: pe.task_type,
          task_name: pe.task_name,
          estimated_duration: pe.estimated_duration,
        })
      }
    }
  }

  let updatedTc = currentTimeConstraint
  if (result.time_constraint) {
    updatedTc = result.time_constraint as TimeConstraint
  }

  // 출장 상태 업데이트
  const updatedTripState: any = { ...(currentTripState || {}) }
  if (result.trip_fields) {
    for (const key of ['destination', 'date', 'earliest_departure', 'parking_preference', 'modes']) {
      const val = (result.trip_fields as any)[key]
      if (val != null) updatedTripState[key] = val
    }
  }

  // 추천 실행
  let recommendationResult: RecommendationResponse | undefined
  let tripRecommendationResult: TripRecommendResponse | undefined

  if (shouldRecommend) {
    if (intent === 'half_day' && updatedErrands.length > 0 && originLat != null && originLng != null) {
      const rec = await recommendBestSlots(updatedErrands, originLat, originLng, 4, updatedTc as any)
      recommendationResult = {
        recommendations: rec.recommendations,
        not_recommended: rec.not_recommended,
        note: rec.note,
      }
      actionType = 'recommend_triggered'
    } else if (
      intent === 'business_trip' &&
      updatedTripState.destination && updatedTripState.date &&
      originLat != null && originLng != null
    ) {
      const trip = await recommendTrip({
        origin_lat: originLat,
        origin_lng: originLng,
        destination: updatedTripState.destination,
        date: updatedTripState.date,
        earliest_departure: updatedTripState.earliest_departure || '08:00',
        parking_preference: updatedTripState.parking_preference || 'near_hub',
        modes: updatedTripState.modes || ['train', 'expbus'],
      })
      tripRecommendationResult = trip as TripRecommendResponse
      actionType = 'trip_request_recommend'
    }
  }

  return {
    reply: result.text || '',
    action: {
      action_type: actionType as any,
      intent: intent as any,
      parsed_errands: result.parsed_errands || undefined,
      time_constraint: result.time_constraint ? (updatedTc as TimeConstraint) : undefined,
      recommendation: recommendationResult,
      trip_fields: result.trip_fields || undefined,
      trip_recommendation: tripRecommendationResult,
    },
    updated_errands: updatedErrands,
    updated_time_constraint: updatedTc,
    updated_trip_state: updatedTripState,
    error: false,
  }
}

// ============================================================================
// 출장 모드 API
// ============================================================================

export async function fetchNearbyParking2(
  lat: number, lng: number, radius: number = 2000,
): Promise<ParkingListResponse> {
  const r = await fetchNearbyParking(lat, lng, radius)
  return r as ParkingListResponse
}

export { fetchNearbyParking2 as fetchNearbyParking_ }
// 기존 이름 유지
export async function fetchNearbyParking_alias(lat: number, lng: number, radius: number = 2000): Promise<ParkingListResponse> {
  return fetchNearbyParking2(lat, lng, radius)
}

// Re-export under the same name frontend components use
export { fetchNearbyParking2 as fetchNearbyParking }

export async function fetchParkingDetail_(parkingId: string, lat: number, lng: number): Promise<PublicParking> {
  const p = await fetchParkingDetail(parkingId, lat, lng)
  if (!p) throw new Error('주차장을 찾을 수 없습니다')
  return p as PublicParking
}
export { fetchParkingDetail_ as fetchParkingDetail }

export async function fetchNearbyTrainStations_(
  lat: number, lng: number, radius: number = 5000,
): Promise<TransitHubListResponse> {
  return await fetchNearbyTrainStations(lat, lng, radius) as TransitHubListResponse
}
export { fetchNearbyTrainStations_ as fetchNearbyTrainStations }

export async function fetchNearbyBusTerminals_(
  lat: number, lng: number, radius: number = 5000,
): Promise<TransitHubListResponse> {
  return await fetchNearbyBusTerminals(lat, lng, radius) as TransitHubListResponse
}
export { fetchNearbyBusTerminals_ as fetchNearbyBusTerminals }

export async function fetchHubCongestion(
  hubType: HubType,
  hub: { id: string; name: string; lat: number; lng: number },
  terminalId?: string,
): Promise<HubCongestion> {
  const result = await calculateHubCongestion({
    hub_id: hub.id,
    hub_name: hub.name,
    hub_type: hubType,
    lat: hub.lat,
    lng: hub.lng,
    terminal_id: terminalId,
  })
  return result as HubCongestion
}

// ============================================================================
// Geocoding
// ============================================================================

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const r = await kakaoGeocode(address)
  if (!r) return { found: false }
  return {
    found: true,
    address: r.address,
    road_address: r.road_address,
    lat: r.lat,
    lng: r.lng,
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const r = await kakaoReverse(lat, lng)
  if (!r) return { found: false }
  return { found: true, ...r }
}

// ============================================================================
// 출장 플랜 추천
// ============================================================================

export async function fetchTripRecommend(req: TripRequest): Promise<TripRecommendResponse> {
  const r = await recommendTrip({
    origin_lat: req.origin_lat,
    origin_lng: req.origin_lng,
    destination: req.destination,
    date: req.date,
    earliest_departure: req.earliest_departure,
    parking_preference: req.parking_preference,
    modes: req.modes,
  })
  return r as TripRecommendResponse
}

export async function sendTripConsultantMessage(
  _messages: { role: 'user' | 'assistant'; content: string }[],
  _currentState: TripConsultantState,
  _originLat: number,
  _originLng: number,
): Promise<TripConsultantChatResponse> {
  // Trip consultant은 unifiedConsultantChat으로 통합되었으므로 더 이상 별도 필요 없음.
  return {
    reply: '출장 상담은 메인 챗봇을 사용해주세요.',
    action: { action_type: 'none' },
    updated_state: _currentState,
    error: false,
  }
}

// ============================================================================
// 원클릭 서비스 (DEMO)
// ============================================================================

export async function confirmOneClickPlanApi(
  plan: SlotRecommendation,
  errands: Errand[],
): Promise<OneClickConfirmResponse> {
  const r = await confirmOneClickPlan(plan, errands)
  return r as OneClickConfirmResponse
}
export { confirmOneClickPlanApi as confirmOneClickPlan }
