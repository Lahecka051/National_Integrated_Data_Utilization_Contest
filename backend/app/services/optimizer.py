"""
핵심 최적화 엔진
- 같은 시설 용무 합치기
- 향후 한 달 슬롯 시뮬레이션
- 슬롯별 총 비용 계산
- TSP 기반 방문 순서 최적화
"""
from datetime import datetime, timedelta
from itertools import permutations
from ..mock.data import (
    FACILITIES,
    get_civil_wait,
    get_bank_wait,
    get_post_wait,
    get_travel_time,
    get_travel_mode,
    get_bus_info,
    get_weather_forecast,
    get_task_duration,
)
from ..models.schemas import (
    Errand,
    FacilityType,
    HalfDayType,
    SlotRecommendation,
    FacilityVisit,
    BusInfo,
    BusAlternative,
    WeatherInfo,
    Facility,
    WeatherCondition,
)

DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]


def get_wait_time(facility_type: FacilityType, weekday: int, hour: int, day_of_month: int) -> int:
    if facility_type == FacilityType.CIVIL_SERVICE:
        return get_civil_wait(weekday, hour)
    elif facility_type == FacilityType.BANK:
        return get_bank_wait(weekday, hour, day_of_month)
    elif facility_type == FacilityType.POST_OFFICE:
        return get_post_wait(weekday, hour)
    return 10


def resolve_facility(errand: Errand) -> dict:
    """용무에 맞는 시설 찾기"""
    if errand.facility_id and errand.facility_id in FACILITIES:
        return FACILITIES[errand.facility_id]
    for fid, f in FACILITIES.items():
        if f["type"] == errand.task_type.value:
            return f
    return list(FACILITIES.values())[0]


def group_errands_by_facility(errands: list[Errand]) -> list[dict]:
    """같은 시설의 용무를 하나로 합침"""
    groups: dict[str, dict] = {}
    for errand in errands:
        facility = resolve_facility(errand)
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


def find_optimal_order(errands: list[Errand], weekday: int, start_hour: int, day_of_month: int, is_rain: bool) -> list[dict]:
    """
    같은 시설 용무를 합친 후 TSP 전수탐색
    """
    groups = group_errands_by_facility(errands)
    n = len(groups)
    if n == 0:
        return []
    if n == 1:
        g = groups[0]
        mode = get_travel_mode("start", g["facility"]["id"])
        wait = get_wait_time(FacilityType(g["facility"]["type"]), weekday, start_hour, day_of_month)
        bus = get_bus_info("start", g["facility"]["id"]) if mode == "bus" else None
        return [{
            "facility": g["facility"],
            "task_names": g["task_names"],
            "wait": wait,
            "duration": g["total_duration"],
            "travel": get_travel_time("start", g["facility"]["id"], rain=is_rain),
            "mode": mode,
            "bus_info": bus,
        }]

    best_order = None
    best_cost = float("inf")

    for perm in permutations(range(n)):
        total = 0
        current_hour = start_hour
        for i, idx in enumerate(perm):
            g = groups[idx]
            if i == 0:
                travel = get_travel_time("start", g["facility"]["id"], rain=is_rain)
            else:
                prev = groups[perm[i - 1]]
                travel = get_travel_time(prev["facility"]["id"], g["facility"]["id"], rain=is_rain)
            total += travel
            current_hour = start_hour + total // 60
            wait = get_wait_time(FacilityType(g["facility"]["type"]), weekday, min(current_hour, 17), day_of_month)
            total += wait + g["total_duration"]

        if total < best_cost:
            best_cost = total
            best_order = perm

    result = []
    cumulative = 0
    for i, idx in enumerate(best_order):
        g = groups[idx]
        if i == 0:
            from_id = "start"
        else:
            from_id = groups[best_order[i - 1]]["facility"]["id"]
        travel = get_travel_time(from_id, g["facility"]["id"], rain=is_rain)
        mode = get_travel_mode(from_id, g["facility"]["id"])
        cumulative += travel
        current_hour = start_hour + cumulative // 60
        wait = get_wait_time(FacilityType(g["facility"]["type"]), weekday, min(current_hour, 17), day_of_month)
        bus = get_bus_info(from_id, g["facility"]["id"]) if mode == "bus" else None
        result.append({
            "facility": g["facility"],
            "task_names": g["task_names"],
            "wait": wait,
            "duration": g["total_duration"],
            "travel": travel,
            "mode": mode,
            "bus_info": bus,
        })
        cumulative += wait + g["total_duration"]

    return result


def simulate_slot(errands: list[Errand], target_date: datetime, half_day: HalfDayType) -> SlotRecommendation:
    """단일 슬롯 시뮬레이션"""
    weekday = target_date.weekday()
    day_of_month = target_date.day
    if half_day == HalfDayType.MORNING:
        start_hour = 9
    elif half_day == HalfDayType.AFTERNOON:
        start_hour = 14
    else:
        start_hour = 9

    weather_data = get_weather_forecast(target_date)
    is_rain = weather_data["condition"] == "비"

    order = find_optimal_order(errands, weekday, start_hour, day_of_month, is_rain)

    visits = []
    current_minutes = start_hour * 60
    total_wait = 0
    total_travel = 0

    for i, item in enumerate(order):
        arrival = current_minutes + item["travel"]
        total_travel += item["travel"]
        total_wait += item["wait"]

        arrival_h, arrival_m = divmod(int(arrival), 60)
        depart = arrival + item["wait"] + item["duration"]
        depart_h, depart_m = divmod(int(depart), 60)

        raw_bus = item.get("bus_info")
        bus_info = None
        if raw_bus:
            bus_info = BusInfo(
                stop_name=raw_bus["stop_name"],
                bus_no=raw_bus["bus_no"],
                ride_minutes=raw_bus["ride_minutes"],
                walk_to_stop_minutes=raw_bus["walk_to_stop_minutes"],
                alternatives=[BusAlternative(**a) for a in raw_bus.get("alternatives", [])],
            )

        visits.append(FacilityVisit(
            facility=Facility(**item["facility"]),
            arrival_time=f"{arrival_h:02d}:{arrival_m:02d}",
            wait_time=item["wait"],
            process_time=item["duration"],
            departure_time=f"{depart_h:02d}:{depart_m:02d}",
            travel_time_to_next=order[i + 1]["travel"] if i < len(order) - 1 else None,
            travel_mode=item.get("mode", "walk"),
            travel_minutes=item["travel"],
            task_names=item.get("task_names", []),
            bus_info=bus_info,
        ))
        current_minutes = depart

    total_minutes = int(current_minutes - start_hour * 60)

    weather_penalty = 0
    if is_rain:
        weather_penalty = 5

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
        total_minutes=total_minutes + weather_penalty,
        reason=reason,
        is_recommended=True,
    )


def recommend_best_slots(errands: list[Errand], weeks: int = 4) -> dict:
    """향후 N주간 모든 슬롯을 시뮬레이션하여 최적 3개 + 비추천 1개 반환"""
    today = datetime.now()
    slots = []

    for day_offset in range(1, weeks * 7 + 1):
        target = today + timedelta(days=day_offset)
        if target.weekday() >= 5:
            continue
        for half_day in [HalfDayType.MORNING, HalfDayType.AFTERNOON, HalfDayType.FULL_DAY]:
            slot = simulate_slot(errands, target, half_day)
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
