"""
출장 여행 플랜 추천 서비스.

흐름:
  1) 목적지 도시명 → Kakao geocode → 좌표
  2) 출발 후보 허브 수집: 사용자 위치 근처 기차역 Top3 + 터미널 Top2
  3) 도착 후보 허브 수집: 목적지 근처 기차역 Top2 + 터미널 Top1 (주요 역 우선)
  4) 각 (출발, 도착, 교통수단) 조합에 대해:
       - TAGO 실시간 시간표 시도 → 성공 시 실제 편 사용
       - 실패 시 거리 기반 추정
  5) 주차장 매칭:
       - NEAR_HUB: 출발 허브 반경 700m
       - NEAR_HOME: 사용자 위치 반경 1km
     가용/요금 순으로 Top 1
  6) 각 플랜 점수화 후 상위 5개 반환
"""
import math
from datetime import datetime, timedelta
from typing import Optional

from ..external.kakao_api import geocode_address, reverse_geocode
from ..external.rail_api import fetch_nearby_train_stations, fetch_train_schedules
from ..external.bus_terminal_api import (
    fetch_nearby_bus_terminals,
    fetch_expbus_schedules,
    fetch_expbus_terminals,
)
from ..external.parking_api import fetch_nearby_parking
from .city_code import suggest_main_station


# 거리 기반 추정 (TAGO 시간표 없을 때 폴백)
TRAIN_AVG_KMH = 150       # KTX/SRT 기준
BUS_AVG_KMH = 85          # 고속버스
TRAIN_COST_PER_KM = 105   # KTX 평균 원/km
BUS_COST_PER_KM = 62      # 고속버스 평균
WALK_SPEED_M_PER_MIN = 70  # 도보 속도


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _estimate_travel(distance_km: float, mode: str) -> tuple[int, int, str]:
    """거리 기반 소요시간·요금 추정.
    Returns: (duration_min, fare_won, grade)
    """
    if mode == "train":
        speed = TRAIN_AVG_KMH if distance_km >= 50 else 80
        duration = max(25, int(distance_km / speed * 60))
        fare = int(distance_km * TRAIN_COST_PER_KM / 100) * 100
        grade = "KTX급" if distance_km >= 100 else "ITX/무궁화"
    else:  # expbus
        duration = max(30, int(distance_km / BUS_AVG_KMH * 60))
        fare = int(distance_km * BUS_COST_PER_KM / 100) * 100
        grade = "고속버스 우등" if distance_km >= 100 else "고속버스 일반"
    return duration, fare, grade


def _parse_tago_time(value: str) -> Optional[str]:
    """TAGO의 depPlandTime (YYYYMMDDHHMM) → 'HH:MM'."""
    if not value:
        return None
    s = str(value)
    if len(s) >= 12:
        return f"{s[8:10]}:{s[10:12]}"
    return None


def _add_minutes(hhmm: str, minutes: int) -> str:
    try:
        h, m = map(int, hhmm.split(":"))
        t = datetime(2000, 1, 1, h, m) + timedelta(minutes=minutes)
        return t.strftime("%H:%M")
    except Exception:
        return hhmm


async def _find_hubs_near(lat: float, lng: float, want_train: bool, want_bus: bool) -> dict:
    """위치 주변 후보 허브 수집."""
    result = {"trains": [], "buses": []}
    if want_train:
        r = await fetch_nearby_train_stations(lat, lng, radius=15000)
        result["trains"] = r.get("hubs", [])[:3]
    if want_bus:
        r = await fetch_nearby_bus_terminals(lat, lng, radius=15000)
        result["buses"] = r.get("hubs", [])[:2]
    return result


