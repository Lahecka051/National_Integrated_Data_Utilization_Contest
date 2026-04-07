"""
기차역 / 고속버스 터미널 주변 혼잡도 지수 산출.

현재 공식 실시간 혼잡도 API는 제한적이라, 다음 요소를 조합해 근사 산출:
  1) 시간대 (time_of_day)       — 35%
  2) 요일 (day_of_week)          — 15%
  3) 공휴일 여부                  — 10% (역/터미널은 평일보다 공휴일이 더 혼잡)
  4) 주변 교통 신호 대기시간      — 20% (보행자 대기 평균 — 실측)
  5) 버스 잔여석 비율 역지표      — 20% (TAGO 고속버스만 해당)

Level:
  0~35  -> 여유
  35~65 -> 보통
  65~100 -> 혼잡
"""
from datetime import datetime
from typing import Optional

from ..external.public_api import (
    fetch_traffic_light_signal,
    parse_traffic_light_signal,
    get_pedestrian_wait_estimate,
)
from ..external.bus_terminal_api import fetch_expbus_remaining_seats


def _time_of_day_score(now: datetime) -> int:
    h = now.hour
    # 출퇴근 러시
    if 7 <= h <= 9 or 17 <= h <= 19:
        return 35
    # 점심
    if 11 <= h <= 13:
        return 20
    # 주간
    if 9 < h < 17:
        return 15
    # 심야
    if h >= 22 or h < 6:
        return 0
    return 10


def _day_of_week_score(now: datetime) -> int:
    wd = now.weekday()  # 0=월
    # 금요일 저녁
    if wd == 4 and now.hour >= 16:
        return 15
    # 일요일 저녁 (복귀 러시)
    if wd == 6 and now.hour >= 16:
        return 13
    # 평일 낮
    if wd < 5:
        return 8
    # 토요일 낮
    return 5


def _holiday_bonus(is_holiday: bool, hub_type: str) -> int:
    if not is_holiday:
        return 0
    # 공휴일엔 기차역/터미널이 특히 혼잡
    return 10


async def _traffic_wait_score(stdg_cd: str) -> tuple[int, int]:
    """주변 보행자 대기시간 기반 점수 (최대 20점)."""
    try:
        signal_data = await fetch_traffic_light_signal(stdg_cd)
        if not signal_data:
            return 0, 0
        signals = parse_traffic_light_signal(signal_data)
        waits = get_pedestrian_wait_estimate(signals)  # {dir: wait_sec}
        if not waits:
            return 0, 0
        avg_wait = sum(waits.values()) / len(waits)
        # 대기 60초 = 20점 만점
        return min(20, int(avg_wait / 3)), int(avg_wait)
    except Exception:
        return 0, 0


async def _bus_seat_score(terminal_id: Optional[str]) -> tuple[int, float]:
    """TAGO 고속버스 잔여석 비율 → 혼잡도 점수.
    잔여 많으면(0.8+) 여유, 잔여 적으면(<0.2) 혼잡.
    """
    if not terminal_id:
        return 0, -1.0
    ratio = await fetch_expbus_remaining_seats(terminal_id)
    if ratio < 0:
        return 0, -1.0
    # ratio 0.0 (매진) -> 20점, 1.0 (공석) -> 0점
    score = int(max(0.0, min(1.0, 1.0 - ratio)) * 20)
    return score, ratio


async def calculate_hub_congestion(
    hub_id: str,
    hub_name: str,
    hub_type: str,
    lat: float,
    lng: float,
    stdg_cd: str = "3100000000",
    terminal_id: Optional[str] = None,
    is_holiday: bool = False,
) -> dict:
    """
    혼잡도 지수 산출.

    Returns:
        {
          "hub_id": str, "hub_name": str, "hub_type": str,
          "level": "여유" | "보통" | "혼잡",
          "score": int (0~100),
          "factors": {...},
          "timestamp": ISO,
          "note": str,
        }
    """
    now = datetime.now()

    s_time = _time_of_day_score(now)
    s_day = _day_of_week_score(now)
    s_holiday = _holiday_bonus(is_holiday, hub_type)
    s_traffic, avg_wait = await _traffic_wait_score(stdg_cd)

    if hub_type == "bus_terminal":
        s_seat, seat_ratio = await _bus_seat_score(terminal_id)
    else:
        s_seat, seat_ratio = 0, -1.0
        # 기차역은 잔여석 대신 시간대 가중치를 조금 더
        s_time = int(s_time * 1.25)

    total = s_time + s_day + s_holiday + s_traffic + s_seat
    total = max(0, min(100, total))

    if total >= 65:
        level = "혼잡"
    elif total >= 35:
        level = "보통"
    else:
        level = "여유"

    note_parts = []
    if s_time >= 30:
        note_parts.append("출퇴근 시간대")
    if s_holiday > 0:
        note_parts.append("공휴일")
    if avg_wait >= 40:
        note_parts.append(f"주변 보행 대기 {avg_wait}초")
    if seat_ratio >= 0:
        note_parts.append(f"고속버스 잔여 {int(seat_ratio*100)}%")
    note = ", ".join(note_parts) if note_parts else "일반적 통행량"

    return {
        "hub_id": hub_id,
        "hub_name": hub_name,
        "hub_type": hub_type,
        "level": level,
        "score": total,
        "factors": {
            "time_of_day": s_time,
            "day_of_week": s_day,
            "holiday": s_holiday,
            "traffic_wait": s_traffic,
            "seat_availability": s_seat,
            "avg_pedestrian_wait_sec": avg_wait,
            "bus_seat_remaining_ratio": seat_ratio if seat_ratio >= 0 else None,
        },
        "timestamp": now.isoformat(timespec="seconds"),
        "note": note,
    }
