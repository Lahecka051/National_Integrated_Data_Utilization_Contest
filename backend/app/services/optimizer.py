"""
반차 일정 최적화 엔진 — 실제 API 기반.

데이터 출처:
  - 시설 위치: Kakao Local API (facility_finder)
  - 이동 시간: Kakao Navi API (get_directions)
  - 대기 시간: wait_time_model.py (한국은행/행안부/우정본부 통계 기반 추정)
  - 기상: 기상청 단기예보 API (fetch_weather_forecast)
  - 용무 처리시간: 행정안전부 민원처리시간 통계
"""
import asyncio
from datetime import datetime, timedelta
from itertools import permutations
from typing import Optional

from ..external.kakao_api import get_directions
from ..external.public_api import fetch_weather_forecast, parse_weather_forecast
from ..models.schemas import (
    Errand,
    FacilityType,
    HalfDayType,
    SlotRecommendation,
    FacilityVisit,
    WeatherInfo,
    Facility,
    WeatherCondition,
)
from .facility_finder import resolve_facilities_for_types
from .wait_time_model import calc_civil_wait, calc_bank_wait, calc_post_wait


DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]

# 용무별 평균 처리 시간 (분) — 행정안전부/금융감독원/우정본부 통계 기반
TASK_DURATIONS: dict[str, int] = {
    "전입신고": 10,
    "주민등록등본 발급": 5,
    "인감증명서 발급": 5,
    "여권 신청": 15,
    "통장 개설": 20,
    "카드 발급": 15,
    "대출 상담": 30,
    "환전": 10,
    "등기우편 발송": 10,
    "택배 발송": 5,
}


def get_task_duration(task_name: str) -> int:
    return TASK_DURATIONS.get(task_name, 15)


def get_wait_time(facility_type: FacilityType, weekday: int, hour: int, day_of_month: int) -> int:
    if facility_type == FacilityType.CIVIL_SERVICE:
        return calc_civil_wait(weekday, hour, day_of_month)
    elif facility_type == FacilityType.BANK:
        return calc_bank_wait(weekday, hour, day_of_month)
    elif facility_type == FacilityType.POST_OFFICE:
        return calc_post_wait(weekday, hour)
    return 10


async def _travel_minutes(
    from_lat: float, from_lng: float,
    to_lat: float, to_lng: float,
) -> int:
    """Kakao Navi API로 두 좌표 간 차량 이동 시간(분) 조회.
    실패 시 haversine 기반 보수적 추정.
    """
    result = await get_directions(from_lng, from_lat, to_lng, to_lat)
    if result and result.get("duration"):
        return max(1, int(result["duration"] / 60))
    # 폴백: 직선 거리 × 1.4 (도로율) / 30km·h
    import math
    R = 6371.0
    p1 = math.radians(from_lat)
    p2 = math.radians(to_lat)
    dp = math.radians(to_lat - from_lat)
    dl = math.radians(to_lng - from_lng)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    dist_km = 2 * R * math.asin(math.sqrt(a)) * 1.4
    return max(5, int(dist_km / 30 * 60))


async def _build_travel_matrix(
    origin_lat: float, origin_lng: float,
    facilities: list[dict],
) -> dict[tuple[str, str], int]:
    """
    모든 지점 쌍에 대한 이동시간 매트릭스 사전 계산.
    Key: (from_id, to_id), "start"는 사용자 현재 위치.
    """
    matrix: dict[tuple[str, str], int] = {}
    points: list[tuple[str, float, float]] = [("start", origin_lat, origin_lng)]
    for f in facilities:
        points.append((f["id"], f["lat"], f["lng"]))

    # 병렬 호출
    async def compute(a, b):
        minutes = await _travel_minutes(a[1], a[2], b[1], b[2])
        return (a[0], b[0]), minutes

    tasks = []
    for i, a in enumerate(points):
        for j, b in enumerate(points):
            if i == j:
                matrix[(a[0], b[0])] = 0
                continue
            tasks.append(compute(a, b))

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for item in results:
            if isinstance(item, Exception):
                continue
            key, val = item
            matrix[key] = val

    return matrix


def _group_errands(errands: list[Errand], facility_map: dict) -> list[dict]:
    """동일 시설 용무를 묶어 방문 그룹 생성."""
    groups: dict[str, dict] = {}
    for errand in errands:
        facility = facility_map.get(errand.task_type.value)
        if not facility:
            continue
        fid = facility["id"]
        if fid not in groups:
            groups[fid] = {
                "facility": facility,
                "errands": [],
                "task_names": [],
                "total_duration": 0,
            }
        groups[fid]["errands"].append(errand)
        groups[fid]["task_names"].append(errand.task_name)
        groups[fid]["total_duration"] += get_task_duration(errand.task_name)
    return list(groups.values())


