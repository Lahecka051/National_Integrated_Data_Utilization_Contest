"""
철도역 API 클라이언트

데이터 소스:
  1) Kakao Local — "기차역|KTX|SRT" 키워드 검색 (항상 사용, 위치 기반)
  2) 국토교통부 TAGO 열차정보서비스 — 역코드 enrichment
     Base: http://apis.data.go.kr/1613000/TrainInfoService/
     - getCityCodeList: 도시 코드 목록
     - getCtyAcctoTrainSttnList: 도시별 기차역 목록
"""
import os
import httpx
from typing import Optional

from .kakao_api import search_nearby_places

TAGO_TRAIN_BASE = "http://apis.data.go.kr/1613000/TrainInfoService"


def _data_go_kr_key() -> str:
    return os.getenv("DATA_GO_KR_API_KEY", "") or os.getenv("DATA_GO_KR_API_KEY_ENCODING", "")


async def _fetch_tago_stations_by_city(city_code: str) -> list[dict]:
    """TAGO 도시별 기차역 목록."""
    key = _data_go_kr_key()
    if not key:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "serviceKey": key,
                "pageNo": "1",
                "numOfRows": "200",
                "_type": "json",
                "cityCode": city_code,
            }
            url = f"{TAGO_TRAIN_BASE}/getCtyAcctoTrainSttnList"
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
            items = data.get("response", {}).get("body", {}).get("items", {})
            if isinstance(items, dict):
                items = items.get("item", [])
            if isinstance(items, dict):
                items = [items]
            if not isinstance(items, list):
                return []
            return items
    except Exception:
        return []


async def fetch_train_schedules(
    dep_place_id: str,
    arr_place_id: str,
    dep_plandtime: str,
    train_grade_code: str = "",
) -> list[dict]:
    """
    TAGO 열차 시간표 조회.
    params:
      dep_place_id: 출발역 nodeId
      arr_place_id: 도착역 nodeId
      dep_plandtime: YYYYMMDD
      train_grade_code: 00=KTX, 01=새마을, 02=무궁화, "" = 전체
    """
    key = _data_go_kr_key()
    if not key or not dep_place_id or not arr_place_id:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "serviceKey": key,
                "pageNo": "1",
                "numOfRows": "30",
                "_type": "json",
                "depPlaceId": dep_place_id,
                "arrPlaceId": arr_place_id,
                "depPlandTime": dep_plandtime,
            }
            if train_grade_code:
                params["trainGradeCode"] = train_grade_code
            url = f"{TAGO_TRAIN_BASE}/getStrtpntAlocFndTrainInfo"
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
            items = data.get("response", {}).get("body", {}).get("items", {})
            if isinstance(items, dict):
                items = items.get("item", [])
            if isinstance(items, dict):
                items = [items]
            if not isinstance(items, list):
                return []
            return items
    except Exception:
        return []


async def fetch_nearby_train_stations(lat: float, lng: float, radius: int = 5000) -> dict:
    """
    주변 기차역 검색 (Kakao 기반).

    Returns: {"hubs": [...], "source": str}
    """
    queries = ["기차역", "KTX", "SRT"]
    seen_ids = set()
    results = []

    for q in queries:
        kakao = await search_nearby_places(
            query=q, lng=lng, lat=lat, radius=radius, size=15,
        )
        for k in kakao:
            if not k.get("id") or k["id"] in seen_ids:
                continue
            name = k.get("name", "")
            category = k.get("category", "")

            # 카테고리 기반 필터 — "기차,철도" 또는 "기차역"이 카테고리에 있어야 함
            # (음식점/카페/편의점 등 오탐 배제)
            is_train = (
                "기차,철도" in category
                or "기차역" in category
                or "철도역" in category
                or (category.startswith("교통,수송") and ("KTX" in category or "SRT" in category))
            )
            if not is_train:
                continue

            # 지하철 전용역 제외
            if "지하철" in category and "기차" not in category:
                continue

            # 폐역/화물역/잔교역/고객라운지 등 비운용 시설 제외
            EXCLUDE = ["폐역", "화물역", "잔교역", "잔교 역", "고객라운지", "출장소", "관리소", "관리운영"]
            if any(kw in name for kw in EXCLUDE):
                continue
            if any(kw in category for kw in ["관리운영", "관리,운영", "폐역"]):
                continue

            seen_ids.add(k["id"])
            results.append({
                "id": str(k["id"]),
                "name": name,
                "type": "train_station",
                "address": k.get("address") or k.get("road_address") or "",
                "lat": k["lat"],
                "lng": k["lng"],
                "distance": k.get("distance", 0),
                "category": category,
                "phone": k.get("phone", ""),
            })

    # 거리순 정렬
    results.sort(key=lambda x: x["distance"])
    return {"hubs": results[:20], "source": "kakao"}
