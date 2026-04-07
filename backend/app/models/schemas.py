from pydantic import BaseModel
from typing import Optional
from enum import Enum


class FacilityType(str, Enum):
    CIVIL_SERVICE = "민원실"
    BANK = "은행"
    POST_OFFICE = "우체국"


class HalfDayType(str, Enum):
    MORNING = "오전반차"
    AFTERNOON = "오후반차"
    FULL_DAY = "연차"


class WeatherCondition(str, Enum):
    CLEAR = "맑음"
    CLOUDY = "흐림"
    RAIN = "비"
    SNOW = "눈"


class Facility(BaseModel):
    id: str
    name: str
    type: FacilityType
    address: str
    lat: float
    lng: float
    open_time: str = "09:00"
    close_time: str = "18:00"


class Errand(BaseModel):
    task_type: FacilityType
    task_name: str
    facility_id: Optional[str] = None
    estimated_duration: int = 15  # minutes


class ErrandRequest(BaseModel):
    errands: list[Errand]
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None


class BusAlternative(BaseModel):
    bus_no: str
    interval_min: int
    ride_min: int


class BusInfo(BaseModel):
    stop_name: str
    bus_no: str
    ride_minutes: int
    walk_to_stop_minutes: int
    alternatives: list[BusAlternative] = []


class FacilityVisit(BaseModel):
    facility: Facility
    arrival_time: str
    wait_time: int  # minutes
    process_time: int  # minutes
    departure_time: str
    travel_time_to_next: Optional[int] = None  # minutes
    travel_mode: str = "walk"  # walk, bus, subway
    travel_minutes: int = 0  # 이동 소요시간
    task_names: list[str] = []
    bus_info: Optional[BusInfo] = None


class WeatherInfo(BaseModel):
    condition: WeatherCondition
    temperature: int
    rain_probability: int
    penalty_factor: float = 1.0


class SlotRecommendation(BaseModel):
    rank: int
    date: str
    day_of_week: str
    half_day_type: HalfDayType
    visits: list[FacilityVisit]
    weather: WeatherInfo
    total_wait_time: int
    total_travel_time: int
    total_minutes: int
    reason: str
    is_recommended: bool = True


class RecommendationResponse(BaseModel):
    recommendations: list[SlotRecommendation]
    not_recommended: Optional[SlotRecommendation] = None


class OptimizeSlotRequest(BaseModel):
    errands: list[Errand]
    date: str  # YYYY-MM-DD
    half_day_type: HalfDayType
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None


# === LLM 관련 모델 ===

class NLParseRequest(BaseModel):
    text: str


class NLParseResponse(BaseModel):
    errands: list[Errand]
    original_text: str
    parsed_successfully: bool


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    recommendation: SlotRecommendation
    errands: list[Errand] = []


class ChatResponse(BaseModel):
    reply: str
    error: bool = False


# === AI 상담사 챗봇 모델 ===

class TimeConstraint(BaseModel):
    start_time: Optional[str] = None  # "14:00"
    end_time: Optional[str] = None  # "16:00"
    date: Optional[str] = None  # 특정 날짜 "2025-04-10"
    start_date: Optional[str] = None  # 시작 날짜 필터 "2025-04-20" (이 날짜 이후만 추천)


class ConsultantAction(BaseModel):
    """통합 상담사 액션 — 반차/출장 모드 모두 지원."""
    action_type: str  # errands_parsed, time_constraint_set, request_recommend, trip_info_parsed, trip_request_recommend, none
    intent: Optional[str] = None   # half_day | business_trip | none
    # 반차 모드
    parsed_errands: Optional[list[Errand]] = None
    time_constraint: Optional[TimeConstraint] = None
    recommendation: Optional[RecommendationResponse] = None
    # 출장 모드
    trip_fields: Optional[dict] = None
    trip_recommendation: Optional[dict] = None  # TripRecommendResponse dict


class ConsultantChatRequest(BaseModel):
    messages: list[ChatMessage]
    current_errands: list[Errand] = []
    current_time_constraint: Optional[TimeConstraint] = None
    # 출장 모드용 추가 상태
    current_trip_state: Optional[dict] = None
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None


class ConsultantChatResponse(BaseModel):
    reply: str
    action: ConsultantAction
    updated_errands: list[Errand] = []
    updated_time_constraint: Optional[TimeConstraint] = None
    updated_trip_state: Optional[dict] = None
    error: bool = False


# === 출장 모드 - 공공주차장 ===

class ParkingStatus(str, Enum):
    AVAILABLE = "여유"   # 30% 이상 여유
    MODERATE = "보통"    # 10~30%
    CROWDED = "혼잡"     # <10%
    FULL = "만차"        # 0
    UNKNOWN = "정보없음"  # 실시간 데이터 없음


class PublicParking(BaseModel):
    id: str
    name: str
    address: str
    lat: float
    lng: float
    distance: int = 0  # 미터
    parking_type: str = ""   # 노상/노외/공영 등
    total_slots: Optional[int] = None
    available_slots: Optional[int] = None
    status: ParkingStatus = ParkingStatus.UNKNOWN
    fee_info: str = ""
    operating_hours: str = ""
    phone: str = ""
    source: str = "kakao"  # kakao | data_go_kr | seoul_opendata


