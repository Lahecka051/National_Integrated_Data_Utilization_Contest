import type { TransitHub, HubCongestion } from '../types'
import CongestionGauge from './CongestionGauge'

interface TransitHubCardProps {
  hub: TransitHub
  congestion?: HubCongestion | null
  loading?: boolean
  selected?: boolean
  onClick?: () => void
}

function formatDistance(m: number): string {
  if (m < 1000) return `${m}m`
  return `${(m / 1000).toFixed(1)}km`
}

export default function TransitHubCard({ hub, congestion, loading, selected, onClick }: TransitHubCardProps) {
  const isTrainStation = hub.type === 'train_station'
  const icon = isTrainStation ? '🚄' : '🚌'
  const typeLabel = isTrainStation ? '기차역' : '버스터미널'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border p-4 transition-all hover:shadow-md ${
        selected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-gray-900 truncate">{hub.name}</h3>
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
              {typeLabel}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate">{hub.address}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDistance(hub.distance)}</p>
        </div>
      </div>

      {loading && (
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
      )}
      {!loading && congestion && (
        <CongestionGauge score={congestion.score} level={congestion.level} note={congestion.note} />
      )}
      {!loading && !congestion && (
        <div className="text-xs text-gray-400 text-center py-2">
          탭하여 혼잡도 조회
        </div>
      )}
    </button>
  )
}