def _find_optimal_order(
    groups: list[dict],
    travel_matrix: dict[tuple[str, str], int],
    weekday: int,
    start_hour: int,
    day_of_month: int,
) -> list[dict]:
    """TSP 전수탐색으로 방문 순서 최적화 (이동 + 대기 + 처리 시간 최소화)."""
    n = len(groups)
    if n == 0:
        return []

    def build_result(order_perm: tuple[int, ...]) -> list[dict]:
        result = []
        cumulative = 0
        for i, idx in enumerate(order_perm):
            g = groups[idx]
            if i == 0:
                from_id = "start"
            else:
                from_id = groups[order_perm[i - 1]]["facility"]["id"]
            travel = travel_matrix.get((from_id, g["facility"]["id"]), 15)
            cumulative += travel
            current_hour = start_hour + cumulative // 60
            wait = get_wait_time(FacilityType(g["facility"]["type"]), weekday, min(current_hour, 17), day_of_month)
            result.append({
                "facility": g["facility"],
                "task_names": g["task_names"],
                "wait": wait,
                "duration": g["total_duration"],
                "travel": travel,
            })
            cumulative += wait + g["total_duration"]
        return result

    if n == 1:
        return build_result((0,))

    best_order = None
    best_cost = float("inf")
    for perm in permutations(range(n)):
        total = 0
        for i, idx in enumerate(perm):
            g = groups[idx]
            if i == 0:
                travel = travel_matrix.get(("start", g["facility"]["id"]), 15)
            else:
                prev = groups[perm[i - 1]]
                travel = travel_matrix.get((prev["facility"]["id"], g["facility"]["id"]), 15)
            total += travel
            current_hour = start_hour + total // 60
            wait = get_wait_time(FacilityType(g["facility"]["type"]), weekday, min(current_hour, 17), day_of_month)
            total += wait + g["total_duration"]
        if total < best_cost:
            best_cost = total
            best_order = perm

    return build_result(best_order or tuple(range(n)))


async def _get_weather(target_date: datetime) -> dict:
    """실제 기상청 API 호출. 실패 시 중립 기본값."""
    try:
        # 울산 남구 격자좌표는 nx=102, ny=83 이지만 이제 기본 지역 없이
        # 사용자 위치로 계산해야 함 (v1은 단순화: 기본 서울 격자 사용)
        nx, ny = 60, 127   # 서울 격자 기본값
        base_date = target_date.strftime("%Y%m%d")
        data = await fetch_weather_forecast(nx, ny, base_date)
        if data:
            parsed = parse_weather_forecast(data)
            if parsed:
                return parsed
    except Exception:
        pass
    # 중립값 (API 실패 시)
    return {
        "condition": "맑음",
        "temperature": 20,
        "rain_probability": 10,
        "penalty_factor": 1.0,
    }


async def simulate_slot(
    errands: list[Errand],
    target_date: datetime,
    half_day: HalfDayType,
    facility_map: dict,
    travel_matrix: dict,
    weather_cache: dict[str, dict],
    custom_start_hour: Optional[int] = None,
    custom_end_hour: Optional[int] = None,
) -> SlotRecommendation:
    """단일 슬롯 시뮬레이션 (travel_matrix와 weather_cache 주입)."""
    weekday = target_date.weekday()
    day_of_month = target_date.day

    if custom_start_hour is not None:
        start_hour = custom_start_hour
    elif half_day == HalfDayType.MORNING:
        start_hour = 9
    elif half_day == HalfDayType.AFTERNOON:
        start_hour = 14
    else:
        start_hour = 9

    # 날씨는 날짜별로 캐시
    date_key = target_date.strftime("%Y-%m-%d")
    if date_key not in weather_cache:
        weather_cache[date_key] = await _get_weather(target_date)
    weather_data = weather_cache[date_key]
    is_rain = weather_data["condition"] == "비"

    groups = _group_errands(errands, facility_map)
    order = _find_optimal_order(groups, travel_matrix, weekday, start_hour, day_of_month)

    visits = []
    current_minutes = start_hour * 60
    total_wait = 0
    total_travel = 0

    for i, item in enumerate(order):
        travel = item["travel"]
        if is_rain:
            travel = int(travel * 1.2)  # 비 오면 이동 20% 가중
        arrival = current_minutes + travel
        total_travel += travel
        total_wait += item["wait"]

        arrival_h, arrival_m = divmod(int(arrival), 60)
        depart = arrival + item["wait"] + item["duration"]
        depart_h, depart_m = divmod(int(depart), 60)

        visits.append(FacilityVisit(
            facility=Facility(**item["facility"]),
            arrival_time=f"{arrival_h:02d}:{arrival_m:02d}",
            wait_time=item["wait"],
            process_time=item["duration"],
            departure_time=f"{depart_h:02d}:{depart_m:02d}",
            travel_time_to_next=order[i + 1]["travel"] if i < len(order) - 1 else None,
            travel_mode="car",
            travel_minutes=travel,
            task_names=item.get("task_names", []),
            bus_info=None,
        ))
        current_minutes = depart

    total_minutes = int(current_minutes - start_hour * 60)

    # 사용자 시간 제약 초과 페널티
    end_limit = custom_end_hour * 60 if custom_end_hour else None
    time_overflow_penalty = 0
    if end_limit and current_minutes > end_limit:
        time_overflow_penalty = int(current_minutes - end_limit) * 10

    weather_penalty = 5 if is_rain else 0

    reasons = []
    if total_wait <= 15:
        reasons.append("대기시간 짧음")
    if weather_data["condition"] == "맑음":
        reasons.append("맑음")
    if weekday in [1, 3]:
        reasons.append(f"{DAY_NAMES[weekday]}요일 한산")
    if day_of_month >= 25 or day_of_month <= 2:
        reasons.append("월말/월초 은행 혼잡")
    if weekday == 4:
        reasons.append("금요일 혼잡")
    if is_rain:
        reasons.append("비 예보")

    reason = " + ".join(reasons) if reasons else "보통"

    weather_info = WeatherInfo(
        condition=WeatherCondition(weather_data["condition"]),
        temperature=weather_data["temperature"],
        rain_probability=weather_data["rain_probability"],
        penalty_factor=weather_data["penalty_factor"],
    )

    return SlotRecommendation(
        rank=0,
        date=target_date.strftime("%Y-%m-%d"),
        day_of_week=f"{DAY_NAMES[weekday]}요일",
        half_day_type=half_day,
        visits=visits,
        weather=weather_info,
        total_wait_time=total_wait,
        total_travel_time=total_travel,
        total_minutes=total_minutes + weather_penalty + time_overflow_penalty,
        reason=reason,
        is_recommended=True,
    )


