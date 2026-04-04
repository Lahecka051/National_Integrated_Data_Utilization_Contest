"""
울산광역시 기준 시설/이동 데이터
대기시간은 통계 모델(wait_time_model.py) 사용
교차로 402건 + 신호등 402건 + 버스노선 527건 + 버스실시간 2,198건 실제 API 활용
"""
from datetime import datetime
from ..services.wait_time_model import calc_civil_wait, calc_bank_wait, calc_post_wait

# === 시설 정보 (울산시청 인근) ===
FACILITIES = {
    "ulsan_civil": {
        "id": "ulsan_civil",
        "name": "울산 남구청 민원실",
        "type": "민원실",
        "address": "울산광역시 남구 돋질로 233",
        "lat": 35.5442,
        "lng": 129.3247,
        "open_time": "09:00",
        "close_time": "18:00",
    },
    "ulsan_bank": {
        "id": "ulsan_bank",
        "name": "BNK경남은행 울산시청지점",
        "type": "은행",
        "address": "울산광역시 남구 중앙로 201",
        "lat": 35.5396,
        "lng": 129.3115,
        "open_time": "09:00",
        "close_time": "16:00",
    },
    "ulsan_post": {
        "id": "ulsan_post",
        "name": "울산남부우체국",
        "type": "우체국",
        "address": "울산광역시 남구 삼산로 265",
        "lat": 35.5405,
        "lng": 129.3116,
        "open_time": "09:00",
        "close_time": "18:00",
    },
}

# 사용자 출발지 (울산시청)
DEFAULT_START = {"lat": 35.5396, "lng": 129.3114}
DEFAULT_STDG_CD = "3100000000"  # 울산광역시

# === 시설간 이동시간 (분, 카카오 내비 API 기반) ===
TRAVEL_TIMES = {
    ("ulsan_civil", "ulsan_bank"): 12,
    ("ulsan_bank", "ulsan_civil"): 12,
    ("ulsan_civil", "ulsan_post"): 12,
    ("ulsan_post", "ulsan_civil"): 12,
    ("ulsan_bank", "ulsan_post"): 2,
    ("ulsan_post", "ulsan_bank"): 2,
    ("start", "ulsan_civil"): 10,
    ("start", "ulsan_bank"): 1,
    ("start", "ulsan_post"): 2,
}

# 이동수단
TRAVEL_MODES = {
    ("ulsan_civil", "ulsan_bank"): "bus",
    ("ulsan_bank", "ulsan_civil"): "bus",
    ("ulsan_civil", "ulsan_post"): "bus",
    ("ulsan_post", "ulsan_civil"): "bus",
    ("ulsan_bank", "ulsan_post"): "walk",
    ("ulsan_post", "ulsan_bank"): "walk",
    ("start", "ulsan_civil"): "bus",
    ("start", "ulsan_bank"): "walk",
    ("start", "ulsan_post"): "walk",
}

# === 버스 이동 상세 정보 ===
BUS_TRAVEL_INFO = {
    ("start", "ulsan_civil"): {
        "stop_name": "울산시청 정류장",
        "bus_no": "중구01",
        "ride_minutes": 8,
        "walk_to_stop_minutes": 2,
        "alternatives": [
            {"bus_no": "중구01", "interval_min": 10, "ride_min": 8},
            {"bus_no": "807", "interval_min": 15, "ride_min": 10},
            {"bus_no": "1127", "interval_min": 12, "ride_min": 12},
        ],
    },
    ("ulsan_civil", "ulsan_bank"): {
        "stop_name": "울산남구청 정류장",
        "bus_no": "807",
        "ride_minutes": 10,
        "walk_to_stop_minutes": 1,
        "alternatives": [
            {"bus_no": "807", "interval_min": 15, "ride_min": 10},
            {"bus_no": "1127", "interval_min": 12, "ride_min": 12},
        ],
    },
    ("ulsan_bank", "ulsan_civil"): {
        "stop_name": "울산시청 정류장",
        "bus_no": "807",
        "ride_minutes": 10,
        "walk_to_stop_minutes": 1,
        "alternatives": [
            {"bus_no": "807", "interval_min": 15, "ride_min": 10},
            {"bus_no": "1127", "interval_min": 12, "ride_min": 12},
        ],
    },
    ("ulsan_civil", "ulsan_post"): {
        "stop_name": "울산남구청 정류장",
        "bus_no": "807",
        "ride_minutes": 10,
        "walk_to_stop_minutes": 1,
        "alternatives": [{"bus_no": "807", "interval_min": 15, "ride_min": 10}],
    },
    ("ulsan_post", "ulsan_civil"): {
        "stop_name": "울산남부우체국앞 정류장",
        "bus_no": "807",
        "ride_minutes": 10,
        "walk_to_stop_minutes": 1,
        "alternatives": [{"bus_no": "807", "interval_min": 15, "ride_min": 10}],
    },
}

# === 횡단보도 신호 대기시간 (초, 실시간 API fallback) ===
CROSSWALK_WAIT = {
    ("ulsan_civil", "ulsan_bank"): 45,
    ("ulsan_bank", "ulsan_civil"): 45,
    ("ulsan_civil", "ulsan_post"): 45,
    ("ulsan_post", "ulsan_civil"): 45,
    ("ulsan_bank", "ulsan_post"): 20,
    ("ulsan_post", "ulsan_bank"): 20,
    ("start", "ulsan_civil"): 60,
    ("start", "ulsan_bank"): 15,
    ("start", "ulsan_post"): 15,
}

# === 용무별 처리시간 (분, 행정안전부 민원처리시간 통계 기반) ===
TASK_DURATIONS = {
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


# === 통계 모델 래퍼 함수 ===

def get_civil_wait(weekday: int, hour: int, day_of_month: int = 15) -> int:
    return calc_civil_wait(weekday, hour, day_of_month)


def get_bank_wait(weekday: int, hour: int, day_of_month: int = 15) -> int:
    return calc_bank_wait(weekday, hour, day_of_month)


def get_post_wait(weekday: int, hour: int) -> int:
    return calc_post_wait(weekday, hour)


def get_travel_time(from_id: str, to_id: str, rain: bool = False) -> int:
    key = (from_id, to_id)
    base = TRAVEL_TIMES.get(key, 15)
    crosswalk = CROSSWALK_WAIT.get(key, 30) / 60
    total = base + crosswalk
    if rain and TRAVEL_MODES.get(key, "walk") == "walk":
        total *= 1.3
    return round(total)


def get_travel_mode(from_id: str, to_id: str) -> str:
    return TRAVEL_MODES.get((from_id, to_id), "walk")


def get_bus_info(from_id: str, to_id: str) -> dict | None:
    return BUS_TRAVEL_INFO.get((from_id, to_id))


def get_weather_forecast(target_date: datetime) -> dict:
    """기상청 API fallback (동기 호출용, 실제 API는 라우터에서 비동기 호출)"""
    import random
    random.seed(target_date.toordinal())
    conditions = ["맑음", "맑음", "맑음", "흐림", "흐림", "비"]
    condition = random.choice(conditions)
    temp = random.randint(12, 28)
    rain_prob = {"맑음": 10, "흐림": 40, "비": 80}.get(condition, 10)
    penalty = {"맑음": 1.0, "흐림": 1.0, "비": 1.3}.get(condition, 1.0)
    return {"condition": condition, "temperature": temp, "rain_probability": rain_prob, "penalty_factor": penalty}


def get_task_duration(task_name: str) -> int:
    return TASK_DURATIONS.get(task_name, 15)
