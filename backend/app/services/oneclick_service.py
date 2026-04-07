"""
원클릭 서비스 (One-Click Service) — 데모용 mock 구현.

⚠️ 이 모듈은 데모/프로토타입 목적의 가상 응답을 반환합니다.
   실제 정부24/홈택스/은행 예약 시스템과는 연동되지 않습니다.

기능:
  - 반차 추천 결과 확정 시 필요 서류를 자동 "발급" (mock)
  - 행정기관 예약 (mock)
  - 본인 지참 필요 서류 안내
"""
import asyncio
import secrets
from datetime import datetime
from typing import Optional


# 용무별 필요 서류 매핑
# auto_issuable=True: 정부24/홈택스/근로복지공단 등 통합인증으로 자동 발급 가능
# auto_issuable=False: 본인 지참 필수
REQUIRED_DOCS: dict[str, list[dict]] = {
    "전입신고": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
        {"name": "임대차계약서", "auto_issuable": False, "source": "본인 지참"},
        {"name": "전입신고서", "auto_issuable": True, "source": "정부24"},
    ],
    "주민등록등본 발급": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
    ],
    "인감증명서 발급": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
        {"name": "본인 인감", "auto_issuable": False, "source": "본인 지참"},
    ],
    "여권 신청": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
        {"name": "여권용 사진", "auto_issuable": False, "source": "본인 지참"},
        {"name": "여권발급 신청서", "auto_issuable": True, "source": "정부24"},
        {"name": "병적증명서", "auto_issuable": True, "source": "병무청 (mock)"},
    ],
    "통장 개설": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
        {"name": "주민등록등본", "auto_issuable": True, "source": "정부24"},
    ],
    "카드 발급": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
    ],
    "대출 상담": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
        {"name": "주민등록등본", "auto_issuable": True, "source": "정부24"},
        {"name": "재직증명서", "auto_issuable": True, "source": "근로복지공단 (mock)"},
        {"name": "소득금액증명원", "auto_issuable": True, "source": "홈택스 (mock)"},
        {"name": "지방세납세증명서", "auto_issuable": True, "source": "정부24"},
    ],
    "환전": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
    ],
    "등기우편 발송": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
        {"name": "발송 내용물", "auto_issuable": False, "source": "본인 지참"},
    ],
    "택배 발송": [
        {"name": "신분증", "auto_issuable": False, "source": "본인 지참"},
        {"name": "발송 내용물", "auto_issuable": False, "source": "본인 지참"},
    ],
}


# 시설 타입별 예약 채널
RESERVATION_CHANNEL = {
    "민원실": "정부24 민원예약",
    "은행": "영업점 방문 예약",
    "우체국": "우체국 인터넷 예약",
}


def _generate_reservation_no() -> str:
    return f"RSV-{secrets.token_hex(4).upper()}"


def get_required_documents_for_errands(errand_task_names: list[str]) -> dict:
    """용무 목록에서 필요 서류를 집계 (중복 제거)."""
    auto_docs: list[dict] = []
    bring_docs: list[dict] = []
    seen_auto: set[tuple[str, str]] = set()
    seen_bring: set[tuple[str, str]] = set()

    for task_name in errand_task_names:
        for doc in REQUIRED_DOCS.get(task_name, []):
            key = (doc["name"], task_name)
            if doc["auto_issuable"]:
                if doc["name"] not in {d["name"] for d in auto_docs}:
                    auto_docs.append({**doc, "required_for": task_name})
                    seen_auto.add(key)
            else:
                if doc["name"] not in {d["name"] for d in bring_docs}:
                    bring_docs.append({**doc, "required_for": task_name})
                    seen_bring.add(key)

    return {"auto": auto_docs, "bring": bring_docs}


async def confirm_plan(plan: dict, errands: list[dict]) -> dict:
    """
    원클릭 확정 처리:
      1) 자동 발급 가능한 서류를 mock으로 발급
      2) 모든 방문 시설에 대해 mock 예약 생성
      3) 본인 지참 필요 서류 안내 포함
    """
    # 1. 필요 서류 집계
    task_names = [e["task_name"] for e in errands]
    docs_grouped = get_required_documents_for_errands(task_names)

    documents: list[dict] = []
    now_iso = datetime.now().isoformat(timespec="seconds")

    # 자동 발급 (mock 지연 효과)
    for doc in docs_grouped["auto"]:
        await asyncio.sleep(0.05)  # 시각적 진행 효과용
        documents.append({
            "document_name": doc["name"],
            "required_for": doc["required_for"],
            "source": doc["source"],
            "auto_issued": True,
            "issued_at": now_iso,
            "status": "발급 완료",
            "download_url": f"/mock/docs/{doc['name'].replace(' ', '_')}.pdf",
            "is_mock": True,
        })

    # 본인 지참 안내
    for doc in docs_grouped["bring"]:
        documents.append({
            "document_name": doc["name"],
            "required_for": doc["required_for"],
            "source": doc["source"],
            "auto_issued": False,
            "issued_at": None,
            "status": "본인 지참 필요",
            "download_url": None,
            "is_mock": True,
        })

    # 2. 예약 생성 (각 방문 시설마다)
    reservations: list[dict] = []
    visits = plan.get("visits", [])
    plan_date = plan.get("date", "")

    for visit in visits:
        await asyncio.sleep(0.08)
        facility = visit.get("facility", {})
        ftype = facility.get("type", "")
        channel_label = RESERVATION_CHANNEL.get(ftype, "예약 시스템")
        # 은행은 시설 이름에 은행명 포함되니까 구분되는 channel
        if ftype == "은행":
            channel = f"{facility.get('name', '은행')} 예약"
        else:
            channel = channel_label

        reservations.append({
            "facility_id": facility.get("id", ""),
            "facility_name": facility.get("name", ""),
            "facility_type": ftype,
            "visit_date": plan_date,
            "visit_time": visit.get("arrival_time", ""),
            "reservation_number": _generate_reservation_no(),
            "channel": f"{channel} (데모)",
            "status": "예약 확정",
            "is_mock": True,
        })

    # 3. 요약
    auto_count = sum(1 for d in documents if d["auto_issued"])
    bring_count = sum(1 for d in documents if not d["auto_issued"])
    summary_parts = []
    if auto_count > 0:
        summary_parts.append(f"서류 {auto_count}건 자동 발급")
    if bring_count > 0:
        summary_parts.append(f"본인 지참 {bring_count}건 안내")
    if reservations:
        summary_parts.append(f"행정기관 {len(reservations)}곳 예약 확정")
    summary = " · ".join(summary_parts) if summary_parts else "처리할 항목 없음"

    return {
        "success": True,
        "is_mock": True,
        "summary": summary,
        "documents": documents,
        "reservations": reservations,
        "warnings": [
            "이 응답은 데모용 mock 데이터입니다.",
            "실제 서류 발급 및 행정기관 예약은 진행되지 않습니다.",
            "정식 서비스 시 정부24/홈택스/은행 영업점 API와 연동 필요.",
        ],
        "confirmed_at": now_iso,
    }
