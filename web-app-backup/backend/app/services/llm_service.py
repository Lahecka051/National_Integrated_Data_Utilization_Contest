"""
Google Gemini LLM 서비스
- 자연어 용무 파싱
- 추천 이유 자연어 생성
- 챗봇 대화
모든 함수는 실패시 None 반환 (호출자가 fallback 처리)
"""
import os
import json
import logging
import asyncio
import re

logger = logging.getLogger(__name__)


GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]


async def _call_gemini_with_retry(client, prompt: str, max_retries: int = 3) -> str | None:
    """Gemini API 호출 + 429 에러 시 다른 모델로 폴백, 최종 대기 후 재시도"""
    for model in GEMINI_MODELS:
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                )
                return response.text.strip()
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    wait_match = re.search(r"retryDelay.*?(\d+)", err_str)
                    wait_sec = int(wait_match.group(1)) + 2 if wait_match else 5
                    if attempt < max_retries - 1:
                        logger.info(f"{model} rate limited, waiting {wait_sec}s (attempt {attempt+1})")
                        await asyncio.sleep(wait_sec)
                    else:
                        logger.info(f"{model} quota exhausted, trying next model")
                        break
                else:
                    logger.warning(f"Gemini API 에러 ({model}): {e}")
                    return None
    # 모든 모델 실패 시, 첫 모델로 한 번 더 대기 후 시도
    logger.info("모든 모델 한도 초과, 60초 대기 후 최종 재시도")
    await asyncio.sleep(60)
    try:
        response = client.models.generate_content(
            model=GEMINI_MODELS[0],
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        logger.warning(f"최종 재시도 실패: {e}")
        return None

# Gemini 클라이언트 초기화
_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=api_key)
        return _client
    except Exception as e:
        logger.warning(f"Gemini 클라이언트 초기화 실패: {e}")
        return None


def is_llm_available() -> bool:
    return _get_client() is not None


TASK_CATALOG = """
[용무 목록]
민원실: 전입신고, 주민등록등본 발급, 인감증명서 발급, 여권 신청
은행: 통장 개설, 카드 발급, 대출 상담, 환전
우체국: 등기우편 발송, 택배 발송

[용무별 처리시간 (분)]
전입신고: 10, 주민등록등본 발급: 5, 인감증명서 발급: 5, 여권 신청: 15
통장 개설: 20, 카드 발급: 15, 대출 상담: 30, 환전: 10
등기우편 발송: 10, 택배 발송: 5
"""

TASK_TYPE_MAP = {
    "전입신고": "민원실", "주민등록등본 발급": "민원실", "인감증명서 발급": "민원실", "여권 신청": "민원실",
    "통장 개설": "은행", "카드 발급": "은행", "대출 상담": "은행", "환전": "은행",
    "등기우편 발송": "우체국", "택배 발송": "우체국",
}

TASK_DURATIONS = {
    "전입신고": 10, "주민등록등본 발급": 5, "인감증명서 발급": 5, "여권 신청": 15,
    "통장 개설": 20, "카드 발급": 15, "대출 상담": 30, "환전": 10,
    "등기우편 발송": 10, "택배 발송": 5,
}


