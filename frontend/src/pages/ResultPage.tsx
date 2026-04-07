import { useState, useRef, useEffect } from 'react'
import type { Errand, AppMode, RecommendationResponse, SlotRecommendation } from '../types'
import RecommendationCard from '../components/RecommendationCard'
import Timeline from '../components/Timeline'
import KakaoMap, { type KakaoMapHandle } from '../components/KakaoMap'
import CongestionChart from '../components/CongestionChart'
import OneClickConfirmModal from '../components/OneClickConfirmModal'
import { useLocation } from '../contexts/LocationContext'
import { pushBackHandler } from '../lib/backButtonStack'

interface ResultPageProps {
  result: RecommendationResponse
  errands: Errand[]
  onReset: () => void
  mode: AppMode
  onSetAlarm?: (date: string, time: string, label: string) => void
}

export default function ResultPage({ result, errands, onReset, mode, onSetAlarm }: ResultPageProps) {
  const { location } = useLocation()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const selected = result.recommendations[selectedIdx]
  const mapRef = useRef<KakaoMapHandle>(null)
  const [showOneClick, setShowOneClick] = useState(false)

  // 원클릭 모달이 열려 있는 동안 뒤로가기 버튼 소비
  useEffect(() => {
    if (!showOneClick) return
    return pushBackHandler(() => {
      setShowOneClick(false)
      return true
    })
  }, [showOneClick])

  const handleVisitClick = (index: number) => {
    if (!mapRef.current || !selected) return
    if (index === -1) {
      mapRef.current.focusOn(location.lat, location.lng, 3)
    } else if (index < selected.visits.length) {
      const visit = selected.visits[index]
      mapRef.current.focusOn(visit.facility.lat, visit.facility.lng, 3)
    }
  }

  const handleSetAlarm = () => {
    if (!selected || !onSetAlarm) return
    const firstVisit = selected.visits[0]
    if (!firstVisit) return
    onSetAlarm(selected.date, firstVisit.arrival_time, `${firstVisit.facility.name} 방문`)
  }

  return (
    <div className="pt-8">
      {/* 상단 요약 */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {mode === 'mode1' ? '추천 결과' : '최적 경로 결과'}
        </h2>
        <p className="text-gray-500">
          {mode === 'mode1'
            ? `${errands.length}개 용무 처리에 최적인 반차 날짜를 찾았습니다`
            : `${errands.length}개 용무의 최적 방문 순서를 찾았습니다`
          }
        </p>
      </div>

      {/* 추천 카드 3개 — 모바일에서도 가로 3열 */}
      <div className="grid grid-cols-3 gap-2 mb-6 pt-2">
        {result.recommendations.map((rec, i) => (
          <RecommendationCard
            key={i}
            recommendation={rec}
            isSelected={selectedIdx === i}
            onClick={() => setSelectedIdx(i)}
          />
        ))}
      </div>

      {/* 비추천 카드 */}
      {result.not_recommended && (
        <div className="mb-8">
          <NotRecommendedCard recommendation={result.not_recommended} />
        </div>
      )}

      {/* 선택된 추천안 상세 */}
      {selected && (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* 타임라인 */}
          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                방문 일정
              </span>
            </h3>
            <Timeline visits={selected.visits} halfDayType={selected.half_day_type} onVisitClick={handleVisitClick} />
          </div>

          {/* 카카오맵 */}
          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                경로 지도
              </span>
            </h3>
            <KakaoMap ref={mapRef} visits={selected.visits} originLat={location.lat} originLng={location.lng} />
          </div>
        </div>
      )}

      {/* 원클릭 서비스 카드 (DEMO) */}
      {selected && (
        <div className="mb-8 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 rounded-2xl p-5">
          {/* 헤더: 아이콘 + 제목 + DEMO 배지 */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-md">
              ⚡
            </div>
            <div className="flex-1 min-w-0 flex items-center flex-wrap gap-2 pt-1">
              <h3 className="text-lg font-bold text-amber-900">원클릭 서비스</h3>
              <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                🔶 DEMO · MOCK
              </span>
            </div>
          </div>

          {/* 본문 텍스트 — 카드 전체 폭 사용 */}
          <p className="text-sm text-amber-800 leading-relaxed mb-3">
            선택한 일정을 한 번에 확정하세요. <strong>필요 서류를 자동 발급</strong>하고, <strong>행정기관에 예약</strong>까지 진행합니다.
          </p>
          <p className="text-[11px] text-amber-700/80 mb-4 leading-relaxed">
            ⚠️ 데모 단계에서는 정부24/홈택스/은행 영업점 예약 시스템과 연동이 없어 mock 데이터로 시뮬레이션됩니다.
          </p>

          {/* 풀 와이드 버튼 */}
          <button
            onClick={() => setShowOneClick(true)}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-base hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200 whitespace-nowrap"
          >
            ⚡ 원클릭으로 확정하기
          </button>
        </div>
      )}

      {/* 혼잡도 차트 */}
      <div className="card mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          <span className="inline-flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
            </svg>
            요일별 혼잡도 비교
          </span>
        </h3>
        <CongestionChart />
      </div>

      {/* 활용 데이터 소스 */}
      <div className="card bg-gradient-to-r from-slate-50 to-blue-50 border-slate-200 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-3">이 추천에 활용된 데이터</h3>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <DataSource icon="🏛️" name="민원실 실시간 정보" source="공공데이터포털" />
          <DataSource icon="🚌" name="버스 실시간 위치" source="공공데이터포털" />
          <DataSource icon="🚦" name="신호등 실시간 정보" source="공공데이터포털" />
          <DataSource icon="🌤️" name="기상청 단기예보" source="기상청" />
          <DataSource icon="📮" name="전국 우체국 현황" source="우정사업본부" />
          <DataSource icon="🏦" name="금융기관 이용통계" source="한국은행" />
          <DataSource icon="📅" name="공휴일 정보" source="천문연구원" />
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
        <button onClick={onReset} className="btn-secondary">
          다른 용무로 다시 추천받기
        </button>
        {selected && (
          <button
            onClick={handleSetAlarm}
            className="btn-primary flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            알람 설정하기
          </button>
        )}
      </div>

      {/* 원클릭 확정 모달 */}
      {showOneClick && selected && (
        <OneClickConfirmModal
          plan={selected}
          errands={errands}
          onClose={() => setShowOneClick(false)}
          onReset={() => {
            setShowOneClick(false)
            onReset()
          }}
          onSetAlarm={() => {
            setShowOneClick(false)
            handleSetAlarm()
          }}
        />
      )}
    </div>
  )
}

function NotRecommendedCard({ recommendation: rec }: { recommendation: SlotRecommendation }) {
  return (
    <div className="card bg-red-50 border-red-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-red-700">비추천</p>
            <p className="text-sm text-red-600">
              {rec.date} {rec.day_of_week} {rec.half_day_type}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-red-700">{rec.total_minutes}분</p>
          <p className="text-xs text-red-500">{rec.reason}</p>
        </div>
      </div>
    </div>
  )
}

function DataSource({ icon, name, source }: { icon: string; name: string; source: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
      <span>{icon}</span>
      <div>
        <p className="font-medium text-gray-800">{name}</p>
        <p className="text-xs text-gray-400">{source}</p>
      </div>
    </div>
  )
}
