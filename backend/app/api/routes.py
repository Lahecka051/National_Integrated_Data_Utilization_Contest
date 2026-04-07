import asyncio
from fastapi import APIRouter
from ..models.schemas import (
    ErrandRequest,
    OptimizeSlotRequest,
    RecommendationResponse,
    SlotRecommendation,
    Errand,
    NLParseRequest,
    NLParseResponse,
    ChatRequest,
    ChatResponse,
    ConsultantChatRequest,
    ConsultantChatResponse,
    ConsultantAction,
    TimeConstraint,
)
from ..services.optimizer import (
    recommend_best_slots,
    simulate_slot,
    HalfDayType,
    TASK_DURATIONS,
)
from ..services.llm_service import (
    parse_errands_from_text,
    generate_recommendation_reason,
    chat_about_recommendation,
    unified_consultant_chat,
    trip_consultant_chat,
    is_llm_available,
)
from ..external.public_api import (
    fetch_civil_realtime, fetch_civil_meta,
    parse_civil_realtime, parse_civil_meta,
    fetch_crossroad_map, fetch_traffic_light_signal,
    parse_crossroad_map, parse_traffic_light_signal, get_pedestrian_wait_estimate,
    fetch_bus_route_info, fetch_bus_realtime_location,
    parse_bus_route_info, parse_bus_realtime_location,
    has_api_key,
)
from ..external.kakao_api import (
    search_nearby_banks, search_nearby_post_offices, get_multi_stop_route,
    geocode_address, reverse_geocode,
)
from ..external.parking_api import fetch_nearby_parking, fetch_parking_detail
from ..external.rail_api import fetch_nearby_train_stations
from ..external.bus_terminal_api import fetch_nearby_bus_terminals
from ..services.transit_congestion import calculate_hub_congestion
from ..services.trip_recommender import recommend_trip
from ..services.facility_finder import resolve_facilities_for_types
from ..external.public_api import (
    fetch_weather_forecast as fetch_weather_api,
    parse_weather_forecast,
    fetch_holiday_info,
)
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


def _require_origin(lat, lng):
    """origin_lat/origin_lng 유효성 검증."""
    if lat is None or lng is None:
        return None
    try:
        return float(lat), float(lng)
    except (TypeError, ValueError):
        return None


@router.post("/recommend", response_model=RecommendationResponse)
async def get_recommendation(request: ErrandRequest):
    """모드1: 용무 목록 → 최적 반차 날짜/시간 추천 (현재 위치 필수)"""
    origin = _require_origin(request.start_lat, request.start_lng)
    if origin is None:
        return RecommendationResponse(recommendations=[], not_recommended=None)

    result = await recommend_best_slots(
        request.errands,
        origin_lat=origin[0],
        origin_lng=origin[1],
    )
    response = RecommendationResponse(**result)
    enrich_targets = list(response.recommendations)
    if response.not_recommended:
        enrich_targets.append(response.not_recommended)
    await _enrich_reasons(enrich_targets)
    return response


@router.post("/optimize-slot", response_model=RecommendationResponse)
async def optimize_single_slot(request: OptimizeSlotRequest):
    """모드2: 특정 날짜+반차유형 → 최적 방문 순서 추천"""
    origin = _require_origin(request.start_lat, request.start_lng)
    if origin is None:
        return RecommendationResponse(recommendations=[], not_recommended=None)

    from datetime import datetime as dt
    target_date = dt.strptime(request.date, "%Y-%m-%d")
    half_day = HalfDayType(request.half_day_type)

    # 시설/이동매트릭스 준비 (simulate_slot 호출 전에 미리)
    unique_types = {e.task_type.value for e in request.errands}
    facility_map = await resolve_facilities_for_types(unique_types, origin[0], origin[1])
    facility_map = {k: v for k, v in facility_map.items() if v is not None}
    if not facility_map:
        return RecommendationResponse(recommendations=[], not_recommended=None)

    from ..services.optimizer import _build_travel_matrix
    travel_matrix = await _build_travel_matrix(origin[0], origin[1], list(facility_map.values()))
    weather_cache: dict = {}

    if half_day == HalfDayType.FULL_DAY:
        slots = []
        for hd in [HalfDayType.FULL_DAY, HalfDayType.MORNING, HalfDayType.AFTERNOON]:
            s = await simulate_slot(
                request.errands, target_date, hd,
                facility_map, travel_matrix, weather_cache,
            )
            slots.append(s)
        slots.sort(key=lambda s: s.total_minutes)
        for i, s in enumerate(slots):
            s.rank = i + 1
        response = RecommendationResponse(recommendations=slots, not_recommended=None)
    else:
        result = await simulate_slot(
            request.errands, target_date, half_day,
            facility_map, travel_matrix, weather_cache,
        )
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