class ParkingListResponse(BaseModel):
    parkings: list[PublicParking]
    source: str
    has_realtime: bool = False


# === 출장 모드 - 대중교통 허브 ===

class HubType(str, Enum):
    TRAIN_STATION = "train_station"
    BUS_TERMINAL = "bus_terminal"


class TransitHub(BaseModel):
    id: str
    name: str
    type: HubType
    address: str
    lat: float
    lng: float
    distance: int = 0
    category: str = ""   # KTX/SRT/고속/시외 등
    phone: str = ""


class TransitHubListResponse(BaseModel):
    hubs: list[TransitHub]
    source: str


class CongestionLevel(str, Enum):
    LOW = "여유"
    MODERATE = "보통"
    HIGH = "혼잡"


class HubCongestion(BaseModel):
    hub_id: str
    hub_name: str
    hub_type: HubType
    level: CongestionLevel
    score: int  # 0~100
    factors: dict   # {time_of_day, traffic_wait, available_seats_ratio, ...}
    timestamp: str
    note: str = ""


# === 위치 / Geocoding ===

class LocationInput(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None


class GeocodeRequest(BaseModel):
    address: str


class GeocodeResponse(BaseModel):
    address: str
    road_address: Optional[str] = None
    lat: float
    lng: float
    found: bool = True


class ReverseGeocodeRequest(BaseModel):
    lat: float
    lng: float


class ReverseGeocodeResponse(BaseModel):
    address: str
    road_address: Optional[str] = None
    region_1depth: str = ""   # 시/도
    region_2depth: str = ""   # 구/군
    region_3depth: str = ""   # 동/읍/면
    found: bool = True


# === 출장 여행 추천 (TripRecommend) ===

class TransportMode(str, Enum):
    TRAIN = "train"       # KTX/SRT/ITX/무궁화
    EXPBUS = "expbus"     # 고속버스


class ParkingPreference(str, Enum):
    NEAR_HUB = "near_hub"       # 출발역/터미널 근처에 주차
    NEAR_HOME = "near_home"     # 현재 위치(집·사무실) 근처에 주차


class TripRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    destination: str                  # 목적지 도시/역 이름 (예: "부산", "부산역")
    date: str                         # YYYY-MM-DD
    earliest_departure: str = "08:00" # HH:MM (이 시간 이후 출발편 우선)
    parking_preference: ParkingPreference = ParkingPreference.NEAR_HUB
    modes: list[TransportMode] = [TransportMode.TRAIN, TransportMode.EXPBUS]


class TripHub(BaseModel):
    id: str
    name: str
    type: HubType     # train_station | bus_terminal
    address: str
    lat: float
    lng: float


class TripScheduleInfo(BaseModel):
    """개별 열차/버스 편 정보."""
    mode: TransportMode
    vehicle_name: str            # "KTX 101" / "고속버스 우등"
    dep_date: str                # YYYY-MM-DD
    dep_time: str                # HH:MM
    arr_date: str                # YYYY-MM-DD (자정 넘어가면 +1일)
    arr_time: str                # HH:MM
    duration_min: int
    fare_won: int
    is_estimated: bool = True    # True: 거리 기반 추정, False: 실시간 TAGO
    grade: str = ""              # KTX/SRT/ITX/무궁화/우등/일반 등
    note: str = ""


class TripParkingInfo(BaseModel):
    """플랜에 포함된 주차장 정보 (PublicParking 요약)."""
    id: str
    name: str
    address: str
    lat: float
    lng: float
    distance_to_hub: int        # 출발허브까지 도보 거리(m)
    walk_minutes: int
    status: ParkingStatus
    available_slots: Optional[int] = None
    total_slots: Optional[int] = None
    fee_info: str = ""


class TripPlan(BaseModel):
    rank: int
    origin_hub: TripHub
    destination_hub: TripHub
    schedule: TripScheduleInfo
    parking: Optional[TripParkingInfo] = None
    parking_preference: ParkingPreference
    total_duration_min: int      # 주차장→허브 도보 + 탑승시간 + 여유
    total_fare_won: int
    score: int                   # 0~100 (높을수록 좋음)
    reasons: list[str] = []      # ["최단 소요시간", "주차 여유", ...]


class TripRecommendResponse(BaseModel):
    plans: list[TripPlan]
    destination_resolved: str    # Kakao로 해석된 목적지 주소
    destination_lat: float
    destination_lng: float
    origin_address: str = ""
    has_realtime_schedule: bool = False
    note: str = ""


# === 출장 AI 상담사 ===

class TripConsultantState(BaseModel):
    """현재 세션에서 파악된 출장 정보 상태."""
    destination: Optional[str] = None
    date: Optional[str] = None
    earliest_departure: Optional[str] = None
    parking_preference: Optional[ParkingPreference] = None
    modes: Optional[list[TransportMode]] = None


class TripConsultantChatRequest(BaseModel):
    messages: list[ChatMessage]
    current_state: TripConsultantState = TripConsultantState()
    origin_lat: float
    origin_lng: float


class TripConsultantAction(BaseModel):
    action_type: str   # info_parsed | request_recommend | none
    parsed_fields: Optional[dict] = None
    recommendation: Optional[TripRecommendResponse] = None


class TripConsultantChatResponse(BaseModel):
    reply: str
    action: TripConsultantAction
    updated_state: TripConsultantState
    error: bool = False
