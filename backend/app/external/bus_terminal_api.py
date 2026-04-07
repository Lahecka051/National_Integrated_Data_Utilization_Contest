"""
고속버스/시외버스 터미널 API 클라이언트

데이터 소스:
  1) Kakao Local — "고속버스터미널|시외버스터미널" 키워드 (위치 기반)
  2) 국토교통부 TAGO 고속버스정보서비스
     Base: http://apis.data.go.kr/1613000/ExpBusInfoService/
     - getExpBusTrminlList: 고속버스 터미널 목록 (terminalId, terminalNm, gpsX/gpsY)
     - getStrtpntAlocFndExpbusInfo: 출발지→도착지 노선 실시간 잔여석
"""
import os
import httpx
from typing import Optional

from .kakao_api import search_nearby_places

TAGO_EXPBUS_BASE = "http://apis.data.go.kr/1613000/ExpBusInfoService"


def _data_go_kr_key() -> str:
    return os.getenv("DATA_GO_KR_API_KEY", "") or os.getenv("DATA_GO_KR_API_KEY_ENCODING", "")


async def fetch_expbus_terminals() -> list[dict]:
    """TAGO 고속버스 터미널 전체 목록 (캐싱해서 사용해도 됨)."""
    key = _data_go_kr_key()
    if not key:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "serviceKey": key,
                "pageNo": "1",
                "numOfRows": "500",
                "_type": "json",
            }
            url = f"{TAGO_EXPBUS_BASE}/getExpBusTrminlList"
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

            parsed = []
            for it in items:
                try:
                    gps_x = float(it.get("gpsX") or 0)  # 경도
                    gps_y = float(it.get("gpsY") or 0)  # 위도
                except (ValueError, TypeError):
                    continue
                if gps_x == 0 or gps_y == 0:
                    continue
                parsed.append({
                    "id": f"tago_{it.get('terminalId', '')}",
                    "name": it.get("terminalNm") or "",
                    "lat": gps_y,
                    "lng": gps_x,
                    "terminal_id": it.get("terminalId"),
                })
            return parsed
    except Exception:
        return []


async def fetch_expbus_schedules(
    dep_terminal_id: str,
    arr_terminal_id: str,
    dep_plandtime: str,
    bus_grade_id: str = "",
) -> list[dict]:
    """
    TAGO 고속버스 시간표/잔여석 조회.
    params:
      dep_terminal_id: 출발 터미널 ID
      arr_terminal_id: 도착 터미널 ID
      dep_plandtime: YYYYMMDD (또는 YYYYMMDDHHMM)
      bus_grade_id: 등급 (optional) — 우등/일반
    Returns: list of dict items.
    """
    key = _data_go_kr_key()
    if not key or not dep_terminal_id or not arr_terminal_id:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "serviceKey": key,
                "pageNo": "1",
                "numOfRows": "30",
                "_type": "json",
                "depTerminalId": dep_terminal_id,
                "arrTerminalId": arr_terminal_id,
                "depPlandTime": dep_plandtime,
            }
            if bus_grade_id:
                params["busGradeId"] = bus_grade_id
            url = f"{TAGO_EXPBUS_BASE}/getStrtpntAlocFndExpbusInfo"
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


async def fetch_expbus_remaining_seats(start_terminal_id: str) -> int:
    """특정 터미널 출발 노선의 평균 잔여석 비율 → 혼잡도 역지표로 활용.
    Returns: 평균 잔여 좌석 비율 (0.0~1.0). 실패 시 -1.
    """
    key = _data_go_kr_key()
    if not key or not start_terminal_id:
        return -1
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "serviceKey": key,
                "pageNo": "1",
                "numOfRows": "50",
                "_type": "json",
                "depTerminalId": start_terminal_id,
            }
            url = f"{TAGO_EXPBUS_BASE}/getStrtpntAlocFndExpbusInfo"
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return -1
            data = resp.json()
            items = data.get("response", {}).get("body", {}).get("items", {})
            if isinstance(items, dict):
                items = items.get("item", [])
            if isinstance(items, dict):
                items = [items]
            if not isinstance(items, list) or not items:
                return -1

            ratios = []
            for it in items:
                try:
                    remaining = int(it.get("adultCharge") or 0)   # API별로 필드명 상이
                    total = int(it.get("chargeFormula") or 0)
                    if total > 0:
                        ratios.append(remaining / total)
                except (ValueError, TypeError):
                    continue
            if not ratios:
                return -1
            return sum(ratios) / len(ratios)
    except Exception:
        return -1


async def fetch_nearby_bus_terminals(lat: float, lng: float, radius: int = 5000) -> dict:
    """
    주변 고속/시외버스 터미널 검색.

    Returns: {"hubs": [...], "source": str}
    """
    queries = ["고속버스터미널", "시외버스터미널", "버스터미널"]
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

            # 카테고리 기반 필터: 실제 "터미널"만 허용, "정류장/정류소" 제외
            is_terminal = (
                "버스터미널" in category
                or (category.endswith("터미널") and ("고속" in category or "시외" in category))
                or (category.startswith("교통,수송") and "터미널" in category and "정류" not in category)
            )
            if not is_terminal:
                continue

            # 이름에 '정류장/정류소/휴게소' 포함 시 제외
            EXCLUDE_NAME = ["정류장", "정류소", "휴게소", "매표소", "안내소"]
            if any(kw in name for kw in EXCLUDE_NAME):
                continue

            seen_ids.add(k["id"])
            results.append({
                "id": str(k["id"]),
                "name": name,
                "type": "bus_terminal",
                "address": k.get("address") or k.get("road_address") or "",
                "lat": k["lat"],
                "lng": k["lng"],
                "distance": k.get("distance", 0),
                "category": category,
                "phone": k.get("phone", ""),
            })

    results.sort(key=lambda x: x["distance"])
    return {"hubs": results[:20], "source": "kakao"}