async def parse_errands_from_text(text: str) -> list[dict] | None:
    """
    자연어 → 구조화된 용무 리스트 파싱
    반환: [{"task_type": "은행", "task_name": "통장 개설", "estimated_duration": 20}, ...]
    """
    client = _get_client()
    if not client:
        return None

    prompt = f"""당신은 한국의 민원/은행/우체국 용무를 파싱하는 어시스턴트입니다.
사용자의 자연어 입력을 아래 용무 목록에 정확히 매핑하세요.

{TASK_CATALOG}

[매핑 규칙]
- "통장 정리", "통장 만들기" → "통장 개설"
- "서류 떼다", "등본 발급", "주민등록" → "주민등록등본 발급"
- "인감", "인감증명" → "인감증명서 발급"
- "여권", "패스포트" → "여권 신청"
- "카드 만들기", "체크카드" → "카드 발급"
- "돈 빌리기", "대출" → "대출 상담"
- "환전", "달러" → "환전"
- "우편", "등기", "편지" → "등기우편 발송"
- "택배", "소포" → "택배 발송"
- "전입", "이사", "전출" → "전입신고"
- 매핑할 수 없는 용무는 무시하세요.

사용자 입력: {text}

위 목록에 매핑되는 용무만 JSON 배열로 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.
형식: [{{"task_type": "시설유형", "task_name": "용무명", "estimated_duration": 처리시간(분)}}]"""

    try:
        raw = await _call_gemini_with_retry(client, prompt)
        if not raw:
            return None
        # JSON 블록 추출
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()

        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return None

        # 유효성 검증
        valid = []
        for item in parsed:
            task_name = item.get("task_name", "")
            if task_name in TASK_TYPE_MAP:
                valid.append({
                    "task_type": TASK_TYPE_MAP[task_name],
                    "task_name": task_name,
                    "estimated_duration": TASK_DURATIONS.get(task_name, 15),
                })
        return valid if valid else None

    except Exception as e:
        logger.warning(f"용무 파싱 실패: {e}")
        return None


async def generate_recommendation_reason(slot_data: dict) -> str | None:
    """
    추천 슬롯 데이터를 기반으로 자연어 설명 생성
    slot_data: SlotRecommendation.model_dump() 결과
    """
    client = _get_client()
    if not client:
        return None

    visits_summary = []
    for v in slot_data.get("visits", []):
        facility_name = v.get("facility", {}).get("name", "")
        tasks = ", ".join(v.get("task_names", []))
        wait = v.get("wait_time", 0)
        visits_summary.append(f"- {facility_name}: {tasks} (대기 {wait}분)")

    context = f"""추천 정보:
- 날짜: {slot_data.get('date')} {slot_data.get('day_of_week')}
- 반차 유형: {slot_data.get('half_day_type')}
- 날씨: {slot_data.get('weather', {}).get('condition', '맑음')} {slot_data.get('weather', {}).get('temperature', 20)}°C (강수확률 {slot_data.get('weather', {}).get('rain_probability', 0)}%)
- 총 대기시간: {slot_data.get('total_wait_time', 0)}분
- 총 이동시간: {slot_data.get('total_travel_time', 0)}분
- 총 소요시간: {slot_data.get('total_minutes', 0)}분
- 추천 여부: {'추천' if slot_data.get('is_recommended') else '비추천'}

방문 순서:
{chr(10).join(visits_summary)}"""

    prompt = f"""당신은 반차/연차 일정 최적화 서비스의 어시스턴트입니다.
아래 추천 정보를 바탕으로, 왜 이 시간대가 {'좋은지' if slot_data.get('is_recommended') else '좋지 않은지'} 한국어로 2~3문장으로 설명하세요.
구어체로 친근하게 작성하되, 구체적인 수치를 포함하세요.

{context}

설명:"""

    try:
        result = await _call_gemini_with_retry(client, prompt)
        if not result:
            return None
        if len(result) > 200:
            result = result[:197] + "..."
        return result
    except Exception as e:
        logger.warning(f"추천 이유 생성 실패: {e}")
        return None


