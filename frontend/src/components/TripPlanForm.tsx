import { useState } from 'react'
import type { ParkingPreference, TransportMode } from '../types'

interface TripPlanFormProps {
  onSubmit: (params: {
    destination: string
    date: string
    earliestDeparture: string
    parkingPreference: ParkingPreference
    modes: TransportMode[]
  }) => void
  loading?: boolean
}

const POPULAR_DESTINATIONS = ['부산', '대전', '대구', '광주', '울산', '강릉', '전주', '포항']

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TripPlanForm({ onSubmit, loading }: TripPlanFormProps) {
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState(todayStr())
  const [earliest, setEarliest] = useState('08:00')
  const [parking, setParking] = useState<ParkingPreference>('near_hub')
  const [modes, setModes] = useState<TransportMode[]>(['train', 'expbus'])
  const [error, setError] = useState<string | null>(null)

  const toggleMode = (m: TransportMode) => {
    setModes(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  const handleSubmit = () => {
    setError(null)
    const dest = destination.trim()
    if (!dest) {
      setError('목적지를 입력해주세요.')
      return
    }
    if (modes.length === 0) {
      setError('교통수단을 하나 이상 선택해주세요.')
      return
    }
    onSubmit({
      destination: dest,
      date,
      earliestDeparture: earliest,
      parkingPreference: parking,
      modes,
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div>
        <label className="text-xs font-bold text-gray-500 mb-2 block">목적지 도시 또는 역 이름</label>
        <input
          type="text"
          value={destination}
          onChange={e => setDestination(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="예: 부산, 대전, 동대구역"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          disabled={loading}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {POPULAR_DESTINATIONS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDestination(d)}
              disabled={loading}
              className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 text-gray-600 rounded-full transition-colors"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-2 block">출발 날짜</label>
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            disabled={loading}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-2 block">희망 출발시각 이후</label>
          <input
            type="time"
            value={earliest}
            onChange={e => setEarliest(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            disabled={loading}
          />
        </div>
      </div>

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
        disabled={loading || !destination.trim() || modes.length === 0}
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
