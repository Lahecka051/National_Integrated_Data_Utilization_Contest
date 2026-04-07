"""
공공데이터포털 API 클라이언트 - 실제 API 스펙 기반
API 키가 있으면 실제 호출, 없으면 Mock fallback

=== 민원실 이용 현황 실시간 정보 (2종) ===
  /cso_realtime_v2 - 실시간 대기현황 (업무, 창구번호, 대기인수)
  /cso_meta_v2     - 민원실 기본정보 (주소, 위도/경도, 운영시간)
  공통 파라미터: serviceKey(필수), pageNo, numOfRows, type, stdgCd(법정동코드)

=== 교통안전 신호등 실시간 정보 (2종) ===
  /crsrd_map_info  - 교차로 맵 정보 (교차로명, 위도/경도, 제한속도)
  /tl_drct_info    - 신호제어기 신호잔여시간 (8방향별 보행/직진/좌회전 잔여시간)
  공통 파라미터: serviceKey(필수), pageNo, numOfRows, type, stdgCd

=== 초정밀 버스 실시간 정보 (3종) ===
  /mst_info        - 노선 기본정보
  /ps_info         - 노선 경유지 정보
  /rtm_loc_info    - 버스 실시간 위치정보
  공통 파라미터: serviceKey(필수), pageNo, numOfRows, type, stdgCd
"""
import os
import httpx
from datetime import datetime

BASE_API = "https://apis.data.go.kr/B551982"
# 민원실: /B551982/cso_v2/...
# 신호등: /B551982/rti/...
# 버스:   /B551982/rte/...

# 부산 해운대구 법정동코드
SEOUL_STDG_CD = "3100000000"  # 울산광역시


def _get_api_key() -> str:
    return os.getenv("DATA_GO_KR_API_KEY", "")


def _get_weather_key() -> str:
    return os.getenv("WEATHER_API_KEY", "") or _get_api_key()


def has_api_key() -> bool:
    key = _get_api_key()
    return bool(key) and key != "your_api_key_here"


def _common_params(stdg_cd: str, num_rows: int = 100) -> dict:
    return {
        "serviceKey": _get_api_key(),
        "pageNo": "1",
        "numOfRows": str(num_rows),
        "type": "json",
        "stdgCd": stdg_cd,
    }


async def _fetch(url: str, params: dict) -> dict | None:
    """공통 API 호출 헬퍼"""
    if not has_api_key():
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                result_code = data.get("header", {}).get("resultCode", "")
                # K0=성공, K3=데이터없음 (둘 다 유효한 응답)
                if result_code in ("00", "K0", "K3", ""):
                    return data
    except Exception:
        pass
    return None


def _extract_items(data: dict) -> list[dict]:
    """응답에서 items 추출 (단건이면 리스트로 변환)"""
    items = data.get("body", {}).get("items", {}).get("item", [])
    if isinstance(items, dict):
        items = [items]
    return items


# ============================================================
# 민원실 이용 현황 실시간 정보 (2종)
# ============================================================

async def fetch_civil_realtime(stdg_cd: str = SEOUL_STDG_CD) -> dict | None:
    """민원실 실시간 대기현황 - /B551982/cso_v2/cso_realtime_v2"""
    return await _fetch(f"{BASE_API}/cso_v2/cso_realtime_v2", _common_params(stdg_cd))


async def fetch_civil_meta(stdg_cd: str = SEOUL_STDG_CD) -> dict | None:
    """민원실 기본정보 - /B551982/cso_v2/cso_info_v2"""
    return await _fetch(f"{BASE_API}/cso_v2/cso_info_v2", _common_params(stdg_cd))


def parse_civil_realtime(data: dict) -> list[dict]:
    """실시간 대기현황 파싱"""
    return [
        {
            "cso_name": item.get("csoNm", ""),
            "task_name": item.get("taskNm", ""),
            "waiting_count": int(item.get("wtngCnt", "0")),
            "call_number": item.get("clotNo", ""),
            "counter_number": item.get("clotCnterNo", ""),
            "cso_sn": item.get("csoSn", ""),
        }
        for item in _extract_items(data)
    ]


def parse_civil_meta(data: dict) -> list[dict]:
    """민원실 기본정보 파싱"""
    return [
        {
            "cso_name": item.get("csoNm", ""),
            "address": item.get("roadNmAddr", "") or item.get("lotnoAddr", ""),
            "lat": float(item.get("lat", "0") or "0"),
            "lng": float(item.get("lot", "0") or "0"),
            "open_time": item.get("wkdyOperBgngTm", "09:00"),
            "close_time": item.get("wkdyOperEndTm", "18:00"),
            "night_operation": item.get("nghtOperYn", "N") == "Y",
            "weekend_operation": item.get("wkndOperYn", "N") == "Y",
        }
        for item in _extract_items(data)
    ]


