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


async def trip_consultant_chat(
    messages: list[dict],
    current_state: dict,
) -> dict | None:
    """
    출장 여행 AI 상담사 대화.

    사용자 자연어에서 다음을 파싱:
      - destination (목적지 도시/역명)
      - date (YYYY-MM-DD)
      - earliest_departure (HH:MM)
      - parking_preference ("near_hub" | "near_home")
      - modes (["train", "expbus"])

    반환:
      {
        "text": str,
        "action_type": "info_parsed" | "request_recommend" | "none",
        "parsed_fields": dict | None,
        "should_recommend": bool,
      }
    """
    client = _get_client()
    if not client:
        return None

    from datetime import datetime as dt
    today = dt.now()
    today_str = today.strftime("%Y-%m-%d")
    weekday_kr = ["월", "화", "수", "목", "금", "토", "일"][today.weekday()]

    # 현재 상태를 텍스트로
    state_parts = []
    if current_state.get("destination"):
        state_parts.append(f"목적지: {current_state['destination']}")
    if current_state.get("date"):
        state_parts.append(f"출발일: {current_state['date']}")
    if current_state.get("earliest_departure"):
        state_parts.append(f"출발 희망시각: {current_state['earliest_departure']} 이후")
    if current_state.get("parking_preference"):
        pp = "출발역 근처" if current_state["parking_preference"] == "near_hub" else "현재 위치 근처"
        state_parts.append(f"주차장 위치: {pp}")
    if current_state.get("modes"):
        modes_kr = []
        if "train" in current_state["modes"]:
            modes_kr.append("기차")
        if "expbus" in current_state["modes"]:
            modes_kr.append("고속버스")
        state_parts.append(f"교통수단: {', '.join(modes_kr)}")
    state_text = " / ".join(state_parts) if state_parts else "없음"

    system_prompt = f"""당신은 '하루짜기' 출장 여행 플래너의 전문 상담사입니다.
출장자가 자연어로 말하는 내용을 분석해 목적지, 날짜, 시간, 주차 선호, 교통수단을 파악하고 최적 플랜을 추천합니다.

[오늘 날짜] {today_str} ({weekday_kr}요일)

[현재까지 파악된 정보]
{state_text}

[대화 규칙]
1. 친근하고 자연스러운 한국어 구어체 존댓말 사용 (반말X)
2. 사용자가 목적지·날짜·시간을 언급하면 즉시 parsed_fields로 추출하세요
3. "다음 주 수요일", "내일", "4/15", "이번 주 금요일" 등 상대/절대 날짜를 모두 YYYY-MM-DD로 변환
4. "오전 9시", "아침 일찍", "9시 이후" → earliest_departure를 HH:MM 형식으로
5. "차를 역에 주차" / "집 근처에 주차" → parking_preference 결정
   - 기본값은 "near_hub" (출발역 근처 주차)
6. "기차로" / "버스로" 언급 → modes 결정
   - 둘 다 언급 없으면 기본 ["train", "expbus"] (둘 다)
7. **중요**: **destination과 date가 모두 파악되면 should_recommend를 반드시 true로 설정**하세요.
   - earliest_departure가 없으면 기본 "08:00" 사용
   - 답변에서 "혹시 출발 시각을 지정하고 싶으시면 알려주세요" 같이 추가 질문 가능
8. destination이 없으면 "어디로 가시나요?" 질문
9. date가 없으면 "언제 가시나요?" 질문
10. 답변은 2~3문장으로 간결하게

[목적지 파싱 힌트]
- "부산", "부산역", "부산 출장" → destination="부산"
- "강남", "서울 강남", "KTX 타고 서울" → destination="서울"
- "대전 컨퍼런스" → destination="대전"
- 역 이름이 직접 나오면 그대로 (예: "동대구역" → destination="대구")

[응답 형식] 반드시 아래 JSON만 출력. 다른 텍스트 없이 JSON만.
{{
  "text": "사용자에게 보여줄 자연어 답변 (2~3문장)",
  "action_type": "info_parsed" | "request_recommend" | "none",
  "parsed_fields": {{
    "destination": "목적지" | null,
    "date": "YYYY-MM-DD" | null,
    "earliest_departure": "HH:MM" | null,
    "parking_preference": "near_hub" | "near_home" | null,
    "modes": ["train", "expbus"] | null
  }} | null,
  "should_recommend": false
}}

action_type 설명:
- "info_parsed": 새로운 정보를 파악했지만 아직 추천 못할 때 (destination 또는 date 누락)
- "request_recommend": destination + date 모두 있을 때 (should_recommend=true)
- "none": 일반 대화"""

    conversation = f"{system_prompt}\n\n"
    for msg in messages:
        role = "사용자" if msg["role"] == "user" else "어시스턴트"
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

        # parsed_fields 유효성 검증
        if parsed.get("parsed_fields"):
            pf = parsed["parsed_fields"]

            # 날짜 검증
            if pf.get("date"):
                try:
                    dt.strptime(pf["date"], "%Y-%m-%d")
                except (ValueError, TypeError):
                    pf["date"] = None

            # 시각 검증
            if pf.get("earliest_departure"):
                try:
                    h, m = map(int, pf["earliest_departure"].split(":"))
                    if not (0 <= h <= 23 and 0 <= m <= 59):
                        pf["earliest_departure"] = None
                except (ValueError, TypeError, AttributeError):
                    pf["earliest_departure"] = None

            # parking_preference 검증
            if pf.get("parking_preference") not in ("near_hub", "near_home", None):
                pf["parking_preference"] = None

            # modes 검증
            if pf.get("modes"):
                if isinstance(pf["modes"], list):
                    pf["modes"] = [m for m in pf["modes"] if m in ("train", "expbus")]
                    if not pf["modes"]:
                        pf["modes"] = None
                else:
                    pf["modes"] = None

            # destination 정리
            if pf.get("destination"):
                pf["destination"] = str(pf["destination"]).strip() or None

        return parsed

    except Exception as e:
        logger.warning(f"출장 상담사 챗봇 응답 실패: {e}")
        return None


