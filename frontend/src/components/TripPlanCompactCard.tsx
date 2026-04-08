import type { TripPlan } from '../types'

interface TripPlanCompactCardProps {
  plan: TripPlan
  isSelected: boolean
  onClick: () => void
}

function formatDurationShort(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간${m}분`
}

function formatFareShort(won: number): string {
  if (won >= 10000) {
    return `${(won / 10000).toFixed(won % 10000 === 0 ? 0 : 1)}만`
  }
  return `${Math.round(won / 1000)}천`
}

export default function TripPlanCompactCard({ plan, isSelected, onClick }: TripPlanCompactCardProps) {
  const isTop = plan.rank === 1
  const modeIcon = plan.schedule.mode === 'train' ? '🚄' : '🚌'
  const modeLabel = plan.schedule.mode === 'train' ? '기차' : '고속버스'
  const isRealtime = !plan.schedule.is_estimated
  const accessIcon = plan.access_mode === 'transit' ? '🚇' : '🚗'

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

      {/* 교통수단 + 등급 */}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-base leading-none">{modeIcon}</span>
        <p className="text-sm font-bold text-gray-900 leading-none">{modeLabel}</p>
      </div>
      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{plan.schedule.grade}</p>

      {/* 허브 접근 수단 */}
      <p className="text-[11px] font-bold mt-1 text-indigo-600">
        {accessIcon} {plan.access_mode === 'transit' ? '대중교통' : '차량'}
      </p>

      {/* 총 소요 시간 */}
      <div className="flex items-baseline gap-0.5 mt-1.5">
        <span className="text-2xl font-bold text-gray-900 leading-none">{Math.round(plan.total_duration_min)}</span>
        <span className="text-[10px] text-gray-400">분</span>
      </div>

      {/* 컴팩트 통계 */}
      <div className="mt-2 space-y-0.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">💰 요금</span>
          <span className="font-medium text-gray-700">{formatFareShort(plan.total_fare_won)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">⭐ 점수</span>
          <span className="font-medium text-gray-700">{plan.score}점</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">🚄 이동</span>
          <span className="font-medium text-gray-700">{formatDurationShort(plan.schedule.duration_min)}</span>
        </div>
      </div>

      {/* 실시간/추정 뱃지 */}
      <div className="mt-1.5 flex justify-end">
        {isRealtime ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">실시간</span>
        ) : (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">추정</span>
        )}
      </div>
    </button>
  )
}
