import { useState, useEffect, useRef } from 'react'
import type { AccessMode, ParkingPreference, TransportMode, SelectedDestinationHub } from '../types'
import { searchDestinationHubs, type TransitHub } from '../utils/api'

interface TripPlanFormProps {
  onSubmit: (params: {
    destination: string
    destinationHub: SelectedDestinationHub
    date: string
    earliestDeparture: string
    parkingPreference: ParkingPreference
    modes: TransportMode[]
    accessMode: AccessMode
  }) => void
  loading?: boolean
}

const POPULAR_DESTINATIONS = ['부산', '대전', '대구', '광주', '울산', '강릉', '전주', '포항']

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toSelectedHub(hub: TransitHub): SelectedDestinationHub {
  return {
    id: hub.id,
    name: hub.name,
    type: hub.type,
    address: hub.address,
    lat: hub.lat,
    lng: hub.lng,
  }
}

export default function TripPlanForm({ onSubmit, loading }: TripPlanFormProps) {
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState(todayStr())
  const [earliest, setEarliest] = useState('08:00')
  const [accessMode, setAccessMode] = useState<AccessMode>('drive')
  const [parking, setParking] = useState<ParkingPreference>('near_hub')
  const [modes, setModes] = useState<TransportMode[]>(['train', 'expbus'])
  const [error, setError] = useState<string | null>(null)

  // 허브 검색
  const [trainHubs, setTrainHubs] = useState<TransitHub[]>([])
  const [busHubs, setBusHubs] = useState<TransitHub[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [pickedHub, setPickedHub] = useState<SelectedDestinationHub | null>(null)
  const [searchMsg, setSearchMsg] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleMode = (m: TransportMode) => {
    setModes(prev => {
      const next = prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
      return next
    })
    // 모드 변경 시 이미 선택한 허브가 새 모드와 맞지 않으면 해제
    if (pickedHub) {
      const isTrainHub = pickedHub.type === 'train_station'
      const nextHasTrain = (m === 'train' && !modes.includes('train')) || (m !== 'train' && modes.includes('train'))
      const nextHasBus = (m === 'expbus' && !modes.includes('expbus')) || (m !== 'expbus' && modes.includes('expbus'))
      if ((isTrainHub && !nextHasTrain) || (!isTrainHub && !nextHasBus)) {
        setPickedHub(null)
      }
    }
  }

  // 타이핑 시 디바운스로 허브 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = destination.trim()

    // 선택된 허브 이름과 동일하면 재검색 불필요
    if (pickedHub && q === pickedHub.name) {
      setShowResults(false)
      return
    }
    // 입력 변경 → 이전 선택 해제
    if (pickedHub && q !== pickedHub.name) {
      setPickedHub(null)
    }
    if (!q || q.length < 1) {
      setTrainHubs([])
      setBusHubs([])
      setShowResults(false)
      setSearchMsg(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setSearchMsg(null)
      try {
        const result = await searchDestinationHubs(q, {
          wantTrain: modes.includes('train'),
          wantBus: modes.includes('expbus'),
          radius: 15000,
        })
        if (!result) {
          setTrainHubs([])
          setBusHubs([])
          setSearchMsg(`'${q}' 지역을 찾을 수 없습니다.`)
          setShowResults(true)
          return
        }
        setTrainHubs(result.trains)
        setBusHubs(result.buses)
        setShowResults(true)
        if (result.trains.length === 0 && result.buses.length === 0) {
          setSearchMsg(`'${q}' 근처에서 기차역/터미널을 찾지 못했습니다.`)
        }
      } catch {
        setTrainHubs([])
        setBusHubs([])
        setSearchMsg('검색 중 오류가 발생했습니다.')
        setShowResults(true)
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, modes])

  const handleSelectHub = (hub: TransitHub) => {
    const selected = toSelectedHub(hub)
    setPickedHub(selected)
    setDestination(selected.name)
    setShowResults(false)
    setError(null)
  }

  const handleSubmit = () => {
    setError(null)
    if (!pickedHub) {
      setError('기차역 또는 버스터미널을 선택해주세요.')
      return
    }
    if (modes.length === 0) {
      setError('교통수단을 하나 이상 선택해주세요.')
      return
    }
    onSubmit({
      destination: pickedHub.name,
      destinationHub: pickedHub,
      date,
      earliestDeparture: earliest,
      parkingPreference: parking,
      modes,
      accessMode,
    })
    setShowResults(false)
  }

  const totalHubs = trainHubs.length + busHubs.length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div>
        <label className="text-xs font-bold text-gray-500 mb-2 block">
          도착지 <span className="font-normal text-gray-400">(지역/역명을 입력하고 기차역/터미널을 선택)</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (showResults && totalHubs > 0) {
                  e.preventDefault()
                  // 첫 번째 결과 자동 선택 (기차역 우선)
                  const first = trainHubs[0] || busHubs[0]
                  if (first) handleSelectHub(first)
                } else if (pickedHub) {
                  handleSubmit()
                }
              } else if (e.key === 'Escape') {
                setShowResults(false)
              }
            }}
            placeholder="예: 부산, 대구, 동대구역, 해운대"
            className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            disabled={loading}
            autoComplete="off"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!searching && pickedHub && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-600" title="허브 선택 완료">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>

        {/* 빠른 지역 버튼 */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {POPULAR_DESTINATIONS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => { setDestination(d); setPickedHub(null) }}
              disabled={loading}
              className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 text-gray-600 rounded-full transition-colors"
            >
              {d}
            </button>
          ))}
        </div>

        {/* 선택된 허브 요약 */}
        {pickedHub && (
          <div className="mt-2 bg-primary-50 border border-primary-200 rounded-xl px-3 py-2 flex items-start gap-2">
            <span className="text-base mt-0.5">
              {pickedHub.type === 'train_station' ? '🚄' : '🚌'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary-900 truncate">{pickedHub.name}</p>
              <p className="text-[11px] text-primary-700 truncate">{pickedHub.address}</p>
            </div>
            <button
              type="button"
              onClick={() => { setPickedHub(null); setDestination('') }}
              className="text-[11px] text-primary-600 hover:text-primary-800 font-bold flex-shrink-0"
            >
              변경
            </button>
          </div>
        )}

        {/* 허브 검색 결과 목록 */}
        {showResults && !pickedHub && (
          <div className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold text-gray-500 border-b border-gray-200">
              {searching ? '검색 중...' : totalHubs > 0 ? `기차역/터미널 ${totalHubs}개 · 선택하세요` : '검색 결과 없음'}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {/* 기차역 섹션 */}
              {trainHubs.length > 0 && (
                <div>
                  <div className="bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700 flex items-center gap-1">
                    🚄 기차역 ({trainHubs.length})
                  </div>
                  {trainHubs.map(hub => (
                    <button
                      key={`train_${hub.id}`}
                      type="button"
                      onClick={() => handleSelectHub(hub)}
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-50 active:bg-primary-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{hub.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{hub.address}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {hub.distance >= 1000 ? `${(hub.distance / 1000).toFixed(1)}km` : `${hub.distance}m`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* 버스터미널 섹션 */}
              {busHubs.length > 0 && (
                <div>
                  <div className="bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700 flex items-center gap-1">
                    🚌 버스터미널 ({busHubs.length})
                  </div>
                  {busHubs.map(hub => (
                    <button
                      key={`bus_${hub.id}`}
                      type="button"
                      onClick={() => handleSelectHub(hub)}
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-50 active:bg-primary-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{hub.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{hub.address}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {hub.distance >= 1000 ? `${(hub.distance / 1000).toFixed(1)}km` : `${hub.distance}m`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* 결과 없음 메시지 */}
              {!searching && totalHubs === 0 && searchMsg && (
                <div className="px-3 py-6 text-center text-xs text-gray-400">
                  {searchMsg}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-2">
        <div className="min-w-0">
          <label className="text-xs font-bold text-gray-500 mb-2 block">출발 날짜</label>
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={e => setDate(e.target.value)}
            className="w-full px-2 py-3 rounded-xl border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
            disabled={loading}
          />
        </div>
        <div className="min-w-0">
          <label className="text-xs font-bold text-gray-500 mb-2 block">출발시각 이후</label>
          <input
            type="time"
            value={earliest}
            onChange={e => setEarliest(e.target.value)}
            className="w-full px-2 py-3 rounded-xl border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
            disabled={loading}
          />
        </div>
      </div>

      {/* 출발지 → 출발 허브 이동 수단 */}
      <div>
        <label className="text-xs font-bold text-gray-500 mb-2 block">허브까지 이동 수단</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAccessMode('drive')}
            disabled={loading}
            className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
              accessMode === 'drive'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            🚗 차량 + 주차장
          </button>
          <button
            type="button"
            onClick={() => setAccessMode('transit')}
            disabled={loading}
            className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
              accessMode === 'transit'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            🚇 대중교통
          </button>
        </div>
      </div>

      {/* 주차장 위치 — 차량 모드일 때만 */}
      {accessMode === 'drive' && (
        <div>
          <label className="text-xs font-bold text-gray-500 mb-2 block">주차장 위치</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setParking('near_hub')}
              disabled={loading}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                parking === 'near_hub'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              🚄 출발역 근처
            </button>
            <button
              type="button"
              onClick={() => setParking('near_home')}
              disabled={loading}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                parking === 'near_home'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              🏠 현재 위치 근처
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-bold text-gray-500 mb-2 block">교통수단</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => toggleMode('train')}
            disabled={loading}
            className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
              modes.includes('train')
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            🚄 기차 (KTX/SRT/ITX)
          </button>
          <button
            type="button"
            onClick={() => toggleMode('expbus')}
            disabled={loading}
            className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
              modes.includes('expbus')
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            🚌 고속버스
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !pickedHub || modes.length === 0}
        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            플랜 찾는 중...
          </span>
        ) : (
          '추천 받기 →'
        )}
      </button>
    </div>
  )
}
