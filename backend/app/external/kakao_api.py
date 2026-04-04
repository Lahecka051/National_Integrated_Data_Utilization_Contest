"""
카카오 REST API 클라이언트
- Local API: 장소 검색 (은행 등)
- Navi API: 길찾기 (경로 좌표)
"""
import os
import httpx

KAKAO_REST_KEY = os.getenv("KAKAO_REST_API_KEY", "04a02b133b0d9ce03375340091c37c97")


def _headers() -> dict:
    return {"Authorization": f"KakaoAK {KAKAO_REST_KEY}"}


async def search_nearby_places(
    query: str,
    lng: float,
    lat: float,
    radius: int = 2000,
    category_group_code: str = "",
    size: int = 10,
) -> list[dict]:
    """카카오 로컬 API - 키워드 장소 검색"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            params = {
                "query": query,
                "x": str(lng),
                "y": str(lat),
                "radius": str(radius),
                "size": str(size),
                "sort": "distance",
            }
            if category_group_code:
                params["category_group_code"] = category_group_code

            resp = await client.get(
                "https://dapi.kakao.com/v2/local/search/keyword.json",
                params=params,
                headers=_headers(),
            )
            if resp.status_code == 200:
                data = resp.json()
                return [
                    {
                        "id": doc.get("id", ""),
                        "name": doc.get("place_name", ""),
                        "address": doc.get("address_name", ""),
                        "road_address": doc.get("road_address_name", ""),
                        "lat": float(doc.get("y", "0")),
                        "lng": float(doc.get("x", "0")),
                        "phone": doc.get("phone", ""),
                        "distance": int(doc.get("distance", "0")),
                        "category": doc.get("category_name", ""),
                    }
                    for doc in data.get("documents", [])
                ]
    except Exception:
        pass
    return []


async def search_nearby_banks(lng: float, lat: float, radius: int = 3000) -> list[dict]:
    """근처 은행 검색 (카테고리: BK9, ATM 제외)"""
    results = await search_nearby_places("은행", lng, lat, radius, category_group_code="BK9", size=15)
    # ATM, 365코너 등 무인 시설 제외 — 실제 영업점만
    exclude_keywords = ["ATM", "365", "자동화", "무인"]
    filtered = [b for b in results if not any(kw in b["name"] for kw in exclude_keywords)]
    return filtered if filtered else results[:5]


async def search_nearby_post_offices(lng: float, lat: float, radius: int = 3000) -> list[dict]:
    """근처 우체국 검색"""
    return await search_nearby_places("우체국", lng, lat, radius, size=10)


async def get_directions(
    origin_lng: float, origin_lat: float,
    dest_lng: float, dest_lat: float,
    waypoints: list[tuple[float, float]] | None = None,
) -> dict | None:
    """
    카카오 내비 API - 경로 탐색
    반환: distance(m), duration(s), route_coords(경로 좌표 리스트)
    """
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "origin": f"{origin_lng},{origin_lat}",
                "destination": f"{dest_lng},{dest_lat}",
                "priority": "RECOMMEND",
            }
            if waypoints:
                wp_str = "|".join(f"{lng},{lat}" for lng, lat in waypoints)
                params["waypoints"] = wp_str

            resp = await client.get(
                "https://apis-navi.kakaomobility.com/v1/directions",
                params=params,
                headers=_headers(),
            )
            if resp.status_code == 200:
                data = resp.json()
                routes = data.get("routes", [])
                if not routes:
                    return None

                route = routes[0]
                summary = route.get("summary", {})

                # 경로 좌표 추출
                coords = []
                for section in route.get("sections", []):
                    for road in section.get("roads", []):
                        vertexes = road.get("vertexes", [])
                        for i in range(0, len(vertexes), 2):
                            if i + 1 < len(vertexes):
                                coords.append({
                                    "lng": vertexes[i],
                                    "lat": vertexes[i + 1],
                                })

                return {
                    "distance": summary.get("distance", 0),  # meters
                    "duration": summary.get("duration", 0),   # seconds
                    "route_coords": coords,
                }
    except Exception:
        pass
    return None


async def get_multi_stop_route(
    start: tuple[float, float],
    stops: list[tuple[float, float]],
) -> list[dict]:
    """
    여러 경유지 경로를 구간별로 조회
    start: (lng, lat), stops: [(lng, lat), ...]
    반환: 구간별 [{distance, duration, route_coords}, ...]
    """
    segments = []
    current = start
    for stop in stops:
        result = await get_directions(current[0], current[1], stop[0], stop[1])
        if result:
            segments.append(result)
        else:
            segments.append({
                "distance": 0,
                "duration": 0,
                "route_coords": [
                    {"lng": current[0], "lat": current[1]},
                    {"lng": stop[0], "lat": stop[1]},
                ],
            })
        current = stop
    return segments
