import { useState, useRef, useEffect } from 'react'
import type { Errand, ChatMessage, TimeConstraint, ConsultantAction, RecommendationResponse, TripConsultantState, TripRecommendResponse, NearbyBankOption } from '../types'
import { sendConsultantMessage, fetchRecommendation } from '../utils/api'
import { useLocation } from '../contexts/LocationContext'

interface LandingPageProps {
  onStartMode1: () => void
  onStartMode2: () => void
  onStartBusinessTrip: () => void
  llmAvailable: boolean
  onRecommendationReady: (result: RecommendationResponse, errands: Errand[]) => void
  onTripRecommendationReady: (result: TripRecommendResponse) => void
}

const SUGGESTIONS = [
  '은행 가서 통장 만들고 싶어요',
  '다음 주 수요일 부산 출장, 오전 9시 이후 출발',
  '오후 2시부터 4시까지 비어요',
  '내일 대전 가는데 기차로만 갈래요',
]

export default function LandingPage({ onStartMode1, onStartMode2, onStartBusinessTrip, llmAvailable, onRecommendationReady, onTripRecommendationReady }: LandingPageProps) {
  const { location } = useLocation()
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 반차출장플랜 AI 상담사입니다. 반차 일정도, 출장 계획도 모두 도와드릴 수 있어요. 어떤 일을 처리하실 건가요?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionErrands, setSessionErrands] = useState<Errand[]>([])
  const [timeConstraint, setTimeConstraint] = useState<TimeConstraint | undefined>()
  const [tripState, setTripState] = useState<TripConsultantState>({})
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // 채팅 컨테이너 내부에서만 스크롤 — 페이지 전체는 스크롤하지 않음
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return
    // 사용자가 이미 바닥 근처에 있을 때만 자동 스크롤 (위로 올려서 읽고 있으면 방해 안 함)
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom < 120) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages])

  const handleSend = async (text?: string) => {
    const content = text || input.trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await sendConsultantMessage(
        updated,
        sessionErrands,
        timeConstraint,
        tripState,
        location.lat,
        location.lng,
      )

      if (res.updated_errands?.length > 0) {
        setSessionErrands(res.updated_errands)
      }
      if (res.updated_time_constraint) {
        setTimeConstraint(res.updated_time_constraint)
      }
      if (res.updated_trip_state) {
        setTripState(res.updated_trip_state)
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res.reply,
        action: res.action,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '응답을 생성할 수 없습니다. 다시 시도해주세요.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleViewResult = (action: ConsultantAction) => {
    if (action.recommendation) {
      onRecommendationReady(action.recommendation, sessionErrands)
    }
  }

  const handleViewTripResult = (action: ConsultantAction) => {
    if (action.trip_recommendation) {
      onTripRecommendationReady(action.trip_recommendation)
    }
  }

  /**
   * 사용자가 챗봇의 "은행 선택" 카드에서 한 지점을 클릭했을 때.
   * 1) sessionErrands의 은행 type errand에 selected_facility 주입
   * 2) 사용자 메시지로 선택을 기록
   * 3) LLM 우회하고 곧바로 추천 실행 → 결과 카드 추가
   */
  const handleSelectBank = async (bank: NearbyBankOption) => {
    if (loading) return
    setLoading(true)

    const updatedErrands: Errand[] = sessionErrands.map(e => {
      if (e.task_type !== '은행' || e.selected_facility) return e
      return {
        ...e,
        facility_id: bank.id,
        selected_facility: {
          id: bank.id,
          name: bank.name,
          address: bank.address,
          lat: bank.lat,
          lng: bank.lng,
        },
      }
    })
    setSessionErrands(updatedErrands)

    setMessages(prev => [
      ...prev,
      { role: 'user', content: `${bank.name}으로 진행해주세요` },
    ])

    try {
      const recommendation = await fetchRecommendation(
        updatedErrands, location.lat, location.lng, timeConstraint,
      )
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `${bank.name} 지점으로 일정을 추천해드릴게요!`,
          action: {
            action_type: 'recommend_triggered',
            intent: 'half_day',
            recommendation,
          },
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '추천을 생성할 수 없습니다. 다시 시도해주세요.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pt-8 pb-8">
      {/* Hero */}
      <section className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          공공데이터 × AI 일정 플래너
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          반차부터 출장까지<br />
          <span className="text-primary-600">AI가 짜주는 최적의 하루</span>
        </h1>
        <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          공공데이터와 AI로 아끼는 직장인 하루 —<br className="sm:hidden" />
          <span className="sm:ml-1">AI 상담사에게 용무를 말씀하시면 최적의 일정과 동선을 찾아드립니다.</span>
        </p>
      </section>

      {/* AI 상담사 채팅 */}
      {llmAvailable && (
        <section className="max-w-2xl mx-auto mb-12">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {/* 채팅 헤더 */}
            <div className="px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold">반차출장플랜 AI 상담사</p>
                <p className="text-sm text-white/70">용무와 시간을 알려주시면 최적 일정을 찾아드려요</p>
              </div>
            </div>

            {/* 세션 상태 칩 */}
            {(sessionErrands.length > 0 || timeConstraint || tripState.destination || tripState.date) && (
              <div className="px-5 py-2.5 bg-violet-50 border-b border-violet-100 flex flex-wrap gap-1.5 items-center">
                {sessionErrands.map((e, i) => (
                  <span key={i} className="px-2.5 py-1 bg-violet-100 text-violet-700 text-xs rounded-full font-medium">
                    🏛️ {e.task_name}
                  </span>
                ))}
                {timeConstraint?.start_time && timeConstraint?.end_time && (
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                    🕐 {timeConstraint.start_time}~{timeConstraint.end_time}
                  </span>
                )}
                {timeConstraint?.start_date && (
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                    📅 {timeConstraint.start_date} 이후
                  </span>
                )}
                {tripState.destination && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                    📍 {tripState.destination}
                  </span>
                )}
                {tripState.date && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                    📅 {tripState.date}
                  </span>
                )}
                {tripState.earliest_departure && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                    🕐 {tripState.earliest_departure} 이후
                  </span>
                )}
                {tripState.access_mode && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                    {tripState.access_mode === 'transit' ? '🚇 대중교통' : '🚗 차량'}
                  </span>
                )}
              </div>
            )}

            {/* 메시지 영역 */}
            <div ref={chatContainerRef} className="overflow-y-auto overscroll-contain p-5 space-y-3 min-h-[200px] max-h-[400px]">
              {messages.map((msg, i) => (
                <div key={i}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-violet-600">AI</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-violet-600 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }`}
                    >
                      {msg.content}
                    </div>
                  </div>

                  {/* 용무 파싱 카드 */}
                  {msg.action?.action_type === 'errands_parsed' && msg.action.parsed_errands && (
                    <div className="mt-2 ml-10 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <p className="text-xs font-bold text-green-700 mb-1.5">등록된 용무</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.action.parsed_errands.map((e, j) => (
                          <span key={j} className="px-2.5 py-1 bg-green-100 text-green-800 text-xs rounded-lg flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                            {e.task_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 은행 선택 카드 — 은행 용무가 있는데 지점이 정해지지 않은 경우 */}
                  {msg.action?.action_type === 'bank_selection_needed' && msg.action.nearby_banks && (
                    <div className="mt-2 ml-10 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs font-bold text-amber-700 mb-2">🏦 어느 은행에서 처리하시겠어요?</p>
                      {msg.action.nearby_banks.length === 0 ? (
                        <p className="text-xs text-gray-500 px-2 py-2">근처에서 은행을 찾지 못했어요. 위치를 확인해주세요.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {msg.action.nearby_banks.map(bank => (
                            <button
                              key={bank.id}
                              disabled={loading}
                              onClick={() => handleSelectBank(bank)}
                              className="w-full text-left bg-white rounded-lg px-3 py-2.5 text-sm border border-amber-100 hover:border-amber-400 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-bold text-gray-900 truncate">{bank.name}</p>
                                  <p className="text-[11px] text-gray-500 truncate">{bank.address}</p>
                                </div>
                                <span className="text-[11px] text-gray-400 flex-shrink-0 whitespace-nowrap">{bank.distance}m</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 시간 제약 카드 */}
                  {msg.action?.action_type === 'time_constraint_set' && msg.action.time_constraint && (
                    <div className="mt-2 ml-10 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-xs font-bold text-blue-700 mb-1">시간 설정 완료</p>
                      <p className="text-sm text-blue-800 font-medium">
                        {msg.action.time_constraint.start_time} ~ {msg.action.time_constraint.end_time}
                      </p>
                    </div>
                  )}

                  {/* 반차 추천 결과 카드 */}
                  {(msg.action?.action_type === 'recommend_triggered' || msg.action?.action_type === 'request_recommend') && msg.action.recommendation && (
                    <div className="mt-2 ml-10 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs font-bold text-amber-700 mb-2">🏛️ 반차 추천 결과</p>
                      {msg.action.recommendation.note && (
                        <div className="mb-2 px-3 py-2 bg-white border border-amber-200 rounded-lg text-[11px] text-amber-800">
                          ℹ️ {msg.action.recommendation.note}
                        </div>
                      )}
                      {msg.action.recommendation.recommendations.length === 0 ? (
                        <p className="text-xs text-gray-500 px-3 py-2">표시할 추천 결과가 없습니다.</p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {msg.action.recommendation.recommendations.slice(0, 3).map((rec, j) => (
                              <div key={j} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 text-sm border border-amber-100">
                                <div className="flex items-center gap-2">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${j === 0 ? 'bg-amber-500' : 'bg-gray-400'}`}>{j + 1}</span>
                                  <span className="text-gray-700">{rec.date} {rec.day_of_week} {rec.half_day_type}</span>
                                </div>
                                <span className="font-bold text-gray-900">{rec.total_minutes}분</span>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => handleViewResult(msg.action!)}
                            className="mt-3 w-full py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors"
                          >
                            상세 결과 보기
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* 출장 추천 결과 카드 */}
                  {msg.action?.action_type === 'trip_request_recommend' && msg.action.trip_recommendation && msg.action.trip_recommendation.plans.length > 0 && (
                    <div className="mt-2 ml-10 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-xs font-bold text-blue-700 mb-2">✈️ 출장 플랜 추천</p>
                      <div className="space-y-2">
                        {msg.action.trip_recommendation.plans.slice(0, 3).map((plan, j) => {
                          const modeIcon = plan.schedule.mode === 'train' ? '🚄' : '🚌'
                          const h = Math.floor(plan.total_duration_min / 60)
                          const m = plan.total_duration_min % 60
                          const dur = h > 0 ? `${h}시간${m > 0 ? ` ${m}분` : ''}` : `${m}분`
                          return (
                            <div key={j} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 text-sm border border-blue-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${j === 0 ? 'bg-blue-500' : 'bg-gray-400'}`}>{plan.rank}</span>
                                <span className="text-gray-700 truncate">
                                  {modeIcon} {plan.origin_hub.name} → {plan.destination_hub.name}
                                </span>
                              </div>
                              <span className="font-bold text-gray-900 flex-shrink-0 ml-2">{dur}</span>
                            </div>
                          )
                        })}
                      </div>
                      <button
                        onClick={() => handleViewTripResult(msg.action!)}
                        className="mt-3 w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        출장 플랜 상세 보기
                      </button>
                    </div>
                  )}

                  {/* 출장 정보 일부 파싱 카드 */}
                  {msg.action?.action_type === 'trip_info_parsed' && msg.action.trip_fields && (
                    <div className="mt-2 ml-10 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-xs font-bold text-blue-700 mb-1.5">출장 정보 일부 파악</p>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {msg.action.trip_fields.destination && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-lg">📍 {msg.action.trip_fields.destination}</span>
                        )}
                        {msg.action.trip_fields.date && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-lg">📅 {msg.action.trip_fields.date}</span>
                        )}
                        {msg.action.trip_fields.earliest_departure && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-lg">🕐 {msg.action.trip_fields.earliest_departure}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                    <span className="text-xs font-bold text-violet-600">AI</span>
                  </div>
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 추천 질문 */}
            {messages.length <= 1 && (
              <div className="px-5 pb-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="px-3 py-1.5 bg-violet-50 text-violet-700 text-xs rounded-full border border-violet-200 hover:bg-violet-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* 입력 */}
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="용무나 비는 시간을 알려주세요... (예: 은행 가서 통장 만들어야 해)"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  disabled={loading}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 모드 선택 - 반차 / 출장 2개 카드 */}
      <section className="max-w-4xl mx-auto mb-14">
        <div className="text-center mb-6">
          <p className="text-sm text-gray-400">{llmAvailable ? '또는 목적에 맞는 모드를 직접 선택하세요' : '목적에 맞는 모드를 선택하세요'}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {/* 반차 모드 */}
          <div className="group bg-white rounded-2xl border-2 border-primary-100 hover:border-primary-400 hover:shadow-xl hover:shadow-primary-100 p-6 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-2xl">
                🏛️
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">반차 모드</h3>
                <p className="text-xs text-gray-500">민원·은행·우체국 동선 최적화</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              직장인이 반차/연차를 쓰고 여러 공공 업무를 한 번에 끝낼 수 있도록,
              대기·이동시간이 가장 적은 날짜와 순서를 찾아드립니다.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onStartMode1}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-md shadow-primary-100"
              >
                최적 날짜 찾기
              </button>
              <button
                onClick={onStartMode2}
                className="w-full py-2.5 bg-primary-50 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-100 transition-colors"
              >
                날짜 지정 최적 경로
              </button>
            </div>
          </div>

          {/* 출장 모드 */}
          <div className="group bg-white rounded-2xl border-2 border-indigo-100 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-100 p-6 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-2xl">
                ✈️
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">출장 모드</h3>
                <p className="text-xs text-gray-500">공공주차장 + 기차역/터미널 혼잡도</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              출장자를 위한 모드. 현재 위치 근처 공공주차장 실시간 가용 정보와
              기차역·고속버스터미널 혼잡도를 한눈에 확인할 수 있습니다.
            </p>
            <button
              onClick={onStartBusinessTrip}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-100"
            >
              출장 모드 시작
            </button>
          </div>
        </div>
      </section>

      {/* 작동 원리 */}
      <section className="mb-16">
        <h2 className="text-center text-2xl font-bold text-gray-900 mb-8">어떻게 작동하나요?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <StepCard
            step={1}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
            title="상담사에게 말하기"
            desc="AI 상담사에게 처리할 용무와 비는 시간을 알려주세요"
          />
          <StepCard
            step={2}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            title="한 달 시뮬레이션"
            desc="향후 한 달간 모든 반차 슬롯의 소요시간을 예측합니다"
          />
          <StepCard
            step={3}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
            title="최적 추천"
            desc="가장 빠르게 끝나는 날짜, 시간, 순서를 알려드려요"
          />
        </div>
      </section>

      {/* 데이터 출처 */}
      <section className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">활용 공공데이터</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <DataBadge icon="🏛️" label="민원실 이용 현황 실시간 정보" tag="필수" />
          <DataBadge icon="🚌" label="초정밀 버스 실시간 정보" tag="필수" />
          <DataBadge icon="🚦" label="교통안전 신호등 실시간 정보" tag="필수" />
          <DataBadge icon="🌤️" label="기상청 단기예보" tag="추가" />
          <DataBadge icon="📮" label="전국 우체국 현황 정보" tag="추가" />
          <DataBadge icon="🏦" label="금융기관 이용 통계" tag="추가" />
          <DataBadge icon="📅" label="공휴일/특일 정보" tag="추가" />
        </div>
      </section>
    </div>
  )
}

function StepCard({ step, icon, title, desc }: { step: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-100 text-primary-600 rounded-2xl mb-4">
        {icon}
      </div>
      <div className="text-xs font-bold text-primary-400 mb-1">STEP {step}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
  )
}

function DataBadge({ icon, label, tag }: { icon: string; label: string; tag: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/70 rounded-xl px-4 py-3">
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
      </div>
      <span className={`badge text-xs ${tag === '필수' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
        {tag}
      </span>
    </div>
  )
}
