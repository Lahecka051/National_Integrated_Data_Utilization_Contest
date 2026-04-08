/**
 * LLM 통합 상담사 서비스 (TS 포팅)
 */
import { callGeminiWithRetry, extractJson, isLlmAvailable } from '../external/geminiApi'

const TASK_CATALOG = `
[용무 목록]
민원실: 전입신고, 주민등록등본 발급, 인감증명서 발급, 여권 신청
은행: 통장 개설, 카드 발급, 대출 상담, 환전
우체국: 등기우편 발송, 택배 발송

[용무별 처리시간 (분)]
전입신고: 10, 주민등록등본 발급: 5, 인감증명서 발급: 5, 여권 신청: 15
통장 개설: 20, 카드 발급: 15, 대출 상담: 30, 환전: 10
등기우편 발송: 10, 택배 발송: 5
`

const TASK_TYPE_MAP: Record<string, string> = {
  '전입신고': '민원실', '주민등록등본 발급': '민원실', '인감증명서 발급': '민원실', '여권 신청': '민원실',
  '통장 개설': '은행', '카드 발급': '은행', '대출 상담': '은행', '환전': '은행',
  '등기우편 발송': '우체국', '택배 발송': '우체국',
}

const TASK_DURATIONS: Record<string, number> = {
  '전입신고': 10, '주민등록등본 발급': 5, '인감증명서 발급': 5, '여권 신청': 15,
  '통장 개설': 20, '카드 발급': 15, '대출 상담': 30, '환전': 10,
  '등기우편 발송': 10, '택배 발송': 5,
}

function buildDateHints(): string {
  const today = new Date()
  const weekdayIdx = (today.getDay() + 6) % 7   // Mon=0
  const wdNames = ['월', '화', '수', '목', '금', '토', '일']
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(today.getDate() - weekdayIdx)
  const nextWeekStart = new Date(thisWeekStart)
  nextWeekStart.setDate(thisWeekStart.getDate() + 7)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const hints: string[] = []
  hints.push(`오늘=${fmt(today)} (${wdNames[weekdayIdx]})`)
  hints.push(`내일=${fmt(tomorrow)}`)
  for (let i = 0; i < 7; i++) {
    const tw = new Date(thisWeekStart); tw.setDate(thisWeekStart.getDate() + i)
    const nw = new Date(nextWeekStart); nw.setDate(nextWeekStart.getDate() + i)
    hints.push(`이번주 ${wdNames[i]}요일=${fmt(tw)}`)
    hints.push(`다음주 ${wdNames[i]}요일=${fmt(nw)}`)
  }
  return hints.map(h => `  - ${h}`).join('\n')
}

function stateToText(errands: any[]): string {
  if (!errands || errands.length === 0) return '없음'
  return errands.map(e => e.task_name || '').filter(Boolean).join(', ')
}

function tcToText(tc: any): string {
  if (!tc) return '없음'
  const parts: string[] = []
  if (tc.start_time && tc.end_time) parts.push(`시간: ${tc.start_time}~${tc.end_time}`)
  if (tc.date) parts.push(`날짜: ${tc.date}`)
  if (tc.start_date) parts.push(`날짜: ${tc.start_date} 이후`)
  return parts.length > 0 ? parts.join(', ') : '없음'
}

function tripStateToText(state: any): string {
  if (!state) return '없음'
  const parts: string[] = []
  if (state.destination) parts.push(`목적지: ${state.destination}`)
  if (state.date) parts.push(`출발일: ${state.date}`)
  if (state.earliest_departure) parts.push(`출발 희망: ${state.earliest_departure} 이후`)
  if (state.parking_preference) {
    parts.push(`주차: ${state.parking_preference === 'near_hub' ? '출발역 근처' : '현재 위치 근처'}`)
  }
  if (state.modes && state.modes.length > 0) {
    const labels = state.modes.map((m: string) => m === 'train' ? '기차' : '고속버스')
    parts.push(`교통: ${labels.join(', ')}`)
  }
  return parts.length > 0 ? parts.join(' / ') : '없음'
}

export interface UnifiedResult {
  text: string
  intent: 'half_day' | 'business_trip' | 'none'
  action_type: string
  parsed_errands: any[] | null
  time_constraint: any | null
  trip_fields: any | null
  should_recommend: boolean
}