@router.post("/consultant-chat", response_model=ConsultantChatResponse)
async def consultant_chat_endpoint(request: ConsultantChatRequest):
    """
    통합 AI 상담사 — 반차 + 출장 모드 모두 처리.
    의도를 자동 감지해서 적절한 추천을 실행합니다.
    """
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    current_errands = [e.model_dump() for e in request.current_errands]
    current_tc = request.current_time_constraint.model_dump() if request.current_time_constraint else None
    current_trip_state = request.current_trip_state or {}

    result = await unified_consultant_chat(messages, current_errands, current_tc, current_trip_state)

    if not result:
        return ConsultantChatResponse(
            reply="죄송합니다, 응답을 생성할 수 없습니다. 다시 시도해주세요.",
            action=ConsultantAction(action_type="none"),
            updated_errands=request.current_errands,
            updated_time_constraint=request.current_time_constraint,
            updated_trip_state=current_trip_state,
            error=True,
        )

    intent = result.get("intent", "none")
    action_type = result.get("action_type", "none")
    should_recommend = result.get("should_recommend", False)

    # === 반차 상태 업데이트 ===
    updated_errands = list(request.current_errands)
    if result.get("parsed_errands"):
        existing_names = {e.task_name for e in updated_errands}
        for pe in result["parsed_errands"]:
            if pe["task_name"] not in existing_names:
                updated_errands.append(Errand(
                    task_type=pe["task_type"],
                    task_name=pe["task_name"],
                    estimated_duration=pe["estimated_duration"],
                ))

    updated_tc = request.current_time_constraint
    if result.get("time_constraint"):
        updated_tc = TimeConstraint(**result["time_constraint"])

    # === 출장 상태 업데이트 ===
    updated_trip_state = dict(current_trip_state)
    if result.get("trip_fields"):
        for key in ("destination", "date", "earliest_departure", "parking_preference", "modes"):
            val = result["trip_fields"].get(key)
            if val is not None:
                updated_trip_state[key] = val

    # === 추천 실행 ===
    recommendation_result = None
    trip_recommendation_result = None

    if should_recommend:
        if intent == "half_day" and updated_errands:
            if request.origin_lat is None or request.origin_lng is None:
                # 위치 없이는 반차 추천 불가
                recommendation_result = None
            else:
                tc_dict = updated_tc.model_dump() if updated_tc else None
                rec = await recommend_best_slots(
                    updated_errands,
                    origin_lat=float(request.origin_lat),
                    origin_lng=float(request.origin_lng),
                    time_constraint=tc_dict,
                )
                recommendation_result = RecommendationResponse(**rec)
                await _enrich_reasons(list(recommendation_result.recommendations))
                action_type = "recommend_triggered"

        elif intent == "business_trip" and updated_trip_state.get("destination") and updated_trip_state.get("date"):
            if request.origin_lat is None or request.origin_lng is None:
                trip_recommendation_result = None
            else:
                origin_lat = float(request.origin_lat)
                origin_lng = float(request.origin_lng)
                trip_rec = await recommend_trip(
                    origin_lat=origin_lat,
                    origin_lng=origin_lng,
                    destination=updated_trip_state["destination"],
                    date=updated_trip_state["date"],
                    earliest_departure=updated_trip_state.get("earliest_departure") or "08:00",
                    parking_preference=updated_trip_state.get("parking_preference") or "near_hub",
                    modes=updated_trip_state.get("modes") or ["train", "expbus"],
                )
                trip_recommendation_result = trip_rec
                action_type = "trip_request_recommend"

    action = ConsultantAction(
        action_type=action_type,
        intent=intent,
        parsed_errands=([Errand(**e) for e in result["parsed_errands"]]
                        if result.get("parsed_errands") else None),
        time_constraint=updated_tc if result.get("time_constraint") else None,
        recommendation=recommendation_result,
        trip_fields=result.get("trip_fields"),
        trip_recommendation=trip_recommendation_result,
    )

    return ConsultantChatResponse(
        reply=result.get("text", ""),
        action=action,
        updated_errands=updated_errands,
        updated_time_constraint=updated_tc,
        updated_trip_state=updated_trip_state,
    )


