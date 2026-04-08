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
  OneClickConfirmResponse, NearbyBankOption, NearbyHubOption,
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
import { fetchNearbyTrainStations, type TransitHub } from '../external/railApi'
import { fetchNearbyBusTerminals } from '../external/busTerminalApi'
import { fetchHolidayInfo } from '../external/publicDataApi'

export type { TransitHub }

/**
 * 지역/역명 → 해당 지역의 기차역/버스터미널 목록 반환.
 * 출장 모드의 도착지 선택용 — 사용자가 입력한 키워드를 geocoding해서
 * 근처의 허브(기차역/버스터미널)만 필터링해서 반환.
 */
export async function searchDestinationHubs(
  query: string,
  options: { wantTrain: boolean; wantBus: boolean; radius?: number } = { wantTrain: true, wantBus: true },
): Promise<{ trains: TransitHub[]; buses: TransitHub[]; centerLat: number; centerLng: number } | null> {
  const q = query.trim()
  if (!q) return null

  // 1) 지역/키워드를 좌표로 변환
  let geo = await kakaoGeocode(q)
  if (!geo) geo = await kakaoGeocode(`${q}역`)
  if (!geo) return null

  const centerLat = geo.lat
  const centerLng = geo.lng
  const radius = options.radius ?? 15000

  const result = {
    trains: [] as TransitHub[],
    buses: [] as TransitHub[],
    centerLat,
    centerLng,
  }

  // 2) 근처 허브 검색 (병렬)
  const tasks: Promise<void>[] = []
  if (options.wantTrain) {
    tasks.push(
      fetchNearbyTrainStations(centerLat, centerLng, radius)
        .then(r => { result.trains = r.hubs.slice(0, 10) })
        .catch(() => { /* noop */ }),
    )
  }
  if (options.wantBus) {
    tasks.push(
      fetchNearbyBusTerminals(centerLat, centerLng, radius)
        .then(r => { result.buses = r.hubs.slice(0, 10) })
        .catch(() => { /* noop */ }),
    )
  }
  await Promise.all(tasks)

  return result
}

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
  timeConstraint?: TimeConstraint | null,
): Promise<RecommendationResponse> {
  const result = await recommendBestSlots(
    errands, startLat, startLng, 4,
    timeConstraint ? (timeConstraint as any) : null,
  )
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
  // 기존 errand의 selected_facility는 보존되며, 새 errand는 selected_facility 없이 추가됨.
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
    for (const key of ['destination', 'date', 'earliest_departure', 'parking_preference', 'modes', 'access_mode']) {
      const val = (result.trip_fields as any)[key]
      if (val != null) updatedTripState[key] = val
    }
  }

  // === 게이트: 반차 모드에서 은행 용무가 있고 selected_facility가 없으면 추천 차단 ===
  // (사용자가 은행을 명시적으로 골라야만 추천 진행)
  let nearbyBankOptions: NearbyBankOption[] | undefined
  let bankReply: string | undefined
  const needsBankSelection =
    shouldRecommend &&
    intent === 'half_day' &&
    updatedErrands.some(e => e.task_type === '은행' && !e.selected_facility) &&
    originLat != null && originLng != null

  if (needsBankSelection) {
    try {
      const banksRes = await fetchNearbyBanks(originLat as number, originLng as number)
      nearbyBankOptions = (banksRes.banks || []).slice(0, 6).map(b => ({
        id: b.id,
        name: b.name,
        address: b.road_address || b.address || '',
        distance: b.distance,
        lat: b.lat,
        lng: b.lng,
      }))
    } catch {
      nearbyBankOptions = []
    }
    bankReply = nearbyBankOptions && nearbyBankOptions.length > 0
      ? '은행 업무는 어느 지점에서 처리하시겠어요? 아래에서 선택해주세요.'
      : '근처 은행을 찾지 못했어요. 위치를 확인하거나 다시 시도해주세요.'
  }

  // === 게이트 1: 출장 모드에서 access_mode(차량/대중교통)가 정해지지 않으면 먼저 선택 받기 ===
  let accessModeReply: string | undefined
  const needsAccessModeSelection =
    shouldRecommend &&
    intent === 'business_trip' &&
    !!updatedTripState.destination &&
    !!updatedTripState.date &&
    !updatedTripState.access_mode &&  // 사용자가 명시 안 한 경우
    originLat != null && originLng != null

  if (needsAccessModeSelection) {
    accessModeReply = `${updatedTripState.destination}로 ${updatedTripState.date} 출장 일정을 찾아드릴게요. 출발역·터미널까지 어떻게 이동하시겠어요?`
  }

  // === 게이트 2: 출장 모드에서 destination이 있으면 허브(기차역/터미널)를 사용자가 직접 골라야 함 ===
  // 수동 폼과 동일하게 목적지 결과는 반드시 기차역/버스터미널로 귀결되어야 함.
  let nearbyHubOptions: NearbyHubOption[] | undefined
  let hubReply: string | undefined
  const needsHubSelection =
    shouldRecommend &&
    intent === 'business_trip' &&
    !needsAccessModeSelection &&  // access_mode 게이트가 먼저 통과되어야 함
    !!updatedTripState.destination &&
    !(updatedTripState as any).destination_hub &&  // 이미 허브가 선택된 경우가 아닐 때
    originLat != null && originLng != null

  if (needsHubSelection) {
    try {
      const wantTrain = !updatedTripState.modes || updatedTripState.modes.includes('train')
      const wantBus = !updatedTripState.modes || updatedTripState.modes.includes('expbus')
      const hubResult = await searchDestinationHubs(updatedTripState.destination!, {
        wantTrain,
        wantBus,
        radius: 15000,
      })
      if (hubResult) {
        const combined: NearbyHubOption[] = []
        // 기차역 먼저, 그 다음 터미널
        for (const h of hubResult.trains.slice(0, 5)) {
          combined.push({
            id: h.id, name: h.name, type: 'train_station',
            address: h.address, distance: h.distance, lat: h.lat, lng: h.lng,
          })
        }
        for (const h of hubResult.buses.slice(0, 5)) {
          combined.push({
            id: h.id, name: h.name, type: 'bus_terminal',
            address: h.address, distance: h.distance, lat: h.lat, lng: h.lng,
          })
        }
        nearbyHubOptions = combined
      } else {
        nearbyHubOptions = []
      }
    } catch {
      nearbyHubOptions = []
    }
    hubReply = nearbyHubOptions && nearbyHubOptions.length > 0
      ? `${updatedTripState.destination} 근처 기차역·터미널을 찾았어요. 어디로 도착할지 선택해주세요.`
      : `${updatedTripState.destination} 근처에서 기차역이나 버스터미널을 찾지 못했어요. 다른 지역이나 역 이름으로 다시 말씀해주세요.`
  }

  // 추천 실행 (은행 게이트/access_mode 게이트/허브 게이트가 발동하지 않은 경우에만)
  let recommendationResult: RecommendationResponse | undefined
  let tripRecommendationResult: TripRecommendResponse | undefined

  if (shouldRecommend && !needsBankSelection && !needsAccessModeSelection && !needsHubSelection) {
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
      // 출장: destination_hub가 이미 있다고 가정 (허브 게이트를 통과한 상태)
      const trip = await recommendTrip({
        origin_lat: originLat,
        origin_lng: originLng,
        destination: updatedTripState.destination,
        destination_hub: (updatedTripState as any).destination_hub,
        date: updatedTripState.date,
        earliest_departure: updatedTripState.earliest_departure || '08:00',
        parking_preference: updatedTripState.parking_preference || 'near_hub',
        modes: updatedTripState.modes || ['train', 'expbus'],
        access_mode: updatedTripState.access_mode || 'drive',
      })
      tripRecommendationResult = trip as TripRecommendResponse
      actionType = 'trip_request_recommend'
    }
  }

  if (needsBankSelection) {
    actionType = 'bank_selection_needed'
  }
  if (needsAccessModeSelection) {
    actionType = 'trip_access_mode_needed'
  }
  if (needsHubSelection) {
    actionType = 'trip_hub_selection_needed'
  }

  // 출장 추천이 성공적으로 실행된 경우: 선택 필드 누락 시 더 정확한 추천을 위한 안내를 답변에 부착
  let tripOptionalHint: string | undefined
  if (tripRecommendationResult && intent === 'business_trip') {
    const missingOptional: string[] = []
    if (!updatedTripState.earliest_departure) missingOptional.push('출발 시각')
    if (!updatedTripState.modes || updatedTripState.modes.length === 0) missingOptional.push('교통수단(기차/고속버스)')
    if (updatedTripState.access_mode === 'drive' && !updatedTripState.parking_preference) missingOptional.push('주차 위치')
    if (missingOptional.length > 0) {
      tripOptionalHint = `\n\n💡 ${missingOptional.join(', ')} 등을 추가로 알려주시면 더 정확하게 추천해드릴 수 있어요.`
    }
  }
  const baseReply = accessModeReply || hubReply || bankReply || result.text || ''
  const finalReply = tripOptionalHint ? baseReply + tripOptionalHint : baseReply

  return {
    reply: finalReply,
    action: {
      action_type: actionType as any,
      intent: intent as any,
      parsed_errands: result.parsed_errands || undefined,
      time_constraint: result.time_constraint ? (updatedTc as TimeConstraint) : undefined,
      recommendation: recommendationResult,
      nearby_banks: nearbyBankOptions,
      trip_fields: result.trip_fields || undefined,
      trip_recommendation: tripRecommendationResult,
      nearby_hubs: nearbyHubOptions,
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
    destination_lat: req.destination_lat,
    destination_lng: req.destination_lng,
    destination_hub: req.destination_hub,
    date: req.date,
    earliest_departure: req.earliest_departure,
    parking_preference: req.parking_preference,
    modes: req.modes,
    access_mode: req.access_mode,
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