async def _resolve_destination_hubs(dest_name: str, dest_lat: float, dest_lng: float,
                                     want_train: bool, want_bus: bool) -> dict:
    """목적지 주변 대표 허브 조회 (각 교통수단당 1개의 메인 허브만)."""
    result = {"trains": [], "buses": []}

    if want_train:
        # 주요 도시는 대표 역 이름으로 우선 찾기
        suggested = suggest_main_station(dest_name)
        if suggested:
            geo = await geocode_address(suggested)
            if geo:
                r = await fetch_nearby_train_stations(geo["lat"], geo["lng"], radius=5000)
                hubs = r.get("hubs", [])
                # suggested 이름과 정확히 매칭되거나 포함되는 걸 최우선
                for h in hubs:
                    if suggested == h["name"] or suggested in h["name"]:
                        result["trains"] = [h]
                        break
                if not result["trains"] and hubs:
                    result["trains"] = [hubs[0]]
        if not result["trains"]:
            r = await fetch_nearby_train_stations(dest_lat, dest_lng, radius=15000)
            hubs = r.get("hubs", [])
            if hubs:
                result["trains"] = [hubs[0]]

    if want_bus:
        r = await fetch_nearby_bus_terminals(dest_lat, dest_lng, radius=15000)
        buses = r.get("hubs", [])
        if buses:
            result["buses"] = [buses[0]]  # 도착지 터미널도 가장 가까운 1개만

    return result


async def _pick_parking(hub_lat: float, hub_lng: float, radius: int = 700) -> Optional[dict]:
    """허브 주변 최적 주차장 1개 선택."""
    res = await fetch_nearby_parking(hub_lat, hub_lng, radius=radius)
    parkings = res.get("parkings", [])
    if not parkings:
        return None

    # 가용 상태 가산점 + 거리 페널티
    def score(p):
        status_score = {"여유": 40, "보통": 25, "정보없음": 15, "혼잡": 5, "만차": -20}
        return status_score.get(p["status"], 10) - p["distance"] / 50

    parkings.sort(key=score, reverse=True)
    return parkings[0]


def _walk_minutes(distance_m: int) -> int:
    return max(1, int(round(distance_m / WALK_SPEED_M_PER_MIN)))


def _build_schedule_from_tago(item: dict, mode: str) -> Optional[dict]:
    """TAGO 응답 item을 TripScheduleInfo dict로 변환."""
    try:
        dep_raw = str(item.get("depPlandTime", ""))
        arr_raw = str(item.get("arrPlandTime", ""))
        dep_hhmm = _parse_tago_time(dep_raw)
        arr_hhmm = _parse_tago_time(arr_raw)
        if not dep_hhmm or not arr_hhmm:
            return None

        # 소요시간 계산
        dep_dt = datetime.strptime(dep_raw[:12], "%Y%m%d%H%M")
        arr_dt = datetime.strptime(arr_raw[:12], "%Y%m%d%H%M")
        duration = int((arr_dt - dep_dt).total_seconds() / 60)
        if duration <= 0:
            return None

        fare = int(item.get("adultCharge") or item.get("charge") or 0)
        if mode == "train":
            vehicle = f"{item.get('trainGradeName', '열차')} {item.get('trainNo', '')}".strip()
            grade = item.get("trainGradeName", "")
        else:
            vehicle = f"{item.get('gradeNm', '고속버스')}".strip()
            grade = item.get("gradeNm", "")
        return {
            "mode": mode,
            "vehicle_name": vehicle or ("열차편" if mode == "train" else "버스편"),
            "dep_date": dep_dt.strftime("%Y-%m-%d"),
            "dep_time": dep_hhmm,
            "arr_date": arr_dt.strftime("%Y-%m-%d"),
            "arr_time": arr_hhmm,
            "duration_min": duration,
            "fare_won": fare,
            "is_estimated": False,
            "grade": grade,
            "note": "실시간 시간표",
        }
    except Exception:
        return None