@router.get("/llm-status")
async def get_llm_status():
    """LLM 사용 가능 여부"""
    return {"available": is_llm_available()}


@router.get("/tasks")
async def get_available_tasks():
    """선택 가능한 용무 목록"""
    tasks = {
        "민원실": ["전입신고", "주민등록등본 발급", "인감증명서 발급", "여권 신청"],
        "은행": ["통장 개설", "카드 발급", "대출 상담", "환전"],
        "우체국": ["등기우편 발송", "택배 발송"],
    }
    return {"tasks": tasks, "durations": TASK_DURATIONS}


@router.get("/civil-realtime")
async def get_civil_realtime(stdg_cd: str = "3100000000"):
    """민원실 실시간 대기현황 (공공데이터 API)"""
    data = await fetch_civil_realtime(stdg_cd)
    if data:
        return {"source": "realtime_api", "data": parse_civil_realtime(data)}
    return {"source": "none", "data": [], "error": "API 응답 없음"}


@router.get("/civil-meta")
async def get_civil_meta_info(stdg_cd: str = "3100000000"):
    """민원실 기본정보 (주소, 좌표, 운영시간)"""
    data = await fetch_civil_meta(stdg_cd)
    if data:
        return {"source": "realtime_api", "data": parse_civil_meta(data)}
    return {"source": "none", "data": [], "error": "API 응답 없음"}


@router.get("/traffic-crossroads")
async def get_crossroad_info(stdg_cd: str = "3100000000"):
    """교차로 맵 정보"""
    data = await fetch_crossroad_map(stdg_cd)
    if data:
        return {"source": "realtime_api", "data": parse_crossroad_map(data)}
    return {"source": "none", "data": [], "error": "API 응답 없음"}


@router.get("/traffic-signals")
async def get_traffic_signals(stdg_cd: str = "3100000000"):
    """신호등 실시간 잔여시간"""
    data = await fetch_traffic_light_signal(stdg_cd)
    if data:
        parsed = parse_traffic_light_signal(data)
        estimates = get_pedestrian_wait_estimate(parsed)
        return {
            "source": "realtime_api",
            "signals": parsed,
            "pedestrian_wait_estimates": estimates,
        }
    return {"source": "none", "signals": [], "pedestrian_wait_estimates": {}, "error": "API 응답 없음"}


@router.get("/bus-routes")
async def get_bus_routes(stdg_cd: str = "3100000000"):
    """버스 노선 기본정보"""
    data = await fetch_bus_route_info(stdg_cd)
    if data:
        return {"source": "realtime_api", "data": parse_bus_route_info(data)}
    return {"source": "none", "data": [], "error": "API 응답 없음"}


@router.get("/bus-realtime")
async def get_bus_realtime(stdg_cd: str = "3100000000"):
    """버스 실시간 위치"""
    data = await fetch_bus_realtime_location(stdg_cd)
    if data:
        return {"source": "realtime_api", "data": parse_bus_realtime_location(data)}
    return {"source": "none", "data": [], "error": "API 응답 없음"}


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
async def get_weather(nx: int = 60, ny: int = 127, date: str = ""):
    """기상청 단기예보 실제 데이터 조회.
    nx, ny: 격자좌표 (기본값 서울 60,127)
    date: YYYYMMDD (기본: 오늘)
    """
    if not date:
        date = datetime.now().strftime("%Y%m%d")
    data = await fetch_weather_api(nx, ny, date)
    if data:
        parsed = parse_weather_forecast(data)
        if parsed:
            return {"source": "realtime_api", **parsed}
    return {"source": "none", "error": "기상청 API 응답 없음"}


