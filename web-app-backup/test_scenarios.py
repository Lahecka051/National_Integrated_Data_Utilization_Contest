"""AI 상담사 챗봇 시나리오 테스트"""
import sys
sys.path.insert(0, "backend")
from dotenv import load_dotenv
load_dotenv(".env")
import asyncio
from app.services.llm_service import consultant_chat

SEP = "=" * 60


async def run_scenario(name, messages, errands, tc):
    print(f"\n{SEP}")
    print(f"[시나리오] {name}")
    print(SEP)
    for m in messages:
        if m["role"] == "user":
            print(f"  사용자: {m['content']}")

    r = await consultant_chat(messages, errands, tc)
    if r:
        print(f"  ---")
        print(f"  AI 답변: {r.get('text', '')[:200]}")
        print(f"  action: {r.get('action_type')} | recommend: {r.get('should_recommend')}")
        if r.get("parsed_errands"):
            names = [e["task_name"] for e in r["parsed_errands"]]
            print(f"  파싱된 용무: {names}")
        if r.get("time_constraint"):
            print(f"  시간제약: {r.get('time_constraint')}")
        result = "PASS"
    else:
        print(f"  FAILED - 응답 없음")
        result = "FAIL"
    print(f"  결과: {result}")
    return r


async def main():
    results = []

    # 시나리오 1: 여러 용무를 한번에 말하는 경우
    r = await run_scenario(
        "1. 여러 용무 한번에 입력",
        [
            {"role": "assistant", "content": "안녕하세요! 하루짜기 일정 상담사입니다."},
            {"role": "user", "content": "은행 가서 통장 만들고 주민센터에서 전입신고도 해야 해요"},
        ],
        [], None,
    )
    ok = r and r.get("parsed_errands") and len(r["parsed_errands"]) >= 2
    results.append(("1. 여러 용무 한번에", "PASS" if ok else "FAIL",
                     "2개 이상 파싱" if ok else "파싱 실패"))
    await asyncio.sleep(2)

    # 시나리오 2: 애매한 시간 표현 사용
    r = await run_scenario(
        "2. 애매한 시간 표현 (오전중에 시간 돼)",
        [
            {"role": "assistant", "content": "안녕하세요!"},
            {"role": "user", "content": "택배 보내야 하는데 오전중에만 시간이 돼요"},
        ],
        [], None,
    )
    has_errand = r and r.get("parsed_errands")
    results.append(("2. 애매한 시간 + 용무", "PASS" if has_errand else "FAIL",
                     f"용무: {r.get('parsed_errands') if r else 'N/A'}"))
    await asyncio.sleep(2)

    # 시나리오 3: 지원하지 않는 용무 포함
    r = await run_scenario(
        "3. 지원하지 않는 용무 (병원) + 지원 용무 (환전)",
        [
            {"role": "assistant", "content": "안녕하세요!"},
            {"role": "user", "content": "병원 예약이랑 은행 환전 좀 해야해요"},
        ],
        [], None,
    )
    # 환전만 파싱되고 병원은 무시되어야 함
    ok = r and r.get("parsed_errands")
    parsed_names = [e["task_name"] for e in r["parsed_errands"]] if ok else []
    has_exchange = "환전" in parsed_names
    no_hospital = "병원" not in str(parsed_names)
    results.append(("3. 미지원 용무 처리", "PASS" if has_exchange and no_hospital else "FAIL",
                     f"파싱: {parsed_names}"))
    await asyncio.sleep(2)

    # 시나리오 4: 기존 추천 후 시간 변경 요청
    r = await run_scenario(
        "4. 기존 추천 후 시간 변경 요청",
        [
            {"role": "assistant", "content": "안녕하세요!"},
            {"role": "user", "content": "대출 상담 받아야 해요"},
            {"role": "assistant", "content": "네, 대출 상담으로 등록했어요!"},
            {"role": "user", "content": "아 근데 오후 3시 이후로만 가능해요"},
        ],
        [{"task_type": "은행", "task_name": "대출 상담", "estimated_duration": 30}],
        None,
    )
    has_tc = r and r.get("time_constraint")
    should_rec = r and r.get("should_recommend")
    results.append(("4. 시간 변경 + 재추천", "PASS" if has_tc and should_rec else "FAIL",
                     f"tc: {r.get('time_constraint') if r else 'N/A'}, recommend: {should_rec}"))
    await asyncio.sleep(2)

    # 시나리오 5: 용무 추가 요청
    r = await run_scenario(
        "5. 기존 용무에 추가 요청",
        [
            {"role": "assistant", "content": "안녕하세요!"},
            {"role": "user", "content": "여권 신청해야 해요"},
            {"role": "assistant", "content": "네 여권 신청 등록했어요!"},
            {"role": "user", "content": "아 그리고 우체국에서 등기도 보내야 해요"},
        ],
        [{"task_type": "민원실", "task_name": "여권 신청", "estimated_duration": 15}],
        None,
    )
    ok = r and r.get("parsed_errands")
    parsed_names = [e["task_name"] for e in r["parsed_errands"]] if ok else []
    has_mail = "등기우편 발송" in parsed_names
    results.append(("5. 용무 추가", "PASS" if has_mail else "FAIL",
                     f"추가 파싱: {parsed_names}"))

    # 최종 결과 요약
    print(f"\n\n{'='*60}")
    print("[ 최종 테스트 결과 ]")
    print("=" * 60)
    for name, status, detail in results:
        icon = "O" if status == "PASS" else "X"
        print(f"  [{icon}] {name}: {status} - {detail}")

    passed = sum(1 for _, s, _ in results if s == "PASS")
    print(f"\n  통과: {passed}/5")


asyncio.run(main())