async def _make_schedule(
    origin_hub: dict,
    dest_hub: dict,
    mode: str,
    date_str: str,
    earliest_hhmm: str,
) -> dict:
    """허브 쌍 + 교통수단 → 스케줄 1건 (실시간 또는 추정)."""
    # 실시간 시도 (현재는 ID 매칭이 없으므로 대부분 실패 — 안전 폴백)
    tago_items: list[dict] = []
    try:
        dep_plandtime = date_str.replace("-", "")  # YYYYMMDD
        if mode == "train":
            tago_items = await fetch_train_schedules(
                dep_place_id=str(origin_hub.get("tago_id", "")),
                arr_place_id=str(dest_hub.get("tago_id", "")),
                dep_plandtime=dep_plandtime,
            )
        else:
            tago_items = await fetch_expbus_schedules(
                dep_terminal_id=str(origin_hub.get("tago_id", "")),
                arr_terminal_id=str(dest_hub.get("tago_id", "")),
                dep_plandtime=dep_plandtime,
            )
    except Exception:
        tago_items = []

    if tago_items:
        # earliest_hhmm 이후 출발편 중 가장 이른 것
        candidates = []
        for it in tago_items:
            s = _build_schedule_from_tago(it, mode)
            if s and s["dep_time"] >= earliest_hhmm:
                candidates.append(s)
        candidates.sort(key=lambda s: s["dep_time"])
        if candidates:
            return candidates[0]

    # 추정
    dist = _haversine_km(origin_hub["lat"], origin_hub["lng"], dest_hub["lat"], dest_hub["lng"])
    duration, fare, grade = _estimate_travel(dist, mode)
    vehicle = f"{grade} (예상)"

    # 도착 날짜 계산 (자정 넘어가면 +1일)
    try:
        dep_dt = datetime.strptime(f"{date_str} {earliest_hhmm}", "%Y-%m-%d %H:%M")
        arr_dt = dep_dt + timedelta(minutes=duration)
        dep_date_str = dep_dt.strftime("%Y-%m-%d")
        arr_date_str = arr_dt.strftime("%Y-%m-%d")
        arr_hhmm_str = arr_dt.strftime("%H:%M")
    except Exception:
        dep_date_str = date_str
        arr_date_str = date_str
        arr_hhmm_str = _add_minutes(earliest_hhmm, duration)

    return {
        "mode": mode,
        "vehicle_name": vehicle,
        "dep_date": dep_date_str,
        "dep_time": earliest_hhmm,
        "arr_date": arr_date_str,
        "arr_time": arr_hhmm_str,
        "duration_min": duration,
        "fare_won": fare,
        "is_estimated": True,
        "grade": grade,
        "note": f"{dist:.0f}km 거리 기반 추정",
    }


def _hub_to_dict(h: dict) -> dict:
    return {
        "id": h["id"],
        "name": h["name"],
        "type": h.get("type", ""),
        "address": h.get("address", ""),
        "lat": h["lat"],
        "lng": h["lng"],
    }


def _parking_summary(p: dict, hub_lat: float, hub_lng: float) -> dict:
    dist_m = int(_haversine_km(p["lat"], p["lng"], hub_lat, hub_lng) * 1000)
    return {
        "id": p["id"],
        "name": p["name"],
        "address": p.get("address", ""),
        "lat": p["lat"],
        "lng": p["lng"],
        "distance_to_hub": dist_m,
        "walk_minutes": _walk_minutes(dist_m),
        "status": p["status"],
        "available_slots": p.get("available_slots"),
        "total_slots": p.get("total_slots"),
        "fee_info": p.get("fee_info", ""),
    }


def _score_plan(plan: dict, origin_distance_m: int = 0) -> int:
    """0~100 스코어 (높을수록 좋음)."""
    duration = plan["total_duration_min"]
    # 기본: 240분 = 0점, 60분 = 100점 선형
    base = max(0, min(100, int(100 - (duration - 60) * (100 / 180))))

    # 주차장 가산점
    parking = plan.get("parking")
    if parking:
        status_bonus = {"여유": 10, "보통": 5, "정보없음": 2, "혼잡": -5, "만차": -15}
        base += status_bonus.get(parking["status"], 0)
        # 허브까지 도보 5분 이내 보너스
        if parking["walk_minutes"] <= 5:
            base += 5

    # 실시간 데이터 보너스
    if not plan["schedule"]["is_estimated"]:
        base += 5

    # 사용자 현재 위치와 출발 허브가 가까울수록 가산점 (2km=+10, 10km=0)
    if origin_distance_m <= 2000:
        base += 10
    elif origin_distance_m <= 5000:
        base += 5
    elif origin_distance_m > 10000:
        base -= 5

    return max(0, min(100, base))