@router.get("/api-status")
async def get_api_status():
    """현재 API 키 설정 상태 + 전체 API 연결 테스트"""
    status = {
        "data_go_kr_key_set": has_api_key(),
        "llm_available": is_llm_available(),
    }
    if has_api_key():
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
async def get_nearby_banks(lat: float, lng: float, radius: int = 3000):
    """카카오 Local API로 근처 은행 검색. lat/lng 필수."""
    banks = await search_nearby_banks(lng, lat, radius)
    return {"source": "kakao_api", "banks": banks}


@router.get("/nearby-post-offices")
async def get_nearby_post(lat: float, lng: float, radius: int = 3000):
    """카카오 Local API로 근처 우체국 검색. lat/lng 필수."""
    posts = await search_nearby_post_offices(lng, lat, radius)
    return {"source": "kakao_api", "post_offices": posts}


# ============================================================
# 출장 모드: 공공주차장 + 대중교통 허브 + Geocoding
# ============================================================

@router.get("/parking/nearby")
async def get_nearby_parking(lat: float, lng: float, radius: int = 2000):
    """주변 공공주차장 목록 + 실시간 가용(서울 한정). lat/lng 필수."""
    return await fetch_nearby_parking(lat, lng, radius)


@router.get("/parking/{parking_id}")
async def get_parking_detail(parking_id: str, lat: float, lng: float):
    """단일 주차장 상세. lat/lng 필수."""
    detail = await fetch_parking_detail(parking_id, lat, lng)
    if not detail:
        return {"error": "not_found", "parking_id": parking_id}
    return detail


@router.get("/transit/train-stations")
async def get_nearby_train_stations(lat: float, lng: float, radius: int = 5000):
    """주변 기차역. lat/lng 필수."""
    return await fetch_nearby_train_stations(lat, lng, radius)


@router.get("/transit/bus-terminals")
async def get_nearby_bus_terminals(lat: float, lng: float, radius: int = 5000):
    """주변 고속/시외버스 터미널. lat/lng 필수."""
    return await fetch_nearby_bus_terminals(lat, lng, radius)


@router.get("/transit/{hub_type}/congestion")
async def get_hub_congestion(
    hub_type: str,
    hub_id: str,
    hub_name: str,
    lat: float,
    lng: float,
    stdg_cd: str = "3100000000",
    terminal_id: str = "",
):
    """
    허브 혼잡도 지수 산출.
    hub_type: train_station | bus_terminal
    hub_id/hub_name/lat/lng: 쿼리 파라미터로 전달 (프런트에서 목록 아이템을 그대로 넘김)
    """
    result = await calculate_hub_congestion(
        hub_id=hub_id,
        hub_name=hub_name,
        hub_type=hub_type,
        lat=lat,
        lng=lng,
        stdg_cd=stdg_cd,
        terminal_id=terminal_id or None,
        is_holiday=False,
    )
    return result


