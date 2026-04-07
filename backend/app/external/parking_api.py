"""
공공주차장 API 클라이언트

데이터 소스:
  1) Kakao Local API (category_group_code=PK6) — 전국 주차장 위치/이름 (항상 사용)
  2) 국토교통부 전국주차장정보표준데이터 — 요금·운영시간·총면수 enrichment
     서비스: https://www.data.go.kr/data/15025698/standard.do
     OpenAPI: http://api.data.go.kr/openapi/tn_pubr_prkplce_info_api
  3) 서울시 공영주차장 실시간 주차정보 — 잔여면수 (서울 한정)
     URL: http://openapi.seoul.go.kr:8088/{KEY}/json/GetParkInfo/{START}/{END}/

세 소스를 통합해 PublicParking 리스트로 반환.
"""
import os
import math
import httpx
from typing import Optional

from .kakao_api import search_nearby_places

PARKING_META_URL = "http://api.data.go.kr/openapi/tn_pubr_prkplce_info_api"
SEOUL_PARKING_URL = "http://openapi.seoul.go.kr:8088"


def _data_go_kr_key() -> str:
    # Decoding 키 우선, 없으면 Encoding 키 사용
    return os.getenv("DATA_GO_KR_API_KEY", "") or os.getenv("DATA_GO_KR_API_KEY_ENCODING", "")


def _seoul_key() -> str:
    return os.getenv("SEOUL_OPENDATA_API_KEY", "")


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    R = 6371000
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return int(2 * R * math.asin(math.sqrt(a)))


def _classify_status(available: Optional[int], total: Optional[int]) -> str:
    if available is None or total is None or total <= 0:
        return "정보없음"
    if available <= 0:
        return "만차"
    ratio = available / total
    if ratio < 0.1:
        return "혼잡"
    if ratio < 0.3:
        return "보통"
    return "여유"


async def _fetch_seoul_realtime() -> dict:
    """서울 공영주차장 실시간 정보 — 전체 가져와서 이름 매칭에 사용.
    Returns: { parking_name(정규화) : {total, available} }
    """
    key = _seoul_key()
    if not key:
        return {}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # 서울 공영주차장은 대략 1000개 수준이라 1~1000으로 조회
            url = f"{SEOUL_PARKING_URL}/{key}/json/GetParkInfo/1/1000/"
            resp = await client.get(url)
            if resp.status_code != 200:
                return {}
            data = resp.json()
            rows = data.get("GetParkInfo", {}).get("row", [])
            result = {}
            for row in rows:
                name = (row.get("PKLT_NM") or "").strip()
                if not name:
                    continue
                try:
                    total = int(row.get("TPKCT") or 0)
                    used = int(row.get("NOW_PRK_VHCL_CNT") or 0)
                    available = max(0, total - used)
                except (ValueError, TypeError):
                    total, available = 0, 0
                # 좌표는 있으면 같이
                try:
                    lat = float(row.get("LAT") or 0)
                    lng = float(row.get("LOT") or 0)
                except (ValueError, TypeError):
                    lat, lng = 0.0, 0.0
                result[name] = {
                    "total": total,
                    "available": available,
                    "lat": lat,
                    "lng": lng,
                    "addr": row.get("ADDR") or "",
                    "type": row.get("PKLT_TYPE") or row.get("PRK_TYPE_NM") or "",
                    "fee": row.get("RATES") or row.get("PAY_YN_NM") or "",
                }
            return result
    except Exception:
        return {}


