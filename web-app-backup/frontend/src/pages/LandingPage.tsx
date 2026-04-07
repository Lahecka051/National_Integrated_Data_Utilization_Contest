import { useState, useRef, useEffect } from 'react'
import type { Errand, ChatMessage, TimeConstraint, ConsultantAction, RecommendationResponse } from '../types'
import { sendConsultantMessage } from '../utils/api'

interface LandingPageProps {
  onStartMode1: () => void
  onStartMode2: () => void
  llmAvailable: boolean
  onRecommendationReady: (result: RecommendationResponse, errands: Errand[]) => void
}

const SUGGESTIONS = [
  '은행 가서 통장 만들고 싶어요',
  '주민센터에서 서류 떼야 해요',
  '오후 2시부터 4시까지 비어요',
]

export default function LandingPage({ onStartMode1, onStartMode2, llmAvailable, onRecommendationReady }: LandingPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 하루짜기 일정 상담사입니다. 어떤 용무를 처리하실 건가요? 비는 시간대가 있다면 함께 알려주세요!' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionErrands, setSessionErrands] = useState<Errand[]>([])
  const [timeConstraint, setTimeConstraint] = useState<TimeConstraint | undefined>()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      const res = await sendConsultantMessage(updated, sessionErrands, timeConstraint)

      if (res.updated_errands?.length > 0) {
        setSessionErrands(res.updated_errands)
      }
      if (res.updated_time_constraint) {
        setTimeConstraint(res.updated_time_constraint)
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

  return (
    <div className="pt-12 pb-8">
      {/* Hero */}
      <section className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          AI 기반 반차 최적화
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          구청, 은행, 우체국<br />
          <span className="text-primary-600">한 번에 끝내는 최적 동선</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          AI 상담사에게 용무와 비는 시간을 말씀하시면, 최적 일정을 찾아드립니다.
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
                <p className="font-bold">하루짜기 일정 상담사</p>
                <p className="text-sm text-white/70">용무와 시간을 알려주시면 최적 일정을 찾아드려요</p>
              </div>
            </div>

            {/* 세션 상태 칩 */}
            {(sessionErrands.length > 0 || timeConstraint) && (
              <div className="px-5 py-2.5 bg-violet-50 border-b border-violet-100 flex flex-wrap gap-1.5 items-center">
                {sessionErrands.map((e, i) => (
                  <span key={i} className="px-2.5 py-1 bg-violet-100 text-violet-700 text-xs rounded-full font-medium">
                    {e.task_name}
                  </span>
                ))}
                {timeConstraint?.start_time && timeConstraint?.end_time && (
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                    {timeConstraint.start_time}~{timeConstraint.end_time}
                  </span>
                )}
                {timeConstraint?.start_date && (
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                    {timeConstraint.start_date} 이후
                  </span>
                )}
              </div>
            )}

            {/* 메시지 영역 */}
            <div className="overflow-y-auto p-5 space-y-3 min-h-[200px] max-h-[400px]">
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

                  {/* 시간 제약 카드 */}
                  {msg.action?.action_type === 'time_constraint_set' && msg.action.time_constraint && (
                    <div className="mt-2 ml-10 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-xs font-bold text-blue-700 mb-1">시간 설정 완료</p>
                      <p className="text-sm text-blue-800 font-medium">
                        {msg.action.time_constraint.start_time} ~ {msg.action.time_constraint.end_time}
                      </p>
                    </div>
                  )}

                  {/* 추천 결과 카드 */}
                  {(msg.action?.action_type === 'recommend_triggered' || msg.action?.action_type === 'request_recommend') && msg.action.recommendation && (
                    <div className="mt-2 ml-10 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs font-bold text-amber-700 mb-2">추천 결과</p>
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
              <div ref={messagesEndRef} />
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

      {/* 기존 버튼 - 직접 선택 모드 */}
      <section className="max-w-2xl mx-auto mb-12">
        <div className="text-center mb-4">
          <p className="text-sm text-gray-400">{llmAvailable ? '또는 직접 용무를 선택할 수도 있어요' : '용무를 선택하고 최적 일정을 추천받으세요'}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button onClick={onStartMode1} className="btn-primary text-base px-8 py-3.5 shadow-lg shadow-primary-200">
            최적 날짜 찾기
          </button>
          <button onClick={onStartMode2} className="btn-secondary text-base px-8 py-3.5 bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:border-gray-300">
            날짜 지정 최적 경로
          </button>
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
