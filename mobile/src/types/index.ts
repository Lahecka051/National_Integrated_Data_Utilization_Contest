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

export type AppMode = 'mode1' | 'mode2'

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
  | 'none'

export interface ConsultantAction {
  action_type: ConsultantActionType
  parsed_errands?: Errand[]
  time_constraint?: TimeConstraint
  recommendation?: RecommendationResponse
}

export interface ConsultantChatResponse {
  reply: string
  action: ConsultantAction
  updated_errands: Errand[]
  updated_time_constraint?: TimeConstraint
  error: boolean
}

export interface AlarmInfo {
  notificationId: string
  date: string
  time: string
  label: string
}