async def unified_consultant_chat(
    messages: list[dict],
    current_errands: list[dict],
    current_time_constraint: dict | None,
    current_trip_state: dict | None,
) -> dict | None:
    """
    통합 AI 상담사 — 반차 모드 + 출장 모드를 하나의 대화로 처리.

    사용자 자연어에서 의도를 감지해:
      - 반차 모드: 용무(민원/은행/우체국) + 시간 제약 파싱 → 반차 추천
      - 출장 모드: 목적지 + 날짜 + 시간 + 주차/교통수단 파싱 → 출장 플랜 추천

    반환:
      {
        "text": str,
        "intent": "half_day" | "business_trip" | "none",
        "action_type": "errands_parsed" | "time_constraint_set" | "request_recommend"
                       | "trip_info_parsed" | "trip_request_recommend" | "none",
        "parsed_errands": [...] | None,
        "time_constraint": {...} | None,
        "trip_fields": {...} | None,
        "should_recommend": bool,
      }
    """
    client = _get_client()
    if not client:
        return None

    from datetime import datetime as dt, timedelta
    today = dt.now()
    today_str = today.strftime("%Y-%m-%d")
    weekday_kr = ["월", "화", "수", "목", "금", "토", "일"][today.weekday()]
    current_year = today.year
    current_month = today.month

    # 날짜 예시 힌트 생성 (상대 날짜 변환 오류 방지)
    this_week_start = today - timedelta(days=today.weekday())   # 이번 주 월요일
    next_week_start = this_week_start + timedelta(days=7)
    tomorrow = today + timedelta(days=1)
    date_hints = []
    date_hints.append(f"오늘={today.strftime('%Y-%m-%d')} ({weekday_kr})")
    date_hints.append(f"내일={tomorrow.strftime('%Y-%m-%d')}")
    # 이번주 / 다음주 각 요일
    wd_names = ["월", "화", "수", "목", "금", "토", "일"]
    for i, name in enumerate(wd_names):
        tw = this_week_start + timedelta(days=i)
        nw = next_week_start + timedelta(days=i)
        date_hints.append(f"이번주 {name}요일={tw.strftime('%Y-%m-%d')}")
        date_hints.append(f"다음주 {name}요일={nw.strftime('%Y-%m-%d')}")
    date_hints_text = "\n".join(f"  - {h}" for h in date_hints)

    # 반차 상태
    errands_text = "없음"
    if current_errands:
        errands_text = ", ".join(e.get("task_name", "") for e in current_errands)

    tc_text = "없음"
    if current_time_constraint:
        parts = []
        st = current_time_constraint.get("start_time")
        et = current_time_constraint.get("end_time")
        sd = current_time_constraint.get("start_date")
        if st and et:
            parts.append(f"시간: {st}~{et}")
        if sd:
            parts.append(f"날짜: {sd} 이후")
        tc_text = ", ".join(parts) if parts else "없음"

    # 출장 상태
    trip_state_text = "없음"
    if current_trip_state:
        tps = []
        if current_trip_state.get("destination"):
            tps.append(f"목적지: {current_trip_state['destination']}")
        if current_trip_state.get("date"):
            tps.append(f"출발일: {current_trip_state['date']}")
        if current_trip_state.get("earliest_departure"):
            tps.append(f"출발 희망: {current_trip_state['earliest_departure']} 이후")
        if current_trip_state.get("parking_preference"):
            pp = "출발역 근처" if current_trip_state["parking_preference"] == "near_hub" else "현재 위치 근처"
            tps.append(f"주차: {pp}")
        if current_trip_state.get("modes"):
            modes_kr = []
            if "train" in current_trip_state["modes"]:
                modes_kr.append("기차")
            if "expbus" in current_trip_state["modes"]:
                modes_kr.append("고속버스")
            tps.append(f"교통: {', '.join(modes_kr)}")
        trip_state_text = " / ".join(tps) if tps else "없음"

    system_prompt = f"""당신은 '하루짜기' 서비스의 통합 AI 상담사입니다.
사용자 요청을 분석해 두 가지 모드 중 적절한 것을 자동 선택하고 처리합니다.

[오늘 날짜] {today_str} ({weekday_kr}요일)

[모드 1: 반차 모드]
직장인의 민원실/은행/우체국 업무를 반차/연차 중에 효율적으로 처리하는 일정 추천

{TASK_CATALOG}

[반차 모드 용무 매핑]
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

[모드 2: 출장 모드]
차량을 공공주차장에 세우고 기차/고속버스로 출장 가는 사용자에게
주차장 + 출발역/터미널 + 기차/버스편을 추천

출장 모드는 다음을 파싱:
- destination: 목적지 도시명 또는 역명 (예: "부산", "대전", "동대구역")
- date: YYYY-MM-DD (오늘/내일/다음 주 수요일 같은 표현 변환)
- earliest_departure: HH:MM (출발 희망 시각)
- parking_preference: "near_hub" (출발역 근처) | "near_home" (현재 위치 근처)
- modes: ["train", "expbus"] 중 하나 또는 둘 다

[의도 감지 규칙 — 중요]
다음 중 하나라도 해당하면 출장 모드(business_trip):
- "출장" 언급
- 다른 도시 이름 언급 (부산, 대전, 대구, 광주, 울산, 강릉, 전주, 포항 등)
- "기차", "KTX", "SRT", "무궁화", "고속버스", "고속터미널", "버스 타고" 언급
- 목적지로 이동하려는 의도 (예: "다음 주 제주 가요")

다음 중 하나라도 해당하면 반차 모드(half_day):
- 용무 목록에 있는 작업 언급 (통장, 여권, 등본, 등기 등)
- 민원실/은행/우체국 언급
- "반차", "연차" 언급
- 비는 시간대 언급 (예: "오후에 시간 비어요")

둘 다 해당하면 더 구체적인 쪽을 선택. 불분명하면 intent="none"으로 두고 친근하게 되묻기.

[현재 세션 상태]
[반차] 등록된 용무: {errands_text}
[반차] 시간/날짜 제약: {tc_text}
[출장] 상태: {trip_state_text}

[날짜 변환표 — 반드시 이 값을 사용하세요]
{date_hints_text}

[대화 규칙]
1. 친근하고 자연스러운 한국어 존댓말 (반말X)
2. **반차 모드**: 용무 파싱되면 즉시 should_recommend=true로 추천. 시간 제약 있으면 같이 처리.
3. **출장 모드 — 매우 중요**:
   - destination과 date가 **둘 다 채워지면 무조건 should_recommend=true**로 설정하고 action_type="trip_request_recommend"로 출력하세요.
   - earliest_departure, parking_preference, modes는 없어도 기본값으로 추천 가능 — 절대 이것들 물어보며 멈추지 마세요.
   - destination만 있고 date가 없으면 action_type="trip_info_parsed"로 두고 date만 질문.
   - date만 있고 destination이 없으면 action_type="trip_info_parsed"로 두고 destination만 질문.
4. 상대 날짜 변환은 반드시 위의 [날짜 변환표]만 참조. 절대 스스로 계산하지 마세요.
   - "다음 주 수요일" → 날짜 변환표의 "다음주 수요일" 값 사용
   - "내일" → 날짜 변환표의 "내일" 값 사용
5. 답변은 2~3문장으로 간결하게

[응답 형식] 반드시 아래 JSON만 출력. 다른 텍스트 없이 JSON만.
{{
  "text": "사용자에게 보여줄 답변",
  "intent": "half_day" | "business_trip" | "none",
  "action_type": "errands_parsed" | "time_constraint_set" | "request_recommend" | "trip_info_parsed" | "trip_request_recommend" | "none",
  "parsed_errands": [{{"task_type": "시설유형", "task_name": "용무명", "estimated_duration": 처리시간}}] | null,
  "time_constraint": {{"start_time": "HH:MM"|null, "end_time": "HH:MM"|null, "start_date": "YYYY-MM-DD"|null}} | null,
  "trip_fields": {{"destination": "..."|null, "date": "YYYY-MM-DD"|null, "earliest_departure": "HH:MM"|null, "parking_preference": "near_hub"|"near_home"|null, "modes": ["train","expbus"]|null}} | null,
  "should_recommend": false
}}

action_type 가이드:
- 반차 모드에서 용무 파싱 → "errands_parsed" (+should_recommend=true)
- 반차 모드에서 시간만 언급 → "time_constraint_set" (+should_recommend=true if 용무도 있음)
- 반차 모드 추천 실행 → "request_recommend"
- 출장 모드에서 정보 일부만 파싱 → "trip_info_parsed"
- 출장 모드에서 dest+date 완비 → "trip_request_recommend" (+should_recommend=true)
- 일반 대화/인사 → "none" """

    conversation = f"{system_prompt}\n\n"
    for msg in messages:
        role = "사용자" if msg["role"] == "user" else "어시스턴트"
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

        # === 반차 용무 검증 ===
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

        # === 반차 시간/날짜 제약 검증 ===
        if parsed.get("time_constraint"):
            tc = parsed["time_constraint"]
            has_valid = False
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

        # === 출장 필드 검증 ===
        if parsed.get("trip_fields"):
            tf = parsed["trip_fields"]
            # 날짜 검증
            if tf.get("date"):
                try:
                    dt.strptime(tf["date"], "%Y-%m-%d")
                except (ValueError, TypeError):
                    tf["date"] = None
            # 시각 검증
            if tf.get("earliest_departure"):
                try:
                    h, m = map(int, tf["earliest_departure"].split(":"))
                    if not (0 <= h <= 23 and 0 <= m <= 59):
                        tf["earliest_departure"] = None
                except (ValueError, TypeError, AttributeError):
                    tf["earliest_departure"] = None
            # parking 검증
            if tf.get("parking_preference") not in ("near_hub", "near_home", None):
                tf["parking_preference"] = None
            # modes 검증
            if tf.get("modes"):
                if isinstance(tf["modes"], list):
                    tf["modes"] = [m for m in tf["modes"] if m in ("train", "expbus")]
                    if not tf["modes"]:
                        tf["modes"] = None
                else:
                    tf["modes"] = None
            if tf.get("destination"):
                tf["destination"] = str(tf["destination"]).strip() or None
            # 전부 비어있으면 None
            if not any(tf.get(k) for k in ("destination", "date", "earliest_departure", "parking_preference", "modes")):
                parsed["trip_fields"] = None

        return parsed

    except Exception as e:
        logger.warning(f"통합 상담사 챗봇 응답 실패: {e}")
        return None
