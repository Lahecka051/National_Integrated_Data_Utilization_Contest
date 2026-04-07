import type { SlotRecommendation } from '../types'

const WEATHER_ICONS: Record<string, string> = {
  '맑음': '☀️',
  '흐림': '⛅',
  '비': '🌧️',
  '눈': '❄️',
}

interface RecommendationCardProps {
  recommendation: SlotRecommendation
  isSelected: boolean
  onClick: () => void
}

export default function RecommendationCard({ recommendation: rec, isSelected, onClick }: RecommendationCardProps) {
  const isTop = rec.rank === 1
  const halfDayColor = rec.half_day_type === '오전반차'
    ? 'text-amber-600'
    : rec.half_day_type === '오후반차'
      ? 'text-indigo-600'
      : 'text-emerald-600'

  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-xl border-2 p-2.5 transition-all duration-200 relative
        ${isSelected
          ? 'ring-2 ring-primary-500 border-primary-500 shadow-md bg-primary-50'
          : isTop
            ? 'bg-gradient-to-br from-primary-50 to-blue-50 border-primary-200'
            : 'bg-white border-gray-200 hover:border-gray-300'
        }
      `}
    >
      {isTop && (
        <div className="absolute -top-2 left-2 px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-[9px] font-bold shadow-sm">
          BEST
        </div>
      )}

      {/* 날짜 */}
      <p className="text-sm font-bold text-gray-900 mt-1">
        {formatDate(rec.date)}
      </p>
      <p className="text-[10px] text-gray-500">{rec.day_of_week}</p>

      {/* 반차 유형 */}
      <p className={`text-[11px] font-bold mt-1 ${halfDayColor}`}>
        {rec.half_day_type}
      </p>

      {/* 총 소요시간 */}
      <div className="flex items-baseline gap-0.5 mt-1.5">
        <span className="text-2xl font-bold text-gray-900 leading-none">{rec.total_minutes}</span>
        <span className="text-[10px] text-gray-400">분</span>
      </div>

      {/* 컴팩트 통계 */}
      <div className="mt-2 space-y-0.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">⏳ 대기</span>
          <span className="font-medium text-gray-700">{rec.total_wait_time}분</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">🚶 이동</span>
          <span className="font-medium text-gray-700">{rec.total_travel_time}분</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">{WEATHER_ICONS[rec.weather.condition] || '🌤️'} 날씨</span>
          <span className="font-medium text-gray-700">{rec.weather.temperature}°</span>
        </div>
      </div>
    </button>
  )
}

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}
