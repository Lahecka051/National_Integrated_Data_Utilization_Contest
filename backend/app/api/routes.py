import asyncio
from fastapi import APIRouter
from ..models.schemas import (
    ErrandRequest,
    OptimizeSlotRequest,
    RecommendationResponse,
    SlotRecommendation,
    Facility,
    FacilityType,
    Errand,
    NLParseRequest,
    NLParseResponse,
    ChatRequest,
    ChatResponse,
)
from ..services.optimizer import recommend_best_slots, simulate_slot, HalfDayType
from ..services.wait_time_model import generate_heatmap
from ..services.llm_service import (
    parse_errands_from_text,
    generate_recommendation_reason,
    chat_about_recommendation,
    is_llm_available,
)
from ..mock.data import FACILITIES, get_civil_wait, get_bank_wait, get_post_wait, TASK_DURATIONS
from ..external.public_api import (
    fetch_civil_realtime, fetch_civil_meta,
    parse_civil_realtime, parse_civil_meta,
    fetch_crossroad_map, fetch_traffic_light_signal,
    parse_crossroad_map, parse_traffic_light_signal, get_pedestrian_wait_estimate,
    fetch_bus_route_info, fetch_bus_realtime_location,
    parse_bus_route_info, parse_bus_realtime_location,
    has_api_key,
)
from ..external.kakao_api import search_nearby_banks, search_nearby_post_offices, get_multi_stop_route
from ..external.public_api import (
    fetch_weather_forecast as fetch_weather_api,
    parse_weather_forecast,
    fetch_holiday_info,
)
from ..mock.data import DEFAULT_START
from datetime import datetime

router = APIRouter(prefix="/api")


async def _enrich_reasons(slots: list[SlotRecommendation]) -> None:
    """LLM으로 추천 이유를 자연어로 보강 (실패시 기존 reason 유지)"""
    if not is_llm_available() or not slots:
        return
    tasks = []
    for slot in slots:
        tasks.append(generate_recommendation_reason(slot.model_dump()))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for slot, result in zip(slots, results):
        if isinstance(result, str) and result:
            slot.reason = result


@router.post("/recommend", response_model=RecommendationResponse)
async def get_recommendation(request: ErrandRequest):
    """모드1: 용무 목록 → 최적 반차 날짜/시간 추천"""
    result = recommend_best_slots(request.errands)
    response = RecommendationResponse(**result)
    # LLM으로 추천 이유 보강 (상위 3개 + 비추천 1개)
    enrich_targets = list(response.recommendations)
    if response.not_recommended:
        enrich_targets.append(response.not_recommended)
    await _enrich_reasons(enrich_targets)
    return response


@router.post("/optimize-slot", response_model=RecommendationResponse)
async def optimize_single_slot(request: OptimizeSlotRequest):
    """모드2: 특정 날짜+반차유형 → 최적 방문 순서 추천
    연차일 경우 오전반차/오후반차 비교군도 함께 반환"""
    from datetime import datetime as dt
    target_date = dt.strptime(request.date, "%Y-%m-%d")
    half_day = HalfDayType(request.half_day_type)

    if half_day == HalfDayType.FULL_DAY:
        slot_full = simulate_slot(request.errands, target_date, HalfDayType.FULL_DAY)
        slot_morning = simulate_slot(request.errands, target_date, HalfDayType.MORNING)
        slot_afternoon = simulate_slot(request.errands, target_date, HalfDayType.AFTERNOON)

        slots = [slot_full, slot_morning, slot_afternoon]
        slots.sort(key=lambda s: s.total_minutes)
        for i, s in enumerate(slots):
            s.rank = i + 1

        response = RecommendationResponse(recommendations=slots, not_recommended=None)
    else:
        result = simulate_slot(request.errands, target_date, half_day)
        result.rank = 1
        response = RecommendationResponse(recommendations=[result], not_recommended=None)

    await _enrich_reasons(response.recommendations)
    return response


