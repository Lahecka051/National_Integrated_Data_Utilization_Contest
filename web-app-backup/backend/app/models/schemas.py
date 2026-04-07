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
    action_type: str  # errands_parsed, time_constraint_set, recommend_triggered, none
    parsed_errands: Optional[list[Errand]] = None
    time_constraint: Optional[TimeConstraint] = None
    recommendation: Optional[RecommendationResponse] = None


class ConsultantChatRequest(BaseModel):
    messages: list[ChatMessage]
    current_errands: list[Errand] = []
    current_time_constraint: Optional[TimeConstraint] = None


class ConsultantChatResponse(BaseModel):
    reply: str
    action: ConsultantAction
    updated_errands: list[Errand] = []
    updated_time_constraint: Optional[TimeConstraint] = None
    error: bool = False
