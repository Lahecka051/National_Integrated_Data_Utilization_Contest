"""
용무 시설 탐색 서비스 — Kakao Local API 기반.
사용자 위치 주변에서 가장 가까운 민원실/은행/우체국을 실시간 조회.
"""
from typing import Optional
from ..external.kakao_api import search_nearby_places, search_nearby_banks, search_nearby_post_offices


# 시설 기본 운영시간 (한국 표준 업무 시간)
DEFAULT_HOURS: dict[str, tuple[str, str]] = {
    "민원실": ("09:00", "18:00"),
    "은행": ("09:00", "16:00"),
    "우체국": ("09:00", "18:00"),
}


async def find_nearest_facility(
    task_type: str,
    origin_lat: float,
    origin_lng: float,
    radius: int = 5000,
) -> Optional[dict]:
    """
    시설 타입에 맞는 가장 가까운 실제 시설을 Kakao Local API로 검색.

    Returns: Facility dict (id/name/type/address/lat/lng/open_time/close_time) or None
    """
    results: list[dict] = []

    if task_type == "은행":
        results = await search_nearby_banks(lng=origin_lng, lat=origin_lat, radius=radius)
    elif task_type == "우체국":
        results = await search_nearby_post_offices(lng=origin_lng, lat=origin_lat, radius=radius)
    elif task_type == "민원실":
        # 주민센터/구청/동사무소 키워드로 검색
        queries = ["주민센터", "행정복지센터", "구청 민원실", "동사무소"]
        seen_ids: set[str] = set()
        combined: list[dict] = []
        for q in queries:
            kakao = await search_nearby_places(
                query=q, lng=origin_lng, lat=origin_lat, radius=radius, size=10,
            )
            for k in kakao:
                if not k.get("id") or k["id"] in seen_ids:
                    continue
                name = k.get("name", "")
                # 공공기관 관련 결과만 남김
                category = k.get("category", "")
                if not any(kw in (name + category) for kw in ["주민센터", "행정복지", "구청", "동사무소", "시청", "군청", "면사무소", "읍사무소", "민원"]):
                    continue
                seen_ids.add(k["id"])
                combined.append(k)
        results = combined
    else:
        return None

    if not results:
        return None

    # 거리순 정렬 (Kakao가 이미 정렬해서 주는 경우가 많지만 안전하게)
    results.sort(key=lambda r: r.get("distance", 0))
    best = results[0]

    open_time, close_time = DEFAULT_HOURS.get(task_type, ("09:00", "18:00"))

    return {
        "id": str(best.get("id") or f"{task_type}_{best['lat']}_{best['lng']}"),
        "name": best.get("name", task_type),
        "type": task_type,
        "address": best.get("address") or best.get("road_address") or "",
        "lat": float(best["lat"]),
        "lng": float(best["lng"]),
        "open_time": open_time,
        "close_time": close_time,
    }


async def resolve_facilities_for_types(
    task_types: set[str],
    origin_lat: float,
    origin_lng: float,
) -> dict[str, Optional[dict]]:
    """한 요청에서 필요한 모든 task_type의 시설을 한 번에 해석."""
    result: dict[str, Optional[dict]] = {}
    for t in task_types:
        result[t] = await find_nearest_facility(t, origin_lat, origin_lng)
    return result