@router.post("/parse-errands", response_model=NLParseResponse)
async def parse_errands(request: NLParseRequest):
    """자연어 → 구조화된 용무 파싱 (LLM)"""
    parsed = await parse_errands_from_text(request.text)
    if parsed:
        errands = [
            Errand(
                task_type=item["task_type"],
                task_name=item["task_name"],
                estimated_duration=item["estimated_duration"],
            )
            for item in parsed
        ]
        return NLParseResponse(
            errands=errands,
            original_text=request.text,
            parsed_successfully=True,
        )
    return NLParseResponse(
        errands=[],
        original_text=request.text,
        parsed_successfully=False,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """AI 챗봇 대화"""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    rec_data = request.recommendation.model_dump()
    errands_data = [e.model_dump() for e in request.errands]

    reply = await chat_about_recommendation(messages, rec_data, errands_data)
    if reply:
        return ChatResponse(reply=reply)
    return ChatResponse(
        reply="죄송합니다, AI 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.",
        error=True,
    )


@router.get("/llm-status")
async def get_llm_status():
    """LLM 사용 가능 여부"""
    return {"available": is_llm_available()}


@router.get("/facilities")
async def get_facilities(facility_type: str | None = None):
    """주변 시설 목록"""
    facilities = list(FACILITIES.values())
    if facility_type:
        facilities = [f for f in facilities if f["type"] == facility_type]
    return {"facilities": facilities}


@router.get("/congestion/{facility_id}")
async def get_congestion(facility_id: str):
    """시설별 현재 혼잡도"""
    facility = FACILITIES.get(facility_id)
    if not facility:
        return {"error": "시설을 찾을 수 없습니다"}

    now = datetime.now()
    weekday = now.weekday()
    hour = now.hour
    day_of_month = now.day

    ftype = facility["type"]
    if ftype == "민원실":
        wait = get_civil_wait(weekday, hour)
    elif ftype == "은행":
        wait = get_bank_wait(weekday, hour, day_of_month)
    else:
        wait = get_post_wait(weekday, hour)

    level = "한산" if wait <= 10 else "보통" if wait <= 20 else "혼잡"

    return {
        "facility_id": facility_id,
        "facility_name": facility["name"],
        "current_wait_minutes": wait,
        "congestion_level": level,
        "checked_at": now.isoformat(),
    }


@router.get("/tasks")
async def get_available_tasks():
    """선택 가능한 용무 목록"""
    tasks = {
        "민원실": ["전입신고", "주민등록등본 발급", "인감증명서 발급", "여권 신청"],
        "은행": ["통장 개설", "카드 발급", "대출 상담", "환전"],
        "우체국": ["등기우편 발송", "택배 발송"],
    }
    return {"tasks": tasks, "durations": TASK_DURATIONS}


@router.get("/congestion-heatmap/{facility_id}")
async def get_congestion_heatmap(facility_id: str):
    """시설별 요일x시간대 혼잡도 히트맵 (통계 모델 기반)"""
    facility = FACILITIES.get(facility_id)
    if not facility:
        return {"error": "시설을 찾을 수 없습니다"}

    heatmap = generate_heatmap(facility["type"], datetime.now().day)
    return {
        "facility_id": facility_id,
        "heatmap": heatmap,
        "source": "statistical_model",
        "description": "한국은행/행정안전부/우정사업본부 통계 기반 추정",
    }


@router.get("/civil-realtime")
async def get_civil_realtime(stdg_cd: str = "3100000000"):
    """
    민원실 실시간 대기현황 (공공데이터 API)
    API 키가 없으면 mock 데이터 반환
    stdg_cd: 법정동코드 (기본값: 부산광역시)
    """
    data = await fetch_civil_realtime(stdg_cd)
    if data:
        return {
            "source": "realtime_api",
            "data": parse_civil_realtime(data),
        }
    # API 키 없으면 mock
    now = datetime.now()
    return {
        "source": "mock",
        "data": [{
            "cso_name": "울산 남구청 민원실",
            "task_name": "종합민원",
            "waiting_count": get_civil_wait(now.weekday(), now.hour),
            "call_number": "-",
            "counter_number": "-",
        }],
    }


@router.get("/civil-meta")
async def get_civil_meta_info(stdg_cd: str = "3100000000"):
    """
    민원실 기본정보 (주소, 좌표, 운영시간)
    API 키가 없으면 mock 데이터 반환
    """
    data = await fetch_civil_meta(stdg_cd)
    if data:
        return {
            "source": "realtime_api",
            "data": parse_civil_meta(data),
        }
    # mock
    return {
        "source": "mock",
        "data": [{
            "cso_name": "울산 남구청 민원실",
            "address": "울산광역시 남구 돋질로 233",
            "lat": 35.5442,
            "lng": 129.3247,
            "open_time": "09:00",
            "close_time": "18:00",
            "night_operation": False,
            "weekend_operation": False,
        }],
    }


@router.get("/traffic-crossroads")
async def get_crossroad_info(stdg_cd: str = "3100000000"):
    """
    교차로 맵 정보 (교차로명, 위도/경도, 제한속도)
    /crsrd_map_info
    """
    data = await fetch_crossroad_map(stdg_cd)
    if data:
        return {
            "source": "realtime_api",
            "data": parse_crossroad_map(data),
        }
    return {
        "source": "mock",
        "data": [
            {"crossroad_id": "CR001", "crossroad_name": "울산시청사거리", "lat": 35.5396, "lng": 129.3114, "speed_limit": "50"},
            {"crossroad_id": "CR002", "crossroad_name": "문화의거리사거리", "lat": 35.5382, "lng": 129.3114, "speed_limit": "60"},
        ],
    }


@router.get("/traffic-signals")
async def get_traffic_signals(stdg_cd: str = "3100000000"):
    """
    신호등 실시간 잔여시간 (8방향별 보행/직진 잔여시간)
    /tl_drct_info
    """
    data = await fetch_traffic_light_signal(stdg_cd)
    if data:
        parsed = parse_traffic_light_signal(data)
        estimates = get_pedestrian_wait_estimate(parsed)
        return {
            "source": "realtime_api",
            "signals": parsed,
            "pedestrian_wait_estimates": estimates,
        }
    return {
        "source": "mock",
        "signals": [],
        "pedestrian_wait_estimates": {
            "CR001": 45,
            "CR002": 30,
        },
    }


@router.get("/bus-routes")
async def get_bus_routes(stdg_cd: str = "3100000000"):
    """
    버스 노선 기본정보
    /mst_info
    """
    data = await fetch_bus_route_info(stdg_cd)
    if data:
        return {
            "source": "realtime_api",
            "data": parse_bus_route_info(data),
        }
    return {
        "source": "mock",
        "data": [
            {"route_id": "BUS001", "route_name": "0015", "start_stop": "서울역", "end_stop": "용산구청"},
        ],
    }


@router.get("/bus-realtime")
async def get_bus_realtime(stdg_cd: str = "3100000000"):
    """
    버스 실시간 위치
    /rtm_loc_info
    """
    data = await fetch_bus_realtime_location(stdg_cd)
    if data:
        return {
            "source": "realtime_api",
            "data": parse_bus_realtime_location(data),
        }
    return {
        "source": "mock",
        "data": [],
    }


@router.get("/holidays/{year}")
async def get_holidays(year: str):
    """한국천문연구원 특일정보 API - 연간 공휴일 조회"""
    holidays = await fetch_holiday_info(year, "")
    if not holidays:
        # 월별로 조회
        all_holidays = []
        for month in range(1, 13):
            month_holidays = await fetch_holiday_info(year, str(month).zfill(2))
            all_holidays.extend(month_holidays)
        holidays = all_holidays
    return {"year": year, "holidays": holidays}


@router.get("/weather")
async def get_weather(date: str = ""):
    """기상청 단기예보 실제 데이터 조회
    date: YYYYMMDD (기본: 오늘)
    울산시청 격자좌표: nx=102, ny=83
    """
    if not date:
        date = datetime.now().strftime("%Y%m%d")
    data = await fetch_weather_api(102, 83, date)
    if data:
        parsed = parse_weather_forecast(data)
        if parsed:
            return {"source": "realtime_api", **parsed}
    # fallback
    return {
        "source": "mock",
        "condition": "맑음", "temperature": 18,
        "rain_probability": 10, "penalty_factor": 1.0,
    }


@router.get("/api-status")
async def get_api_status():
    """현재 API 키 설정 상태 + 전체 API 연결 테스트"""
    status = {
        "data_go_kr_key_set": has_api_key(),
        "message": "API 키가 설정되었습니다. 실시간 데이터를 사용합니다." if has_api_key()
                   else "API 키가 설정되지 않았습니다. Mock 데이터를 사용합니다.",
    }
    if has_api_key():
        # 각 API 연결 테스트
        civil = await fetch_civil_realtime()
        crossroad = await fetch_crossroad_map()
        bus = await fetch_bus_route_info()
        status["api_tests"] = {
            "civil_realtime": "OK" if civil else "FAIL",
            "crossroad_map": "OK" if crossroad else "FAIL",
            "bus_route": "OK" if bus else "FAIL",
        }
    return status


@router.get("/nearby-banks")
async def get_nearby_banks(lat: float = DEFAULT_START["lat"], lng: float = DEFAULT_START["lng"], radius: int = 3000):
    """카카오 Local API로 근처 은행 검색"""
    banks = await search_nearby_banks(lng, lat, radius)
    if banks:
        return {"source": "kakao_api", "banks": banks}
    # fallback mock
    return {
        "source": "mock",
        "banks": [
            {"id": "seoul_station_bank", "name": "BNK경남은행 울산시청지점", "address": "울산광역시 남구 중앙로 201",
             "lat": 35.5396, "lng": 129.3115, "distance": 50},
            {"id": "mock_bank2", "name": "울산농협 남구지점", "address": "울산광역시 남구 삼산로 260",
             "lat": 35.5410, "lng": 129.3120, "distance": 200},
        ],
    }


@router.get("/nearby-post-offices")
async def get_nearby_post(lat: float = DEFAULT_START["lat"], lng: float = DEFAULT_START["lng"], radius: int = 3000):
    """카카오 Local API로 근처 우체국 검색"""
    posts = await search_nearby_post_offices(lng, lat, radius)
    if posts:
        return {"source": "kakao_api", "post_offices": posts}
    return {
        "source": "mock",
        "post_offices": [
            {"id": "seoul_station_post", "name": "울산남부우체국", "address": "울산광역시 남구 중앙로 201",
             "lat": 37.5595, "lng": 126.9736, "distance": 586},
        ],
    }


@router.post("/route")
async def get_route(body: dict):
    """
    카카오 내비 API로 실제 경로 좌표 조회
    body: { visits: [{lat, lng}, ...] }
    출발지(울산시청)부터 방문 순서대로 구간별 경로 반환
    """
    visits = body.get("visits", [])
    if not visits:
        return {"segments": []}

    start = (DEFAULT_START["lng"], DEFAULT_START["lat"])
    stops = [(v["lng"], v["lat"]) for v in visits]
    segments = await get_multi_stop_route(start, stops)
    return {"segments": segments}