async def chat_about_recommendation(
    messages: list[dict],
    recommendation_context: dict,
    errands_context: list[dict],
) -> str | None:
    """
    추천 결과에 대한 챗봇 대화
    messages: [{"role": "user"|"assistant", "content": "..."}, ...]
    """
    client = _get_client()
    if not client:
        return None

    visits_summary = []
    for v in recommendation_context.get("visits", []):
        facility = v.get("facility", {})
        tasks = ", ".join(v.get("task_names", []))
        visits_summary.append(
            f"- {v.get('arrival_time', '')} {facility.get('name', '')}: {tasks} "
            f"(대기 {v.get('wait_time', 0)}분, 처리 {v.get('process_time', 0)}분)"
        )

    errands_text = ", ".join(e.get("task_name", "") for e in errands_context)

    system_prompt = f"""당신은 '하루짜기' 반차 일정 최적화 서비스의 AI 어시스턴트입니다.
사용자가 선택한 추천 결과에 대해 친절하게 답변하세요.

[사용자가 등록한 용무] {errands_text}

[선택한 추천 정보]
- 날짜: {recommendation_context.get('date')} {recommendation_context.get('day_of_week')}
- 반차 유형: {recommendation_context.get('half_day_type')}
- 날씨: {recommendation_context.get('weather', {}).get('condition', '맑음')} {recommendation_context.get('weather', {}).get('temperature', 20)}°C
- 총 소요시간: {recommendation_context.get('total_minutes', 0)}분 (대기 {recommendation_context.get('total_wait_time', 0)}분 + 이동 {recommendation_context.get('total_travel_time', 0)}분)

[방문 일정]
{chr(10).join(visits_summary)}

[규칙]
- 한국어로 답변하세요
- 2~4문장으로 간결하게 답변하세요
- 추천 결과와 관련된 질문에만 답하세요
- 관련 없는 질문은 "이 서비스와 관련된 질문을 해주세요"로 안내하세요"""

    # 대화 히스토리 구성
    conversation = f"{system_prompt}\n\n"
    for msg in messages:
        role = "사용자" if msg["role"] == "user" else "어시스턴트"
        conversation += f"{role}: {msg['content']}\n"
    conversation += "어시스턴트:"

    try:
        result = await _call_gemini_with_retry(client, conversation)
        if not result:
            return None
        if len(result) > 500:
            result = result[:497] + "..."
        return result
    except Exception as e:
        logger.warning(f"챗봇 응답 실패: {e}")
        return None