async def recommend_best_slots(
    errands: list[Errand],
    origin_lat: float,
    origin_lng: float,
    weeks: int = 4,
    time_constraint: Optional[dict] = None,
) -> dict:
    """
    향후 N주간 모든 슬롯 시뮬레이션 → 상위 3개 + 비추천 1개 반환.
    모든 데이터는 실시간 API 기반.
    """
    if not errands:
        return {"recommendations": [], "not_recommended": None}

    # 1. 시설 해석 (Kakao Local)
    unique_types = {e.task_type.value for e in errands}
    facility_map = await resolve_facilities_for_types(unique_types, origin_lat, origin_lng)
    # None 제거
    facility_map = {k: v for k, v in facility_map.items() if v is not None}
    if not facility_map:
        return {"recommendations": [], "not_recommended": None}

    # 2. 이동 매트릭스 (Kakao Navi)
    travel_matrix = await _build_travel_matrix(origin_lat, origin_lng, list(facility_map.values()))

    # 3. 슬롯 시뮬레이션
    today = datetime.now()
    slots: list[SlotRecommendation] = []
    weather_cache: dict[str, dict] = {}

    custom_start = None
    custom_end = None
    min_date = None
    if time_constraint:
        if time_constraint.get("start_time") and time_constraint.get("end_time"):
            try:
                custom_start = int(time_constraint["start_time"].split(":")[0])
                custom_end = int(time_constraint["end_time"].split(":")[0])
            except (ValueError, AttributeError):
                pass
        if time_constraint.get("start_date"):
            try:
                min_date = datetime.strptime(time_constraint["start_date"], "%Y-%m-%d")
            except ValueError:
                pass

    for day_offset in range(1, weeks * 7 + 1):
        target = today + timedelta(days=day_offset)
        if target.weekday() >= 5:
            continue
        if min_date and target < min_date:
            continue

        if custom_start is not None and custom_end is not None:
            half_day = HalfDayType.MORNING if custom_start < 12 else HalfDayType.AFTERNOON
            slot = await simulate_slot(errands, target, half_day, facility_map, travel_matrix, weather_cache, custom_start, custom_end)
            slots.append(slot)
        else:
            for half_day in [HalfDayType.MORNING, HalfDayType.AFTERNOON, HalfDayType.FULL_DAY]:
                slot = await simulate_slot(errands, target, half_day, facility_map, travel_matrix, weather_cache)
                slots.append(slot)

    slots.sort(key=lambda s: s.total_minutes)

    recommendations = []
    for i, slot in enumerate(slots[:3]):
        slot.rank = i + 1
        slot.is_recommended = True
        recommendations.append(slot)

    worst = slots[-1] if slots else None
    if worst:
        worst.rank = len(slots)
        worst.is_recommended = False

    return {
        "recommendations": recommendations,
        "not_recommended": worst,
    }