export async function unifiedConsultantChat(
  messages: { role: string; content: string }[],
  currentErrands: any[],
  currentTimeConstraint: any | null,
  currentTripState: any | null,
): Promise<UnifiedResult | null> {
  if (!isLlmAvailable()) return null

  const today = new Date()
  const wdNames = ['월', '화', '수', '목', '금', '토', '일']
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const weekdayKr = wdNames[(today.getDay() + 6) % 7]

  const errandsText = stateToText(currentErrands)
  const tcText = tcToText(currentTimeConstraint)
  const tripStateText = tripStateToText(currentTripState)
  const dateHintsText = buildDateHints()

  const systemPrompt = `당신은 '반차출장플랜' 서비스의 통합 AI 상담사입니다.
사용자 요청을 분석해 두 가지 모드 중 적절한 것을 자동 선택하고 처리합니다.

[오늘 날짜] ${todayStr} (${weekdayKr}요일)

[모드 1: 반차 모드]
직장인의 민원실/은행/우체국 업무를 반차/연차 중에 효율적으로 처리하는 일정 추천

${TASK_CATALOG}

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
차량 또는 대중교통으로 기차역/터미널까지 가서 기차/고속버스로 출장 가는 사용자에게
이동수단 + 출발역/터미널 + 기차/버스편을 추천

출장 모드는 다음을 파싱:
- destination: 목적지 도시명 또는 역명 (예: "부산", "대전", "동대구역")
- date: YYYY-MM-DD (오늘/내일/다음 주 수요일 같은 표현 변환)
- earliest_departure: HH:MM (출발 희망 시각)
- parking_preference: "near_hub" | "near_home" (차량 모드일 때만 의미)
- modes: ["train", "expbus"] 중 하나 또는 둘 다 (도시간 이동 수단)
- access_mode: "drive" | "transit" — 출발지에서 출발 기차역/터미널까지의 이동 수단
  - "drive": 자가용으로 가서 공공주차장에 주차 (기본값)
  - "transit": 지하철/시내버스 같은 대중교통으로 이동 (주차장 사용 안 함)

[access_mode 파싱 힌트]
- "차 안 끌고", "차 두고", "지하철로", "지하철 타고", "버스로" (도시간 고속버스가 아니라 시내버스 의미일 때),
  "대중교통으로", "버스나 지하철로" → access_mode = "transit"
- "차 끌고", "운전해서", "차로 가서", "주차하고" → access_mode = "drive"
- **명시 없으면 access_mode = null (반드시 null, 기본값 넣지 말 것)** — 시스템이 카드로 사용자에게 직접 물어봄

[의도 감지 규칙]
다음 중 하나라도 해당하면 출장 모드(business_trip):
- "출장" 언급
- 다른 도시 이름 언급 (부산, 대전, 대구, 광주, 울산, 강릉, 전주, 포항 등)
- "기차", "KTX", "SRT", "고속버스", "터미널" 언급

다음 중 하나라도 해당하면 반차 모드(half_day):
- 용무 목록에 있는 작업 언급 (통장, 여권, 등본, 등기 등)
- 민원실/은행/우체국 언급
- "반차", "연차" 언급
- 비는 시간대 언급

[현재 세션 상태]
[반차] 등록된 용무: ${errandsText}
[반차] 시간/날짜 제약: ${tcText}
[출장] 상태: ${tripStateText}

[날짜 변환표 — 반드시 이 값을 사용하세요]
${dateHintsText}

[반차 모드 시설 운영시간 — 매우 중요]
- 민원실: 평일(월~금) 09:00 ~ 18:00 (토/일/공휴일 휴무)
- 은행: 평일(월~금) 09:00 ~ 16:00 (토/일/공휴일 휴무)
- 우체국: 평일(월~금) 09:00 ~ 18:00 (토/일/공휴일 휴무)
- 한국 공휴일 예: 1/1, 3/1, 5/5, 6/6, 8/15, 10/3, 10/9, 12/25, 설날, 추석

[운영 외 요청 처리 — 매우 중요]
사용자가 다음과 같은 운영 불가 시점에 용무를 요청하면, **반드시 추천을 거절하고 이유를 설명**하세요:
  - 토요일/일요일 (모든 시설 휴무)
  - 공휴일 (모든 시설 휴무)
  - 평일이지만 운영시간 외

이 경우:
  1. parsed_errands 파싱은 정상 수행
  2. **should_recommend = false** (절대 true 금지)
  3. action_type = "none"
  4. text에 "OO일(요일)은 XX이 운영하지 않습니다" + 가까운 평일 대안 제시

[정확한 날짜 처리 vs 범위]
- 특정 1일 → time_constraint.date에 YYYY-MM-DD
- 범위/이후 → time_constraint.start_date에 YYYY-MM-DD

[대화 규칙]
1. 친근한 한국어 존댓말
2. 반차: 용무 파싱 + 운영 가능 시점이면 should_recommend=true
3. **출장 필수 필드**: destination + date + access_mode
   - 이 3개가 모두 채워지면 should_recommend=true
   - destination 또는 date 하나라도 부족 → 자연스럽게 해당 정보만 질문 ("어느 도시로 출장 가세요?", "언제 출발하세요?")
   - access_mode는 사용자가 언급("차로", "대중교통으로" 등)하지 않은 경우 **절대 기본값 넣지 말고 null 유지** — 시스템이 자동으로 카드를 띄워 사용자가 고름
   - **도착지는 반드시 기차역 또는 버스터미널**이어야 함. 사용자가 지역명(예: "부산", "해운대")이나 역명(예: "부산역")을 말하면 destination에 그대로 담고 should_recommend=true로 설정. 시스템이 자동으로 해당 지역의 기차역·터미널 후보 목록을 카드로 제시해 사용자에게 선택받음.
4. **출장 선택 필드 안내 규칙**:
   - 선택 필드: earliest_departure, modes, parking_preference
   - 선택 필드 기본값: earliest_departure="08:00", modes=["train","expbus"] (둘 다 고려), parking_preference="near_hub"
   - **필수 필드가 다 채워졌지만 선택 필드 중 누락된 항목이 있는 경우**: 답변에 "출발 시각, 교통수단, 주차 위치 등을 추가로 알려주시면 더 정확하게 추천해드릴 수 있어요" 같은 한 문장 안내를 포함 (추천은 그대로 진행)
   - **모든 필드(필수+선택)가 다 채워진 경우**: 추가 질문이나 안내 없이 결과만 간단히 언급 (예: "추천 플랜을 찾아드릴게요!")
5. 상대 날짜 변환은 반드시 위 [날짜 변환표]만 참조
6. 답변 2~3문장

[응답 형식 — JSON만 출력]
{
  "text": "...",
  "intent": "half_day" | "business_trip" | "none",
  "action_type": "errands_parsed" | "time_constraint_set" | "request_recommend" | "trip_info_parsed" | "trip_request_recommend" | "none",
  "parsed_errands": [{"task_type": "...", "task_name": "...", "estimated_duration": N}] | null,
  "time_constraint": {"start_time": "HH:MM"|null, "end_time": "HH:MM"|null, "date": "YYYY-MM-DD"|null, "start_date": "YYYY-MM-DD"|null} | null,
  "trip_fields": {"destination": "..."|null, "date": "YYYY-MM-DD"|null, "earliest_departure": "HH:MM"|null, "parking_preference": "near_hub"|"near_home"|null, "modes": ["train","expbus"]|null, "access_mode": "drive"|"transit"|null} | null,
  "should_recommend": false
}`

  let conversation = `${systemPrompt}\n\n`
  for (const msg of messages) {
    const role = msg.role === 'user' ? '사용자' : '어시스턴트'
    conversation += `${role}: ${msg.content}\n`
  }
  conversation += '어시스턴트:'

  try {
    const raw = await callGeminiWithRetry(conversation)
    if (!raw) return null
    const parsed: any = extractJson(raw)

    // 반차 용무 검증
    if (parsed.parsed_errands) {
      const valid: any[] = []
      for (const item of parsed.parsed_errands) {
        const name = item.task_name || ''
        if (name in TASK_TYPE_MAP) {
          valid.push({
            task_type: TASK_TYPE_MAP[name],
            task_name: name,
            estimated_duration: TASK_DURATIONS[name] || 15,
          })
        }
      }
      parsed.parsed_errands = valid.length > 0 ? valid : null
    }

    // 시간 제약 검증
    if (parsed.time_constraint) {
      const tc = parsed.time_constraint
      let hasValid = false

      const st = tc.start_time, et = tc.end_time
      if (st && et && st !== 'null' && et !== 'null') {
        try {
          const [sh, sm] = String(st).split(':').map(Number)
          const [eh, em] = String(et).split(':').map(Number)
          if (sh >= 9 && sh <= 18 && eh >= 9 && eh <= 18 && sh * 60 + sm < eh * 60 + em) {
            hasValid = true
          } else {
            tc.start_time = null; tc.end_time = null
          }
        } catch {
          tc.start_time = null; tc.end_time = null
        }
      } else {
        tc.start_time = null; tc.end_time = null
      }

      if (tc.date && tc.date !== 'null') {
        if (!isNaN(new Date(tc.date + 'T00:00:00').getTime())) hasValid = true
        else tc.date = null
      } else {
        tc.date = null
      }

      if (tc.start_date && tc.start_date !== 'null') {
        if (!isNaN(new Date(tc.start_date + 'T00:00:00').getTime())) hasValid = true
        else tc.start_date = null
      } else {
        tc.start_date = null
      }

      if (!hasValid) parsed.time_constraint = null
    }

    // 출장 필드 검증
    if (parsed.trip_fields) {
      const tf = parsed.trip_fields
      if (tf.date) {
        if (isNaN(new Date(tf.date + 'T00:00:00').getTime())) tf.date = null
      }
      if (tf.earliest_departure) {
        const [h, m] = String(tf.earliest_departure).split(':').map(Number)
        if (!(h >= 0 && h <= 23 && m >= 0 && m <= 59)) tf.earliest_departure = null
      }
      if (tf.parking_preference && !['near_hub', 'near_home'].includes(tf.parking_preference)) {
        tf.parking_preference = null
      }
      if (tf.modes && Array.isArray(tf.modes)) {
        tf.modes = tf.modes.filter((m: string) => ['train', 'expbus'].includes(m))
        if (tf.modes.length === 0) tf.modes = null
      }
      if (tf.access_mode && !['drive', 'transit'].includes(tf.access_mode)) {
        tf.access_mode = null
      }
      if (tf.destination) {
        tf.destination = String(tf.destination).trim() || null
      }
      if (
        !tf.destination && !tf.date && !tf.earliest_departure &&
        !tf.parking_preference && !tf.modes && !tf.access_mode
      ) {
        parsed.trip_fields = null
      }
    }

    return parsed as UnifiedResult
  } catch (e) {
    console.warn('통합 상담사 응답 실패:', e)
    return null
  }
}
