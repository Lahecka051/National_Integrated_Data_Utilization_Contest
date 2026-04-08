export type FacilityType = '민원실' | '은행' | '우체국'
export type HalfDayType = '오전반차' | '오후반차' | '연차'
export type WeatherCondition = '맑음' | '흐림' | '비' | '눈'

export interface Facility {
  id: string
  name: string
  type: FacilityType
  address: string
  lat: number
  lng: number
  open_time: string
  close_time: string
}

/**
 * 사용자가 ErrandSelectPage에서 직접 선택한 시설(예: 특정 은행 지점).
 * 자동 검색(가장 가까운 시설)을 우회하기 위해 errand에 첨부한다.
 */
export interface SelectedFacility {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

export interface Errand {
  task_type: FacilityType
  task_name: string
  facility_id?: string
  /** 사용자가 직접 선택한 시설. 있으면 optimizer가 자동검색 대신 이걸 사용한다. */
  selected_facility?: SelectedFacility
  estimated_duration: number
}

export interface BusAlternative {
  bus_no: string
  interval_min: number
  ride_min: number
}

export interface BusInfo {
  stop_name: string
  bus_no: string
  ride_minutes: number
  walk_to_stop_minutes: number
  alternatives: BusAlternative[]
}

export interface FacilityVisit {
  facility: Facility
  arrival_time: string
  wait_time: number
  process_time: number
  departure_time: string
  travel_time_to_next?: number
  travel_mode: string
  travel_minutes: number
  task_names: string[]
  bus_info?: BusInfo
}

export interface WeatherInfo {
  condition: WeatherCondition
  temperature: number
  rain_probability: number
  penalty_factor: number
}

export interface SlotRecommendation {
  rank: number
  date: string
  day_of_week: string
  half_day_type: HalfDayType
  visits: FacilityVisit[]
  weather: WeatherInfo
  total_wait_time: number
  total_travel_time: number
  total_minutes: number
  reason: string
  is_recommended: boolean
}

export interface RecommendationResponse {
  recommendations: SlotRecommendation[]
  not_recommended: SlotRecommendation | null
  note?: string | null
}

export interface TaskList {
  tasks: Record<string, string[]>
  durations: Record<string, number>
}

export type AppMode = 'mode1' | 'mode2' | 'business-trip'
export type AppStep =
  | 'landing'
  | 'errand-select'
  | 'date-select'
  | 'loading'
  | 'result'
  | 'business-trip'

// === 위치 / Geocoding ===
export type LocationSource = 'gps' | 'manual' | 'default'

export interface UserLocation {
  lat: number
  lng: number
  address?: string
  source: LocationSource
}

export interface GeocodeResult {
  found: boolean
  address?: string
  road_address?: string
  lat?: number
  lng?: number
}

export interface ReverseGeocodeResult {
  found: boolean
  address?: string
  road_address?: string
  region_1depth?: string
  region_2depth?: string
  region_3depth?: string
}

// === 출장 모드 - 공공주차장 ===
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

export interface ParkingListResponse {
  parkings: PublicParking[]
  source: string
  has_realtime: boolean
}

// === 출장 모드 - 대중교통 허브 ===
export type HubType = 'train_station' | 'bus_terminal'

export interface TransitHub {
  id: string
  name: string
  type: HubType
  address: string
  lat: number
  lng: number
  distance: number
  category: string
  phone: string
}

export interface TransitHubListResponse {
  hubs: TransitHub[]
  source: string
}

export type CongestionLevelType = '여유' | '보통' | '혼잡'

export interface HubCongestion {
  hub_id: string
  hub_name: string
  hub_type: HubType
  level: CongestionLevelType
  score: number
  factors: {
    time_of_day: number
    day_of_week: number
    holiday: number
    traffic_wait: number
    seat_availability: number
    avg_pedestrian_wait_sec?: number
    bus_seat_remaining_ratio?: number | null
  }
  timestamp: string
  note: string
}

// === 출장 여행 추천 ===
export type TransportMode = 'train' | 'expbus'
export type ParkingPreference = 'near_hub' | 'near_home'
/**
 * 출발지 → 출발 허브 이동 수단.
 *  - 'drive':   차량 (기존 동작) — 공공주차장 매칭 포함
 *  - 'transit': 대중교통 (버스/지하철) — 주차장 없음, 거리 기반 이동시간 추정
 */
export type AccessMode = 'drive' | 'transit'

/** 사용자가 선택한 도착 허브 (기차역 또는 버스터미널) */
export interface SelectedDestinationHub {
  id: string
  name: string
  type: HubType
  address: string
  lat: number
  lng: number
}

export interface TripRequest {
  origin_lat: number
  origin_lng: number
  destination: string
  /** 선택적 목적지 좌표. 제공되면 geocoding 단계를 건너뛰고 바로 사용. */
  destination_lat?: number
  destination_lng?: number
  /** 사용자가 선택한 도착 허브 — 제공되면 허브 검색 단계도 건너뜀 */
  destination_hub?: SelectedDestinationHub
  date: string                  // YYYY-MM-DD
  earliest_departure: string    // HH:MM
  parking_preference: ParkingPreference
  modes: TransportMode[]
  /** 출발지→허브 이동 수단. 미지정 시 'drive'(기존 동작). */
  access_mode?: AccessMode
}

export interface TripHub {
  id: string
  name: string
  type: HubType | string
  address: string
  lat: number
  lng: number
}

export interface TripScheduleInfo {
  mode: TransportMode
  vehicle_name: string
  dep_date: string
  dep_time: string
  arr_date: string
  arr_time: string
  duration_min: number
  fare_won: number
  is_estimated: boolean
  grade: string
  note: string
}

export interface TripParkingInfo {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distance_to_hub: number
  walk_minutes: number
  status: ParkingStatus
  available_slots: number | null
  total_slots: number | null
  fee_info: string
}

/**
 * access_mode === 'transit'일 때, 출발지→출발허브 대중교통 이동 정보.
 */
export interface TripTransitInfo {
  duration_min: number     // 추정 소요시간
  distance_km: number      // 거리
  note: string             // 예: "지하철+버스 추정"
}

export interface TripPlan {
  rank: number
  origin_hub: TripHub
  destination_hub: TripHub
  schedule: TripScheduleInfo
  parking: TripParkingInfo | null
  parking_preference: ParkingPreference
  /** 어떤 수단으로 출발 허브까지 가는지. 'drive' = 주차장 사용, 'transit' = 대중교통. */
  access_mode: AccessMode
  /** access_mode === 'transit' 일 때만 채워짐. */
  transit_info?: TripTransitInfo | null
  total_duration_min: number
  total_fare_won: number
  score: number
  reasons: string[]
}

export interface TripRecommendResponse {
  plans: TripPlan[]
  destination_resolved: string
  destination_lat: number
  destination_lng: number
  origin_address: string
  has_realtime_schedule: boolean
  note: string
}

// === 출장 AI 상담사 ===
export interface TripConsultantState {
  destination?: string | null
  date?: string | null
  earliest_departure?: string | null
  parking_preference?: ParkingPreference | null
  modes?: TransportMode[] | null
  access_mode?: AccessMode | null
}

export interface TripConsultantAction {
  action_type: 'info_parsed' | 'request_recommend' | 'none'
  parsed_fields?: TripConsultantState | null
  recommendation?: TripRecommendResponse | null
}

export interface TripConsultantChatResponse {
  reply: string
  action: TripConsultantAction
  updated_state: TripConsultantState
  error: boolean
}

export interface TripChatMessage {
  role: 'user' | 'assistant'
  content: string
  action?: TripConsultantAction
}

// === 원클릭 서비스 (DEMO/MOCK) ===

export interface OneClickDocument {
  document_name: string
  required_for: string
  source: string
  auto_issued: boolean
  issued_at: string | null
  status: string
  download_url: string | null
  is_mock: boolean
}

export interface OneClickReservation {
  facility_id: string
  facility_name: string
  facility_type: string
  visit_date: string
  visit_time: string
  reservation_number: string
  channel: string
  status: string
  is_mock: boolean
}

export interface OneClickConfirmResponse {
  success: boolean
  is_mock: boolean
  summary: string
  documents: OneClickDocument[]
  reservations: OneClickReservation[]
  warnings: string[]
  confirmed_at: string
}

// LLM 관련 타입
export interface NLParseResponse {
  errands: Errand[]
  original_text: string
  parsed_successfully: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  action?: ConsultantAction
}

// AI 상담사 챗봇 타입
export interface TimeConstraint {
  start_time?: string | null
  end_time?: string | null
  date?: string | null
  start_date?: string | null
}

export type ConsultantActionType =
  | 'errands_parsed'
  | 'time_constraint_set'
  | 'recommend_triggered'
  | 'request_recommend'
  | 'bank_selection_needed'
  | 'trip_info_parsed'
  | 'trip_request_recommend'
  | 'trip_access_mode_needed'
  | 'trip_hub_selection_needed'
  | 'none'

/** 챗봇 은행 선택 카드용 — sendConsultantMessage가 첨부 */
export interface NearbyBankOption {
  id: string
  name: string
  address: string
  distance: number
  lat: number
  lng: number
}

/** 챗봇 출장 허브 선택 카드용 — 기차역/버스터미널 */
export interface NearbyHubOption {
  id: string
  name: string
  type: HubType
  address: string
  distance: number
  lat: number
  lng: number
}

export type ConsultantIntent = 'half_day' | 'business_trip' | 'none'

export interface ConsultantAction {
  action_type: ConsultantActionType
  intent?: ConsultantIntent
  // 반차
  parsed_errands?: Errand[]
  time_constraint?: TimeConstraint
  recommendation?: RecommendationResponse
  /** action_type === 'bank_selection_needed' 일 때, 사용자가 고를 수 있는 근처 은행 후보 */
  nearby_banks?: NearbyBankOption[]
  // 출장
  trip_fields?: {
    destination?: string | null
    date?: string | null
    earliest_departure?: string | null
    parking_preference?: 'near_hub' | 'near_home' | null
    modes?: ('train' | 'expbus')[] | null
    access_mode?: AccessMode | null
  }
  trip_recommendation?: TripRecommendResponse
  /** action_type === 'trip_hub_selection_needed' 일 때, 사용자가 고를 수 있는 기차역/터미널 후보 */
  nearby_hubs?: NearbyHubOption[]
}

export interface ConsultantChatResponse {
  reply: string
  action: ConsultantAction
  updated_errands: Errand[]
  updated_time_constraint?: TimeConstraint
  updated_trip_state?: {
    destination?: string | null
    date?: string | null
    earliest_departure?: string | null
    parking_preference?: 'near_hub' | 'near_home' | null
    modes?: ('train' | 'expbus')[] | null
    access_mode?: AccessMode | null
  }
  error: boolean
}