# ============================================================
# 교통안전 신호등 실시간 정보 (2종)
# ============================================================

async def fetch_crossroad_map(stdg_cd: str = SEOUL_STDG_CD) -> dict | None:
    """교차로 맵 정보 - /B551982/rti/crsrd_map_info"""
    return await _fetch(f"{BASE_API}/rti/crsrd_map_info", _common_params(stdg_cd))


async def fetch_traffic_light_signal(stdg_cd: str = SEOUL_STDG_CD) -> dict | None:
    """신호제어기 신호잔여시간 - /B551982/rti/tl_drct_info"""
    return await _fetch(f"{BASE_API}/rti/tl_drct_info", _common_params(stdg_cd))


def parse_crossroad_map(data: dict) -> list[dict]:
    """교차로 맵 정보 파싱"""
    return [
        {
            "crossroad_id": item.get("crsrdId", ""),
            "crossroad_name": item.get("crsrdNm", ""),
            "municipality": item.get("lclgvNm", ""),
            "lat": float(item.get("mapCtptIntLat", "0") or "0"),
            "lng": float(item.get("mapCtptIntLot", "0") or "0"),
            "lane_width": item.get("laneWdth", ""),
            "speed_limit_type": item.get("lmtSpdTypeNm", ""),
            "speed_limit": item.get("lmtSpd", ""),
        }
        for item in _extract_items(data)
    ]


def parse_traffic_light_signal(data: dict) -> list[dict]:
    """
    신호잔여시간 파싱 - 8방향(nt/et/st/wt/ne/se/sw/nw)별 보행신호 잔여시간 추출
    PdsgRmndCs = 보행신호 잔여시간(초), PdsgSttsNm = 보행신호 점등상태
    """
    # 방향 접두사: nt=북, et=동, st=남, wt=서, ne=북동, se=남동, sw=남서, nw=북서
    directions = {
        "nt": "북", "et": "동", "st": "남", "wt": "서",
        "ne": "북동", "se": "남동", "sw": "남서", "nw": "북서",
    }

    result = []
    for item in _extract_items(data):
        signals = {}
        for prefix, direction_name in directions.items():
            ped_remain = item.get(f"{prefix}PdsgRmndCs", "0")
            ped_status = item.get(f"{prefix}PdsgSttsNm", "")
            straight_remain = item.get(f"{prefix}StsgRmndCs", "0")
            straight_status = item.get(f"{prefix}StsgSttsNm", "")
            signals[direction_name] = {
                "pedestrian_remain_sec": int(ped_remain or "0"),
                "pedestrian_status": ped_status,
                "straight_remain_sec": int(straight_remain or "0"),
                "straight_status": straight_status,
            }
        result.append({
            "crossroad_id": item.get("crsrdId", ""),
            "stdg_cd": item.get("stdgCd", ""),
            "signals": signals,
        })
    return result


def get_pedestrian_wait_estimate(signal_data: list[dict]) -> dict[str, int]:
    """
    교차로별 평균 보행 대기시간(초) 추정
    현재 보행신호가 적색이면 잔여시간이 대기시간, 녹색이면 0
    """
    estimates = {}
    for item in signal_data:
        crsrd_id = item["crossroad_id"]
        wait_times = []
        for direction, sig in item["signals"].items():
            remain = sig["pedestrian_remain_sec"]
            status = sig["pedestrian_status"]
            if "적" in status or "빨" in status or "RED" in status.upper():
                wait_times.append(remain)
            else:
                wait_times.append(0)
        # 평균 대기시간 (보행자가 어느 방향에서 건너는지 모르므로)
        estimates[crsrd_id] = round(sum(wait_times) / max(len(wait_times), 1))
    return estimates


# ============================================================
# 초정밀 버스 실시간 정보 (3종)
# ============================================================

async def fetch_bus_route_info(stdg_cd: str = SEOUL_STDG_CD) -> dict | None:
    """노선 기본정보 - /B551982/rte/mst_info"""
    return await _fetch(f"{BASE_API}/rte/mst_info", _common_params(stdg_cd))


async def fetch_bus_stop_info(stdg_cd: str = SEOUL_STDG_CD) -> dict | None:
    """노선 경유지 정보 - /B551982/rte/ps_info"""
    return await _fetch(f"{BASE_API}/rte/ps_info", _common_params(stdg_cd))