async def consultant_chat(
    messages: list[dict],
    current_errands: list[dict],
    current_time_constraint: dict | None,
) -> dict | None:
    """
    AI 상담사 대화 — 용무 파악, 시간 제약 추출, 추천 트리거까지 대화로 처리.
    반환: {"text": str, "action_type": str, "parsed_errands": list|None,
           "time_constraint": dict|None, "should_recommend": bool}
    """
    client = _get_client()
    if not client:
        return None

    errands_text = "없음"
    if current_errands:
        errands_text = ", ".join(e.get("task_name", "") for e in current_errands)

    tc_text = "없음"
    if current_time_constraint:
        parts = []
        st = current_time_constraint.get('start_time')
        et = current_time_constraint.get('end_time')
        sd = current_time_constraint.get('start_date')
        if st and et:
            parts.append(f"시간: {st}~{et}")
        if sd:
            parts.append(f"날짜: {sd} 이후")
        tc_text = ", ".join(parts) if parts else "없음"

    from datetime import datetime as dt
    today_str = dt.now().strftime("%Y-%m-%d")
    current_year = dt.now().year
    current_month = dt.now().month

    system_prompt = f"""당신은 '하루짜기' 반차 일정 최적화 서비스의 전문 상담사입니다.
사용자와 자연스럽게 대화하며 용무를 파악하고, 시간 제약을 확인한 뒤, 최적 일정을 추천합니다.

{TASK_CATALOG}

[매핑 규칙]
- "통장 정리", "통장 만들기" → "통장 개설"
- "서류 떼다", "등본 발급", "주민등록" → "주민등록등본 발급"
- "인감", "인감증명" → "인감증명서 발급"
- "여권", "패스포트" → "여권 신청"
- "카드 만들기", "체크카드" → "카드 발급"
- "돈 빌리기", "대출" → "대출 상담"
- "환전", "달러" → "환전"
- "우편", "등기", "편지" → "등기우편 발송"
- "택배", "소포" → "택배 발송"
- "전입", "이사", "전출" → "전입신고"

[오늘 날짜] {today_str}

[현재 세션 상태]
- 등록된 용무: {errands_text}
- 시간/날짜 제약: {tc_text}

[대화 규칙]
1. 친근하고 자연스러운 한국어 구어체로 대화하세요 (반말X, 존댓말O)
2. 사용자가 용무를 언급하면 위 목록에서 매핑하여 action으로 반환하세요
3. 사용자가 시간을 언급하면 (예: "2시부터 4시까지 비어", "오후에 시간 돼") 시간 제약을 추출하세요
   - 날짜 제약도 추출하세요 (예: "20일 이후로" → start_date를 "{current_year}-{current_month:02d}-20"으로 설정)
   - "다음주", "이번주 금요일 이후" 등도 적절한 YYYY-MM-DD로 변환하세요
4. **중요: 용무가 새로 파싱되면 should_recommend를 반드시 true로 설정하세요.** 시간 제약 없이도 최적 일정을 먼저 추천하고, 답변에서 "혹시 특정 시간대가 있으시면 알려주시면 더 맞춤 추천해드릴게요!" 같이 시간을 추가로 물어보세요.
5. 사용자가 시간 제약을 알려주면 time_constraint_set과 함께 should_recommend를 true로 설정하여 시간 반영된 재추천을 하세요.
6. 사용자가 직접 추천을 요청해도 should_recommend를 true로 설정하세요
7. 매핑할 수 없는 용무는 "죄송하지만 현재 지원하지 않는 용무예요"라고 안내하세요
8. 답변은 2~3문장으로 간결하게 하세요

[응답 형식] 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.
{{
  "text": "사용자에게 보여줄 자연어 답변",
  "action_type": "errands_parsed" | "time_constraint_set" | "request_recommend" | "none",
  "parsed_errands": [{{"task_type": "시설유형", "task_name": "용무명", "estimated_duration": 처리시간}}] | null,
  "time_constraint": {{"start_time": "HH:MM"|null, "end_time": "HH:MM"|null, "start_date": "YYYY-MM-DD"|null}} | null,
  "should_recommend": false
}}

action_type 설명:
- "errands_parsed": 새로운 용무를 파악했을 때
- "time_constraint_set": 시간 제약을 파악했을 때
- "request_recommend": 추천을 실행해야 할 때 (should_recommend도 true)
- "none": 일반 대화 (인사, 질문 등)"""

    conversation = f"{system_prompt}\n\n"
    for msg in messages:
        role = "사용자" if msg["role"] == "user" else "어시스턴트"
        if msg["role"] == "assistant":
            conversation += f"{role}: {msg['content']}\n"
        else:
            conversation += f"{role}: {msg['content']}\n"
    conversation += "어시스턴트:"

    try:
        raw = await _call_gemini_with_retry(client, conversation)
        if not raw:
            return None

        # JSON 블록 추출
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()

        parsed = json.loads(raw)

        # 용무 유효성 검증
        if parsed.get("parsed_errands"):
            valid_errands = []
            for item in parsed["parsed_errands"]:
                task_name = item.get("task_name", "")
                if task_name in TASK_TYPE_MAP:
                    valid_errands.append({
                        "task_type": TASK_TYPE_MAP[task_name],
                        "task_name": task_name,
                        "estimated_duration": TASK_DURATIONS.get(task_name, 15),
                    })
            parsed["parsed_errands"] = valid_errands if valid_errands else None
            if not valid_errands:
                parsed["action_type"] = "none"

        # 시간/날짜 제약 유효성 검증
        if parsed.get("time_constraint"):
            tc = parsed["time_constraint"]
            has_valid = False
            # 시간 제약 검증
            st = tc.get("start_time")
            et = tc.get("end_time")
            if st and et and st != "null" and et != "null":
                try:
                    sh, sm = map(int, st.split(":"))
                    eh, em = map(int, et.split(":"))
                    if 9 <= sh <= 18 and 9 <= eh <= 18 and sh * 60 + sm < eh * 60 + em:
                        has_valid = True
                    else:
                        tc["start_time"] = None
                        tc["end_time"] = None
                except (ValueError, KeyError):
                    tc["start_time"] = None
                    tc["end_time"] = None
            else:
                tc["start_time"] = None
                tc["end_time"] = None
            # 날짜 제약 검증
            sd = tc.get("start_date")
            if sd and sd != "null":
                try:
                    dt.strptime(sd, "%Y-%m-%d")
                    has_valid = True
                except ValueError:
                    tc["start_date"] = None
            else:
                tc["start_date"] = None
            if not has_valid:
                parsed["time_constraint"] = None
                if parsed.get("action_type") == "time_constraint_set":
                    parsed["action_type"] = "none"

        return parsed

    except Exception as e:
        logger.warning(f"상담사 챗봇 응답 실패: {e}")
        return None
