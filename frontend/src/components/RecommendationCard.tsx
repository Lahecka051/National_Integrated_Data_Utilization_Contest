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

  return (
    <button
      onClick={onClick}
      className={`card text-left w-full transition-all duration-200 relative
        ${isSelected ? 'ring-2 ring-primary-500 border-primary-200 shadow-md' : ''}
        ${isTop ? 'bg-gradient-to-br from-primary-50 to-blue-50 border-primary-100' : ''}
      `}
    >
      {isTop && (
        <div className="absolute -top-3 left-4 badge bg-primary-600 text-white text-xs shadow-sm">
          BEST
        </div>
      )}

      {/* 날짜 + 반차 유형 */}
      <div className="mb-3 pt-1">
        <p className="text-lg font-bold text-gray-900">{formatDate(rec.date)} {rec.day_of_week}</p>
        <p className={`text-sm font-medium ${rec.half_day_type === '오전반차' ? 'text-amber-600' : 'text-indigo-600'}`}>
          {rec.half_day_type}
          <span className="text-gray-400 font-normal ml-1">
            ({rec.half_day_type === '오전반차' ? '09:00~13:00' : '14:00~18:00'})
          </span>
        </p>
      </div>

      {/* 총 소요시간 */}
      <div className="flex items-end gap-1 mb-4">
        <span className="text-3xl font-bold text-gray-900">{rec.total_minutes}</span>
        <span className="text-sm text-gray-400 mb-1">분 소요</span>
      </div>

      {/* 세부 breakdown */}
      <div className="space-y-2 mb-4">
        <BreakdownRow icon="⏳" label="대기시간" value={`${rec.total_wait_time}분`} />
        <BreakdownRow icon="🚶" label="이동시간" value={`${rec.total_travel_time}분`} />
        <BreakdownRow icon={WEATHER_ICONS[rec.weather.condition] || '🌤️'} label="날씨" value={`${rec.weather.condition} ${rec.weather.temperature}°C`} />
      </div>

      {/* 사유 */}
      <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{rec.reason}</p>
    </button>
  )
}

function BreakdownRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">
        <span className="mr-1.5">{icon}</span>{label}
      </span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  )
}

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}
