import { useState } from 'react'
import type { SlotRecommendation, Errand, OneClickConfirmResponse, OneClickDocument, OneClickReservation } from '../types'
import { confirmOneClickPlan } from '../utils/api'

interface OneClickConfirmModalProps {
  plan: SlotRecommendation
  errands: Errand[]
  onClose: () => void
  onReset?: () => void
  onSetAlarm?: () => void
}

type Phase = 'idle' | 'processing' | 'done' | 'error'

export default function OneClickConfirmModal({ plan, errands, onClose, onReset, onSetAlarm }: OneClickConfirmModalProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<OneClickConfirmResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setPhase('processing')
    setError(null)
    try {
      const res = await confirmOneClickPlan(plan, errands)
      setResult(res)
      setPhase('done')
    } catch (e) {
      setError('원클릭 확정에 실패했습니다. 잠시 후 다시 시도해주세요.')
      setPhase('error')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] overflow-y-auto animate-fade-in">
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-4">
        {/* 헤더 - DEMO 강조 */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/25 rounded-xl flex items-center justify-center text-2xl">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-lg">원클릭 서비스</p>
                  <span className="px-2 py-0.5 bg-white text-amber-700 text-[10px] font-bold rounded-full">DEMO</span>
                </div>
                <p className="text-xs text-white/85">서류 자동 발급 + 행정기관 예약을 한 번에</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center" aria-label="닫기">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="bg-white/20 rounded-lg px-3 py-2 mt-3 text-xs leading-relaxed">
            🔶 <strong>데모 안내</strong>: 이 기능은 mock 데이터를 사용합니다. 실제 서류 발급이나 예약은 이루어지지 않습니다.
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 플랜 요약 */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200">
            <p className="text-xs font-bold text-gray-500 mb-2">확정할 일정</p>
            <p className="text-sm font-bold text-gray-900">
              {plan.date} ({plan.day_of_week}) · {plan.half_day_type}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.visits.map((v, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-gray-700">
                  {v.facility.name}
                </span>
              ))}
            </div>
          </div>

          {/* IDLE 상태 — 확정 버튼 */}
          {phase === 'idle' && (
            <div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                <p className="text-sm font-bold text-amber-900 mb-2">원클릭 서비스가 처리할 작업</p>
                <ul className="text-xs text-amber-800 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">📄</span>
                    <span><strong>필요 서류 자동 발급</strong> — 정부24/홈택스/근로복지공단 등에서 통합 발급 (mock)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">📅</span>
                    <span><strong>행정기관 예약</strong> — 방문 시각에 맞춰 민원실/은행/우체국 예약 자동 진행 (mock)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">🪪</span>
                    <span><strong>본인 지참 안내</strong> — 신분증 등 직접 챙겨야 하는 서류 알림</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={handleConfirm}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-base hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200"
              >
                ⚡ 원클릭으로 확정하기
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-2">
                클릭 시 서류 발급과 예약이 자동으로 진행됩니다 (데모 시뮬레이션)
              </p>
            </div>
          )}

          {/* PROCESSING 상태 */}
          {phase === 'processing' && (
            <div className="py-12 text-center">
              <div className="inline-flex w-14 h-14 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold text-gray-800 mb-1">원클릭 처리 중...</p>
              <p className="text-xs text-gray-500">서류 발급 + 예약을 진행하고 있습니다</p>
            </div>
          )}

          {/* DONE 상태 */}
          {phase === 'done' && result && (
            <div className="space-y-5">
              {/* 성공 요약 */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-lg flex-shrink-0">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-green-900">처리 완료</p>
                    <p className="text-xs text-green-800 mt-0.5">{result.summary}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-bold rounded-full">DEMO</span>
                </div>
              </div>

              {/* 자동 발급된 서류 */}
              {result.documents.filter(d => d.auto_issued).length > 0 && (
                <Section title="📄 자동 발급된 서류" mockBadge>
                  <div className="space-y-2">
                    {result.documents.filter(d => d.auto_issued).map((d, i) => (
                      <DocumentRow key={i} doc={d} />
                    ))}
                  </div>
                </Section>
              )}

              {/* 본인 지참 필요 */}
              {result.documents.filter(d => !d.auto_issued).length > 0 && (
                <Section title="🪪 본인 지참 필요" infoBadge="당일 잊지 마세요">
                  <div className="space-y-2">
                    {result.documents.filter(d => !d.auto_issued).map((d, i) => (
                      <DocumentRow key={i} doc={d} />
                    ))}
                  </div>
                </Section>
              )}

              {/* 예약 내역 */}
              {result.reservations.length > 0 && (
                <Section title="📅 행정기관 예약 내역" mockBadge>
                  <div className="space-y-2">
                    {result.reservations.map((r, i) => (
                      <ReservationRow key={i} rsv={r} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-amber-700 mb-1.5">⚠️ 데모 안내</p>
                  <ul className="text-[11px] text-amber-800 space-y-0.5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onReset || onClose}
                  className="py-3 px-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-1 text-xs whitespace-nowrap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  다시 추천받기
                </button>
                <button
                  onClick={onSetAlarm || onClose}
                  className="py-3 px-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-1 text-xs whitespace-nowrap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  알람 설정
                </button>
              </div>
            </div>
          )}

          {/* ERROR 상태 */}
          {phase === 'error' && (
            <div className="py-8">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-bold text-red-700 mb-1">처리 실패</p>
                <p className="text-xs text-red-600">{error}</p>
              </div>
              <button
                onClick={() => { setPhase('idle'); setError(null) }}
                className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

function Section({
  title, children, mockBadge, infoBadge,
}: { title: string; children: React.ReactNode; mockBadge?: boolean; infoBadge?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {mockBadge && (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">
            🔶 MOCK
          </span>
        )}
        {infoBadge && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">
            {infoBadge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function DocumentRow({ doc }: { doc: OneClickDocument }) {
  return (
    <div className={`rounded-lg border p-3 ${doc.auto_issued ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900">{doc.document_name}</p>
            <span className="text-[10px] px-1.5 py-0.5 bg-white text-gray-600 rounded border border-gray-200">
              {doc.required_for}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {doc.auto_issued ? `✓ ${doc.source}에서 발급 완료` : `발급처: ${doc.source}`}
          </p>
        </div>
        {doc.auto_issued && doc.download_url && (
          <span className="text-[10px] px-2 py-1 bg-amber-200 text-amber-800 rounded font-bold whitespace-nowrap">
            mock URL
          </span>
        )}
      </div>
    </div>
  )
}

function ReservationRow({ rsv }: { rsv: OneClickReservation }) {
  const ftypeIcon: Record<string, string> = {
    '민원실': '🏛️',
    '은행': '🏦',
    '우체국': '📮',
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span>{ftypeIcon[rsv.facility_type] || '📍'}</span>
            <p className="text-sm font-bold text-gray-900 truncate">{rsv.facility_name}</p>
            <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-bold">
              {rsv.status}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {rsv.visit_date} {rsv.visit_time} · {rsv.channel}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
            예약번호: {rsv.reservation_number}
          </p>
        </div>
      </div>
    </div>
  )
}
