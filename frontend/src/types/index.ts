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

export interface Errand {
  task_type: FacilityType
  task_name: string
  facility_id?: string
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

export interface TripRequest {
  origin_lat: number
  origin_lng: number
  destination: string
  date: string                  // YYYY-MM-DD
  earliest_departure: string    // HH:MM
  parking_preference: ParkingPreference
  modes: TransportMode[]
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

export interface TripPlan {
  rank: number
  origin_hub: TripHub
  destination_hub: TripHub
  schedule: TripScheduleInfo
  parking: TripParkingInfo | null
  parking_preference: ParkingPreference
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
  | 'trip_info_parsed'
  | 'trip_request_recommend'
  | 'none'

export type ConsultantIntent = 'half_day' | 'business_trip' | 'none'

export interface ConsultantAction {
  action_type: ConsultantActionType
  intent?: ConsultantIntent
  // 반차
  parsed_errands?: Errand[]
  time_constraint?: TimeConstraint
  recommendation?: RecommendationResponse
  // 출장
  trip_fields?: {
    destination?: string | null
    date?: string | null
    earliest_departure?: string | null
    parking_preference?: 'near_hub' | 'near_home' | null
    modes?: ('train' | 'expbus')[] | null
  }
  trip_recommendation?: TripRecommendResponse
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
  }
  error: boolean
}