async def _fetch_parking_meta(lat: float, lng: float, radius: int = 3000) -> list[dict]:
    """공공데이터포털 전국주차장정보표준데이터 호출.
    주의: 이 API는 lat/lng 반경 파라미터를 공식 지원하지 않는 경우가 많아,
    먼저 큰 페이지를 받아 직접 거리 필터링한다. 실패 시 빈 리스트.
    """
    key = _data_go_kr_key()
    if not key:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "serviceKey": key,
                "pageNo": "1",
                "numOfRows": "500",
                "type": "json",
            }
            resp = await client.get(PARKING_META_URL, params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
            items = data.get("response", {}).get("body", {}).get("items", [])
            if isinstance(items, dict):
                items = items.get("item", [])
            if not isinstance(items, list):
                return []

            results = []
            for it in items:
                try:
                    plat = float(it.get("latitude") or 0)
                    plng = float(it.get("longitude") or 0)
                except (ValueError, TypeError):
                    continue
                if plat == 0 or plng == 0:
                    continue
                dist = _haversine_m(lat, lng, plat, plng)
                if dist > radius:
                    continue
                results.append({
                    "id": str(it.get("prkplceNo") or f"meta_{plat}_{plng}"),
                    "name": it.get("prkplceNm") or "공공주차장",
                    "address": it.get("rdnmadr") or it.get("lnmadr") or "",
                    "lat": plat,
                    "lng": plng,
                    "distance": dist,
                    "parking_type": it.get("prkplceSe") or it.get("prkplceType") or "",
                    "total_slots": int(it.get("prkcmprt") or 0) or None,
                    "fee_info": it.get("feedingSe") or it.get("parkingchrgeInfo") or "",
                    "operating_hours": f"{it.get('weekdayOperOpenHhmm') or ''}~{it.get('weekdayOperColseHhmm') or ''}".strip("~"),
                    "phone": it.get("phoneNumber") or "",
                    "source": "data_go_kr",
                })
            results.sort(key=lambda x: x["distance"])
            return results[:30]
    except Exception:
        return []


def _match_seoul_realtime(name: str, seoul_data: dict) -> Optional[dict]:
    if not seoul_data:
        return None
    # 완전 일치 우선
    if name in seoul_data:
        return seoul_data[name]
    # 부분 일치 (공공주차장/공영주차장 접미사 제거 후)
    norm = name.replace("공영주차장", "").replace("공공주차장", "").replace("주차장", "").strip()
    if not norm:
        return None
    for key, value in seoul_data.items():
        if norm in key or key in norm:
            return value
    return None


async def fetch_nearby_parking(lat: float, lng: float, radius: int = 2000) -> dict:
    """
    주변 공공주차장 목록 조회 (Kakao + 공공API + 서울 실시간 통합)
    Returns: {"parkings": [...], "source": str, "has_realtime": bool}
    """
    # 1) Kakao PK6 카테고리
    kakao_results = await search_nearby_places(
        query="공영주차장", lng=lng, lat=lat, radius=radius,
        category_group_code="PK6", size=15,
    )

    # 2) 공공 API 메타
    meta_results = await _fetch_parking_meta(lat, lng, radius)

    # 3) 서울 실시간
    seoul_data = await _fetch_seoul_realtime()
    has_realtime = bool(seoul_data)

    # 메타 기준 dict (이름+좌표 근사 매칭용)
    def meta_key(lat_: float, lng_: float) -> str:
        return f"{round(lat_, 4)}_{round(lng_, 4)}"
    meta_map = {meta_key(m["lat"], m["lng"]): m for m in meta_results}

    parkings = []
    seen_keys = set()

    # Kakao 결과 기준으로 enrichment
    for k in kakao_results:
        key = meta_key(k["lat"], k["lng"])
        meta = meta_map.get(key)
        seoul_info = _match_seoul_realtime(k["name"], seoul_data)

        total = (meta or {}).get("total_slots") or (seoul_info or {}).get("total")
        available = (seoul_info or {}).get("available")
        status = _classify_status(available, total)

        parkings.append({
            "id": str(k.get("id") or key),
            "name": k["name"],
            "address": k.get("address") or k.get("road_address") or (meta or {}).get("address", ""),
            "lat": k["lat"],
            "lng": k["lng"],
            "distance": k.get("distance", 0),
            "parking_type": (meta or {}).get("parking_type") or (seoul_info or {}).get("type") or "공영",
            "total_slots": total,
            "available_slots": available,
            "status": status,
            "fee_info": (meta or {}).get("fee_info") or (seoul_info or {}).get("fee") or "",
            "operating_hours": (meta or {}).get("operating_hours") or "",
            "phone": k.get("phone") or (meta or {}).get("phone") or "",
            "source": "seoul_opendata" if seoul_info else ("data_go_kr" if meta else "kakao"),
        })
        seen_keys.add(key)

    # 메타 API에만 있는 주차장 추가 (Kakao에 없던 것)
    for m in meta_results:
        key = meta_key(m["lat"], m["lng"])
        if key in seen_keys:
            continue
        seoul_info = _match_seoul_realtime(m["name"], seoul_data)
        available = (seoul_info or {}).get("available")
        status = _classify_status(available, m.get("total_slots"))
        parkings.append({
            **m,
            "available_slots": available,
            "status": status,
            "source": "seoul_opendata" if seoul_info else "data_go_kr",
        })

    parkings.sort(key=lambda x: x["distance"])

    sources = {p["source"] for p in parkings}
    source_label = "+".join(sorted(sources)) if sources else "none"

    return {
        "parkings": parkings[:30],
        "source": source_label,
        "has_realtime": has_realtime,
    }


async def fetch_parking_detail(parking_id: str, lat: float, lng: float) -> Optional[dict]:
    """단일 주차장 상세 — 주변 검색 결과에서 id로 필터."""
    result = await fetch_nearby_parking(lat, lng, radius=5000)
    for p in result["parkings"]:
        if p["id"] == parking_id:
            return p
    return None
