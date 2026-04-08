import { useState, useEffect } from 'react'
import type { Errand, FacilityType, AppMode } from '../types'
import { fetchNearbyBanks, type NearbyPlace } from '../utils/api'
import { useLocation } from '../contexts/LocationContext'

const TASK_MAP: Record<string, { type: FacilityType; tasks: string[] }> = {
  '민원실': { type: '민원실', tasks: ['전입신고', '주민등록등본 발급', '인감증명서 발급', '여권 신청'] },
  '은행':   { type: '은행',   tasks: ['통장 개설', '카드 발급', '대출 상담', '환전'] },
  '우체국': { type: '우체국', tasks: ['등기우편 발송', '택배 발송'] },
}

const DURATIONS: Record<string, number> = {
  '전입신고': 10, '주민등록등본 발급': 5, '인감증명서 발급': 5, '여권 신청': 15,
  '통장 개설': 20, '카드 발급': 15, '대출 상담': 30, '환전': 10,
  '등기우편 발송': 10, '택배 발송': 5,
}

const FACILITY_ICONS: Record<string, string> = {
  '민원실': '🏛️',
  '은행': '🏦',
  '우체국': '📮',
}

interface ErrandSelectPageProps {
  onSubmit: (errands: Errand[]) => void
  error: string | null
  mode: AppMode
  onBack: () => void
}

export default function ErrandSelectPage({ onSubmit, error, mode, onBack }: ErrandSelectPageProps) {
  const { location } = useLocation()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [nearbyBanks, setNearbyBanks] = useState<NearbyPlace[]>([])
  const [selectedBank, setSelectedBank] = useState<NearbyPlace | null>(null)
  const [showBankPicker, setShowBankPicker] = useState(false)
  const [banksLoading, setBanksLoading] = useState(false)


  // 은행 용무가 선택되면 근처 은행 목록 로드
  const hasBankTask = Array.from(selected).some(t => TASK_MAP['은행'].tasks.includes(t))

  useEffect(() => {
    if (hasBankTask && nearbyBanks.length === 0 && !banksLoading) {
      setBanksLoading(true)
      fetchNearbyBanks(location.lat, location.lng).then(data => {
        setNearbyBanks(data.banks)
        setBanksLoading(false)
      }).catch(() => setBanksLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBankTask, location.lat, location.lng])

  const toggle = (task: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(task)) next.delete(task)
      else next.add(task)
      return next
    })
  }

  const handleSubmit = () => {
    const errands: Errand[] = []
    for (const [, info] of Object.entries(TASK_MAP)) {
      for (const task of info.tasks) {
        if (selected.has(task)) {
          const isBank = info.type === '은행'
          // 사용자가 직접 은행 지점을 골랐으면, optimizer가 자동검색을 건너뛰도록
          // selected_facility 풀세트(name/lat/lng 포함)를 함께 전달한다.
          // facility_id만 전달하면 optimizer가 무시하고 가까운 은행으로 폴백한다.
          const selFac = isBank && selectedBank ? {
            id: selectedBank.id,
            name: selectedBank.name,
            address: selectedBank.road_address || selectedBank.address || '',
            lat: selectedBank.lat,
            lng: selectedBank.lng,
          } : undefined
          errands.push({
            task_type: info.type,
            task_name: task,
            facility_id: selFac?.id,
            selected_facility: selFac,
            estimated_duration: DURATIONS[task] || 15,
          })
        }
      }
    }
    if (errands.length > 0) onSubmit(errands)
  }

  const totalTime = Array.from(selected).reduce((sum, t) => sum + (DURATIONS[t] || 15), 0)

  return (
    <div className="pt-8 max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors mb-6 text-sm font-medium"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        뒤로가기
      </button>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">처리할 용무를 선택하세요</h2>
        <p className="text-gray-500">반차 중 방문할 시설과 용무를 모두 선택해주세요</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6 mb-8">
        {Object.entries(TASK_MAP).map(([category, info]) => (
          <div key={category} className="card">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{FACILITY_ICONS[category]}</span>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{category}</h3>
                <p className="text-xs text-gray-400">
                  {category === '은행' ? '영업시간 09:00~16:00' : '운영시간 09:00~18:00'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {info.tasks.map(task => {
                const isSelected = selected.has(task)
                return (
                  <button
                    key={task}
                    onClick={() => toggle(task)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all duration-150
                      ${isSelected
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{task}</p>
                      <p className="text-xs text-gray-400 mt-0.5">~{DURATIONS[task]}분</p>
                    </div>
                    {isSelected && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary-600 flex-shrink-0">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            {/* 은행 선택 (은행 용무가 선택되었을 때) */}
            {category === '은행' && hasBankTask && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-2">방문할 은행 선택</p>
                {selectedBank ? (
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-amber-800">{selectedBank.name}</p>
                      <p className="text-xs text-amber-600">{selectedBank.address} · {selectedBank.distance}m</p>
                    </div>
                    <button
                      onClick={() => setShowBankPicker(true)}
                      className="text-xs font-medium text-amber-700 underline"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowBankPicker(true)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    {banksLoading ? '근처 은행 검색 중...' : '근처 은행을 선택하세요 (카카오맵 기반)'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 하단 요약 + 제출 */}
      <div className="sticky bottom-4">
        <div className="card bg-white/95 backdrop-blur-md shadow-lg border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">선택된 용무</p>
            <p className="text-xl font-bold text-gray-900">
              {selected.size}개
              {selected.size > 0 && (
                <span className="text-sm font-normal text-gray-400 ml-2">
                  처리시간 약 {totalTime}분
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={selected.size === 0}
            className="btn-primary"
          >
            {mode === 'mode1' ? '최적 날짜 찾기' : '날짜 선택하기'}
          </button>
        </div>
      </div>

      {/* 은행 선택 모달 */}
      {showBankPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowBankPicker(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">근처 은행 선택</h3>
              <button onClick={() => setShowBankPicker(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[55vh] p-4 space-y-2">
              {nearbyBanks.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">은행을 검색 중입니다...</p>
              )}
              {nearbyBanks.map(bank => (
                <button
                  key={bank.id}
                  onClick={() => {
                    setSelectedBank(bank)
                    setShowBankPicker(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-150
                    ${selectedBank?.id === bank.id
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{bank.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{bank.road_address || bank.address}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-3">{bank.distance}m</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
