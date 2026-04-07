"""
지역명 → TAGO cityCode 매핑.

TAGO API는 지역별 정수 cityCode를 요구합니다.
(getCityCodeList 호출로 동적 조회할 수도 있지만 매우 안정적인 값이라 하드코딩)

매핑: 카카오 region_1depth → TAGO cityCode
"""
from typing import Optional


# Kakao region_1depth_name → TAGO cityCode (TrainInfoService/ExpBusInfoService 공통)
CITY_CODE_MAP: dict[str, int] = {
    "서울": 11,
    "서울특별시": 11,
    "부산": 21,
    "부산광역시": 21,
    "대구": 22,
    "대구광역시": 22,
    "인천": 23,
    "인천광역시": 23,
    "광주": 24,
    "광주광역시": 24,
    "대전": 25,
    "대전광역시": 25,
    "울산": 26,
    "울산광역시": 26,
    "세종": 29,
    "세종특별자치시": 29,
    "경기": 31,
    "경기도": 31,
    "강원": 32,
    "강원도": 32,
    "강원특별자치도": 32,
    "충북": 33,
    "충청북도": 33,
    "충남": 34,
    "충청남도": 34,
    "전북": 35,
    "전라북도": 35,
    "전북특별자치도": 35,
    "전남": 36,
    "전라남도": 36,
    "경북": 37,
    "경상북도": 37,
    "경남": 38,
    "경상남도": 38,
    "제주": 39,
    "제주도": 39,
    "제주특별자치도": 39,
}


# 주요 도시 → 대표 역명 (Kakao 검색 힌트)
MAJOR_CITY_MAIN_STATION: dict[str, str] = {
    "서울": "서울역",
    "부산": "부산역",
    "대구": "동대구역",
    "대전": "대전역",
    "광주": "광주송정역",
    "울산": "울산역",
    "인천": "인천역",
    "수원": "수원역",
    "천안": "천안아산역",
    "청주": "오송역",
    "전주": "전주역",
    "포항": "포항역",
    "여수": "여수엑스포역",
    "목포": "목포역",
    "강릉": "강릉역",
    "춘천": "춘천역",
    "창원": "창원중앙역",
    "진주": "진주역",
    "경주": "신경주역",
}


def resolve_city_code(region_name: str) -> Optional[int]:
    """지역명을 TAGO cityCode로 해석. 실패 시 None."""
    if not region_name:
        return None
    key = region_name.strip()
    # 직접 매칭
    if key in CITY_CODE_MAP:
        return CITY_CODE_MAP[key]
    # 부분 매칭 (예: "경상북도 구미시" → 경상북도)
    for name, code in CITY_CODE_MAP.items():
        if name in key or key in name:
            return code
    return None


def suggest_main_station(city_name: str) -> str:
    """주요 도시의 대표 역 이름 반환. 없으면 city_name + '역'."""
    if not city_name:
        return ""
    key = city_name.strip()
    if key in MAJOR_CITY_MAIN_STATION:
        return MAJOR_CITY_MAIN_STATION[key]
    # 부분 매칭
    for name, station in MAJOR_CITY_MAIN_STATION.items():
        if name in key or key in name:
            return station
    return f"{key}역"