def _build_reasons(plan: dict, is_fastest: bool, is_cheapest: bool) -> list[str]:
    reasons = []
    if is_fastest:
        reasons.append("최단 소요시간")
    if is_cheapest:
        reasons.append("최저 요금")
    parking = plan.get("parking")
    if parking:
        if parking["status"] == "여유":
            reasons.append("주차 여유")
        if parking["walk_minutes"] <= 5:
            reasons.append("역과 가까움")
    if not plan["schedule"]["is_estimated"]:
        reasons.append("실시간 시간표")
    return reasons or ["표준 추천"]


async def recommend_trip(
    origin_lat: float,
    origin_lng: float,
    destination: str,
    date: str,
    earliest_departure: str = "08:00",
    parking_preference: str = "near_hub",
    modes: Optional[list[str]] = None,
) -> dict:
    """
    출장 플랜 추천.
    Returns dict with keys: plans, destination_resolved, destination_lat,
           destination_lng, origin_address, has_realtime_schedule, note
    """
    modes = modes or ["train", "expbus"]
    want_train = "train" in modes
    want_bus = "expbus" in modes

    # 1. 목적지 해석
    geo = await geocode_address(destination)
    if not geo:
        # 혹시 "부산역" 같은 키워드로 재시도
        geo = await geocode_address(f"{destination}역")
    if not geo:
        return {
            "plans": [],
            "destination_resolved": "",
            "destination_lat": 0.0,
            "destination_lng": 0.0,
            "origin_address": "",
            "has_realtime_schedule": False,
            "note": f"목적지 '{destination}'을(를) 찾을 수 없습니다.",
        }
    dest_lat, dest_lng = geo["lat"], geo["lng"]
    dest_resolved = geo.get("road_address") or geo.get("address") or destination

    # 2. 출발지 주소 해석 (설명용)
    origin_rev = await reverse_geocode(origin_lat, origin_lng)
    origin_address = ""
    if origin_rev:
        origin_address = origin_rev.get("road_address") or origin_rev.get("address", "")

    # 3. 출발/도착 허브 수집
    orig_hubs = await _find_hubs_near(origin_lat, origin_lng, want_train, want_bus)
    dest_hubs = await _resolve_destination_hubs(destination, dest_lat, dest_lng, want_train, want_bus)

    if not orig_hubs["trains"] and not orig_hubs["buses"]:
        return {
            "plans": [],
            "destination_resolved": dest_resolved,
            "destination_lat": dest_lat,
            "destination_lng": dest_lng,
            "origin_address": origin_address,
            "has_realtime_schedule": False,
            "note": "출발지 근처에서 기차역/터미널을 찾지 못했습니다. 위치를 변경해보세요.",
        }
    if not dest_hubs["trains"] and not dest_hubs["buses"]:
        return {
            "plans": [],
            "destination_resolved": dest_resolved,
            "destination_lat": dest_lat,
            "destination_lng": dest_lng,
            "origin_address": origin_address,
            "has_realtime_schedule": False,
            "note": f"'{destination}' 근처에서 도착 가능한 기차역/터미널을 찾지 못했습니다.",
        }

    # 4. (origin, dest, mode) 조합 생성
    pairs: list[tuple[dict, dict, str]] = []
    if want_train:
        for o in orig_hubs["trains"]:
            for d in dest_hubs["trains"]:
                if o["id"] != d["id"]:
                    pairs.append((o, d, "train"))
    if want_bus:
        for o in orig_hubs["buses"]:
            for d in dest_hubs["buses"]:
                if o["id"] != d["id"]:
                    pairs.append((o, d, "expbus"))

    if not pairs:
        return {
            "plans": [],
            "destination_resolved": dest_resolved,
            "destination_lat": dest_lat,
            "destination_lng": dest_lng,
            "origin_address": origin_address,
            "has_realtime_schedule": False,
            "note": "유효한 출발→도착 허브 조합을 구성할 수 없습니다.",
        }

    # 5. 각 조합의 스케줄 + 주차장 생성
    has_realtime = False
    draft_plans: list[dict] = []

    for origin_hub, dest_hub, mode in pairs:
        schedule = await _make_schedule(origin_hub, dest_hub, mode, date, earliest_departure)
        if not schedule["is_estimated"]:
            has_realtime = True

        # 주차장 위치 결정
        if parking_preference == "near_hub":
            parking_raw = await _pick_parking(origin_hub["lat"], origin_hub["lng"], radius=700)
            parking = _parking_summary(parking_raw, origin_hub["lat"], origin_hub["lng"]) if parking_raw else None
            walk_min = parking["walk_minutes"] if parking else 0
        else:  # near_home
            parking_raw = await _pick_parking(origin_lat, origin_lng, radius=1500)
            if parking_raw:
                parking = _parking_summary(parking_raw, origin_hub["lat"], origin_hub["lng"])
                # 거리가 멀면 택시/버스 시간 대체 (여기선 단순화: 현재→허브 거리 × 4 분)
                hub_dist_km = _haversine_km(origin_lat, origin_lng, origin_hub["lat"], origin_hub["lng"])
                walk_min = int(hub_dist_km * 4)
            else:
                parking = None
                hub_dist_km = _haversine_km(origin_lat, origin_lng, origin_hub["lat"], origin_hub["lng"])
                walk_min = int(hub_dist_km * 4)

        # 총 소요시간 = 주차장→허브 + 탑승시간 + 환승여유 10분
        total = walk_min + schedule["duration_min"] + 10
        fare_total = schedule["fare_won"]

        origin_dist_m = int(_haversine_km(origin_lat, origin_lng, origin_hub["lat"], origin_hub["lng"]) * 1000)
        draft_plans.append({
            "origin_hub": _hub_to_dict(origin_hub),
            "destination_hub": _hub_to_dict(dest_hub),
            "schedule": schedule,
            "parking": parking,
            "parking_preference": parking_preference,
            "total_duration_min": total,
            "total_fare_won": fare_total,
            "score": 0,
            "reasons": [],
            "_origin_distance_m": origin_dist_m,
        })

    # 6. 순위 매기기
    if not draft_plans:
        return {
            "plans": [],
            "destination_resolved": dest_resolved,
            "destination_lat": dest_lat,
            "destination_lng": dest_lng,
            "origin_address": origin_address,
            "has_realtime_schedule": has_realtime,
            "note": "플랜을 생성할 수 없습니다.",
        }

    fastest_dur = min(p["total_duration_min"] for p in draft_plans)
    cheapest_fare = min(p["total_fare_won"] for p in draft_plans)

    for p in draft_plans:
        p["score"] = _score_plan(p, p.pop("_origin_distance_m", 0))
        p["reasons"] = _build_reasons(
            p,
            is_fastest=(p["total_duration_min"] == fastest_dur),
            is_cheapest=(p["total_fare_won"] == cheapest_fare),
        )

    draft_plans.sort(key=lambda p: (-p["score"], p["total_duration_min"]))
    top = draft_plans[:5]
    for i, p in enumerate(top):
        p["rank"] = i + 1

    return {
        "plans": top,
        "destination_resolved": dest_resolved,
        "destination_lat": dest_lat,
        "destination_lng": dest_lng,
        "origin_address": origin_address,
        "has_realtime_schedule": has_realtime,
        "note": "실시간 TAGO 시간표" if has_realtime else "거리 기반 예상 시간·요금 (TAGO 데이터 연동 후 자동 전환)",
    }
