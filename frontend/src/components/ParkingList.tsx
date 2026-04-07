import type { PublicParking } from '../types'
import ParkingStatusBadge from './ParkingStatusBadge'

interface ParkingListProps {
  parkings: PublicParking[]
  hasRealtime: boolean
  loading?: boolean
  onSelect?: (parking: PublicParking) => void
  selectedId?: string
}

function formatDistance(m: number): string {
  if (m < 1000) return `${m}m`
  return `${(m / 1000).toFixed(1)}km`
}

export default function ParkingList({ parkings, hasRealtime, loading, onSelect, selectedId }: ParkingListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  if (parkings.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-4xl mb-3">🅿️</div>
        <p className="text-sm">주변에 공공주차장이 없습니다.</p>
      </div>
    )
  }

  return (
    <div>
      {!hasRealtime && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs text-amber-800">이 지역은 실시간 잔여면수 데이터가 없습니다. 위치·요금 정보만 표시됩니다.</p>
        </div>
      )}

      <div className="space-y-3">
        {parkings.map(p => {
          const isSelected = selectedId === p.id
          return (
            <button
              key={p.id}
              onClick={() => onSelect?.(p)}
              className={`w-full text-left bg-white rounded-xl border p-4 transition-all hover:shadow-md ${
                isSelected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">{p.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{p.address}</p>
                </div>
                <ParkingStatusBadge status={p.status} available={p.available_slots} total={p.total_slots} />
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {formatDistance(p.distance)}
                </span>
                {p.parking_type && (
                  <span className="bg-gray-100 px-2 py-0.5 rounded-full">{p.parking_type}</span>
                )}
                {p.fee_info && (
                  <span className="truncate max-w-[180px]">💰 {p.fee_info}</span>
                )}
                {p.operating_hours && (
                  <span>🕐 {p.operating_hours}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