async def fetch_bus_realtime_location(stdg_cd: str = SEOUL_STDG_CD) -> dict | None:
    """버스 실시간 위치 - /B551982/rte/rtm_loc_info"""
    return await _fetch(f"{BASE_API}/rte/rtm_loc_info", _common_params(stdg_cd))


def parse_bus_route_info(data: dict) -> list[dict]:
    """노선 기본정보 파싱"""
    return [
        {
            "route_id": item.get("routeId", ""),
            "route_name": item.get("routeNm", ""),
            "route_type": item.get("routeTypeCdNm", ""),
            "start_stop": item.get("stStaNm", ""),
            "end_stop": item.get("edStaNm", ""),
        }
        for item in _extract_items(data)
    ]


def parse_bus_realtime_location(data: dict) -> list[dict]:
    """버스 실시간 위치 파싱"""
    return [
        {
            "vehicle_id": item.get("vhclId", ""),
            "route_id": item.get("routeId", ""),
            "lat": float(item.get("lat", "0") or "0"),
            "lng": float(item.get("lot", "0") or "0"),
            "stop_name": item.get("staNm", ""),
            "speed": item.get("spd", ""),
        }
        for item in _extract_items(data)
    ]


# ============================================================
# 우체국 API (우정사업본부)
# ============================================================

async def fetch_post_office_delivery_address(address: str) -> dict | None:
    """우체국 배달점주소 조회 - X/Y 좌표 포함"""
    key = _get_api_key()
    if not key or key == "your_api_key_here":
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "http://openapi.epost.go.kr/postal/registerDeliveryCdService/registerDeliveryCdService/getDeliveryCdService",
                params={"serviceKey": key, "Addr": address},
            )
            if resp.status_code == 200:
                return {"raw_xml": resp.text}
    except Exception:
        pass
    return None


# ============================================================
# 기상청 단기예보 API
# ============================================================

async def fetch_weather_forecast(nx: int, ny: int, base_date: str) -> dict | None:
    """기상청 단기예보 - data.go.kr 동일 키 사용"""
    key = _get_weather_key()
    if not key or key == "your_api_key_here":
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",
                params={
                    "serviceKey": key,
                    "numOfRows": "100",
                    "pageNo": "1",
                    "dataType": "JSON",
                    "base_date": base_date,
                    "base_time": "0500",
                    "nx": str(nx),
                    "ny": str(ny),
                },
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None


def parse_weather_forecast(data: dict) -> dict | None:
    """기상청 단기예보 응답에서 날씨 정보 추출
    카테고리: TMP(기온), SKY(하늘상태 1맑음/3구름/4흐림), PTY(강수형태 0없음/1비/2비눈/3눈)
              POP(강수확률), REH(습도)
    """
    try:
        items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
        if not items:
            return None

        result = {"temperature": 0, "sky": 1, "pty": 0, "pop": 0}
        for item in items:
            cat = item.get("category", "")
            val = item.get("fcstValue", "0")
            if cat == "TMP":
                result["temperature"] = int(val)
            elif cat == "SKY":
                result["sky"] = int(val)
            elif cat == "PTY":
                result["pty"] = int(val)
            elif cat == "POP":
                result["pop"] = int(val)

        # 조건 변환
        pty = result["pty"]
        sky = result["sky"]
        if pty == 1:
            condition = "비"
        elif pty == 3:
            condition = "눈"
        elif pty == 2:
            condition = "비"
        elif sky >= 4:
            condition = "흐림"
        elif sky >= 3:
            condition = "흐림"
        else:
            condition = "맑음"

        penalty = 1.3 if condition in ("비", "눈") else 1.0

        return {
            "condition": condition,
            "temperature": result["temperature"],
            "rain_probability": result["pop"],
            "penalty_factor": penalty,
        }
    except Exception:
        return None


async def fetch_holiday_info(year: str, month: str) -> list[dict]:
    """한국천문연구원 특일정보 API - 공휴일 조회"""
    key = _get_api_key()
    if not key or key == "your_api_key_here":
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo",
                params={
                    "serviceKey": key,
                    "solYear": year,
                    "solMonth": month,
                    "numOfRows": "20",
                    "_type": "json",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
                if isinstance(items, dict):
                    items = [items]
                return [
                    {
                        "date": str(item.get("locdate", "")),
                        "name": item.get("dateName", ""),
                        "is_holiday": item.get("isHoliday", "N") == "Y",
                    }
                    for item in items
                ]
    except Exception:
        pass
    return []