@router.post("/trip/consultant-chat")
async def trip_consultant_chat_endpoint(body: dict):
    """
    출장 여행 AI 상담사 대화.

    body: {
      messages: [{role, content}],
      current_state: {destination?, date?, earliest_departure?, parking_preference?, modes?},
      origin_lat: float,
      origin_lng: float,
    }
    """
    if not is_llm_available():
        return {
            "reply": "AI 상담사를 사용할 수 없습니다. 수동 입력 폼을 이용해주세요.",
            "action": {"action_type": "none"},
            "updated_state": body.get("current_state", {}),
            "error": True,
        }

    messages = body.get("messages", [])
    current_state = body.get("current_state", {}) or {}

    try:
        origin_lat = float(body.get("origin_lat"))
        origin_lng = float(body.get("origin_lng"))
    except (TypeError, ValueError):
        return {
            "reply": "현재 위치가 설정되지 않았습니다. 상단의 위치 배지에서 위치를 먼저 설정해주세요.",
            "action": {"action_type": "none"},
            "updated_state": current_state,
            "error": True,
        }

    result = await trip_consultant_chat(messages, current_state)
    if not result:
        return {
            "reply": "응답을 생성할 수 없습니다. 다시 시도해주세요.",
            "action": {"action_type": "none"},
            "updated_state": current_state,
            "error": True,
        }

    # parsed_fields를 current_state에 병합
    parsed = result.get("parsed_fields") or {}
    updated_state = dict(current_state)
    for key in ("destination", "date", "earliest_departure", "parking_preference", "modes"):
        val = parsed.get(key)
        if val is not None:
            updated_state[key] = val

    action_type = result.get("action_type", "none")
    should_recommend = result.get("should_recommend", False)

    response = {
        "reply": result.get("text", ""),
        "action": {
            "action_type": action_type,
            "parsed_fields": parsed or None,
            "recommendation": None,
        },
        "updated_state": updated_state,
        "error": False,
    }

    # 추천 실행 조건
    if should_recommend and updated_state.get("destination") and updated_state.get("date"):
        recommendation = await recommend_trip(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            destination=updated_state["destination"],
            date=updated_state["date"],
            earliest_departure=updated_state.get("earliest_departure") or "08:00",
            parking_preference=updated_state.get("parking_preference") or "near_hub",
            modes=updated_state.get("modes") or ["train", "expbus"],
        )
        response["action"]["recommendation"] = recommendation
        response["action"]["action_type"] = "request_recommend"

    return response


@router.post("/trip/recommend")
async def trip_recommend(body: dict):
    """
    출장 플랜 추천 (주차장 + 출발허브 + 열차/버스편).

    body: {
      origin_lat: float,
      origin_lng: float,
      destination: str,
      date: "YYYY-MM-DD",
      earliest_departure: "HH:MM",
      parking_preference: "near_hub" | "near_home",
      modes: ["train", "expbus"]
    }
    """
    try:
        origin_lat = float(body.get("origin_lat"))
        origin_lng = float(body.get("origin_lng"))
    except (TypeError, ValueError):
        return {"plans": [], "note": "origin_lat, origin_lng 필수"}
    destination = (body.get("destination") or "").strip()
    date = (body.get("date") or "").strip()
    earliest = (body.get("earliest_departure") or "08:00").strip()
    parking_pref = body.get("parking_preference", "near_hub")
    modes = body.get("modes") or ["train", "expbus"]

    if not destination or not date:
        return {"plans": [], "note": "destination, date 필수"}

    return await recommend_trip(
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        destination=destination,
        date=date,
        earliest_departure=earliest,
        parking_preference=parking_pref,
        modes=modes,
    )


@router.post("/geocode")
async def geocode(body: dict):
    """주소 → 좌표."""
    address = (body.get("address") or "").strip()
    if not address:
        return {"found": False, "error": "address_required"}
    result = await geocode_address(address)
    if not result:
        return {"found": False, "address": address}
    return {"found": True, **result}


@router.post("/reverse-geocode")
async def reverse_geocode_endpoint(body: dict):
    """좌표 → 주소."""
    try:
        lat = float(body.get("lat"))
        lng = float(body.get("lng"))
    except (TypeError, ValueError):
        return {"found": False, "error": "lat_lng_required"}
    result = await reverse_geocode(lat, lng)
    if not result:
        return {"found": False}
    return {"found": True, **result}


@router.post("/route")
async def get_route(body: dict):
    """
    카카오 내비 API로 실제 경로 좌표 조회.
    body: {
      start_lat, start_lng: 출발지 좌표 (필수),
      visits: [{lat, lng}, ...],
    }
    """
    visits = body.get("visits", [])
    if not visits:
        return {"segments": []}

    try:
        start_lat = float(body.get("start_lat"))
        start_lng = float(body.get("start_lng"))
    except (TypeError, ValueError):
        return {"segments": [], "error": "start_lat, start_lng required"}

    start = (start_lng, start_lat)
    stops = [(v["lng"], v["lat"]) for v in visits]
    segments = await get_multi_stop_route(start, stops)
    return {"segments": segments}
